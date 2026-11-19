import assert from "node:assert/strict";

import { chosen, entity, type Transport } from "@sincpro/client-framework";
import {
  CommandButton,
  sendRoute,
  useBatchCommand,
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
  // A Command over many records takes the same names and bodies as over one.
  const sendAll = useBatchCommand(issues, "send");
  void sendAll.run(chosen(["i1", "i2"]), { message: "a todos" });
  // @ts-expect-error — a field the Command does not take, run over many
  void sendAll.run(chosen(["i1"]), { mesage: "a todos" });
  // @ts-expect-error — a Command the entity does not declare, run over many
  useBatchCommand(issues, "sned");

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

test("a Command for one record goes where its route says, the record's key in its place", async () => {
  const sent: unknown[][] = [];
  const transport = {
    send: async (...args: unknown[]) => {
      sent.push(args);
      return { ok: true };
    },
  } as unknown as Transport;
  const answer = await sendRoute(
    transport,
    issues.commands.send,
    "i 7",
    { message: "hola" },
    {
      idempotencyKey: "k-1",
    },
  );
  assert.deepEqual(answer, { ok: true });
  assert.deepEqual(sent, [
    [
      "POST",
      "/issues/i%207/messages",
      { message: "hola" },
      undefined,
      { idempotencyKey: "k-1" },
    ],
  ]);
});
