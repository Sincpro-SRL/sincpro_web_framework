import assert from "node:assert/strict";

import {
  CommandButton,
  entity,
  useCommand,
  useListing,
  useRowCommands,
} from "@sincpro/web-framework";
import { Send } from "lucide-react";
import { test } from "vitest";

type Issue = { id: string; title: string };
type IssueCommands = { send: { message: string }; stop: Record<string, never> };

const issues = entity<Issue, IssueCommands>("project:issue", {
  list: "/issues",
  commands: { send: "POST /issues/{id}/messages", stop: "POST /issues/{id}/stop" },
});

// Never called: what it holds is checked by the compiler (`make typecheck`). Each
// `@ts-expect-error` is a mistake the server used to find at runtime; if the types stopped
// catching it, the directive itself would fail the build.
function useMistakesTheCompilerCatches() {
  const send = useCommand(issues, "send");
  void send.run("i1", { message: "y el reporte también" });
  void send.rehearse("i1", { message: "y el reporte también" });
  void send.run("i1");

  // @ts-expect-error — a field the Command does not take
  void send.run("i1", { mesage: "y el reporte también" });
  // @ts-expect-error — a body without what the Command needs
  void send.rehearse("i1", {});
  // @ts-expect-error — a Command the entity does not declare
  useCommand(issues, "sned");

  entity<Issue, IssueCommands>("project:issue", {
    list: "/issues",
    // @ts-expect-error — a typed Command with nowhere to send it: `stop` has no route
    commands: { send: "POST /x" },
  });

  // Written type arguments keep the loose shape every screen had: forge's
  // `useCommand<Issue, Answer>(issues, "open")` still compiles.
  void useCommand<Issue, { id: string }>(issues, "anything").run("i1", { any: 1 });

  // A row's Commands are its entity's: their names, and the body each one takes.
  const listing = useListing(issues);
  useRowCommands(listing, [
    { command: "send", label: "Enviar", icon: Send, body: () => ({ message: "…" }) },
    { command: "stop", label: "Detener", icon: Send },
  ]);
  // @ts-expect-error — a Command the entity does not declare, on a row
  useRowCommands(listing, [{ command: "sned", label: "Enviar", icon: Send }]);
  useRowCommands(listing, [
    // @ts-expect-error — a row's body checked against its own Command
    { command: "send", label: "Enviar", icon: Send, body: () => ({ mesage: "…" }) },
  ]);

  return (
    <>
      <CommandButton entity={issues} command="send" body={{ message: "…" }} label="Enviar" />
      {/* @ts-expect-error — the button checks the body against its Command too */}
      <CommandButton entity={issues} command="send" body={{ mesage: "…" }} label="Enviar" />
    </>
  );
}

test("a typed entity keeps the routes its Commands were declared with", () => {
  assert.deepEqual(issues.commands.send, { method: "POST", path: "/issues/{id}/messages" });
  assert.deepEqual(issues.commands.stop, { method: "POST", path: "/issues/{id}/stop" });
});

test("what a typed Command takes is the compiler's to check: this file only has to compile", () => {
  assert.equal(typeof useMistakesTheCompilerCatches, "function");
});
