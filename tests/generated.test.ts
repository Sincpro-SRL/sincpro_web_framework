import assert from "node:assert/strict";

import { presented, useCommand } from "@sincpro/web-framework";
import { test } from "vitest";

import { issues, projects } from "../stories/support/forge-contract/project/entities";

/**
 * Context: what @sincpro/client-framework generates from a contract is proven there, byte for
 * byte; what is proven here is that the web's hooks take a generated entity whole — its Commands'
 * names, bodies and answers checked by the compiler, presented or not.
 */

// Never called: the compiler checks it (`make typecheck`).
function useForgeAsGenerated() {
  const send = useCommand(issues, "sendIssue");
  void send.run("i1", { message: "y el reporte también" });
  // @ts-expect-error — the issue's key is the id `run` takes, never written in the body again
  void send.run("i1", { issue_id: "i1", message: "y el reporte también" });
  void useCommand(projects, "openIssue").run("p1", { request: "Falla el login" });
  // Presented, a generated entity keeps its typed Commands.
  const shown = presented(issues, { row: (one) => ({ meta: one.status }) });
  void useCommand(shown, "sendIssue").run("i1", { message: "y el reporte" });
  // @ts-expect-error — still checked once presented
  void useCommand(shown, "sendIssue").run("i1", { mesage: "y el reporte" });
  // What a Command answers comes with it, with no type argument written.
  void send.run("i1", { message: "y el reporte" }).then((answer) => answer?.run_id);
  // @ts-expect-error — the answer holds what the server publishes, nothing else
  void send.run("i1", { message: "y el reporte" }).then((answer) => answer?.nope);
}

test("a generated entity's Commands are checked by the web's hooks: this file only has to compile", () => {
  assert.equal(typeof useForgeAsGenerated, "function");
});
