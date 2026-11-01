import assert from "node:assert/strict";

import { createTestApi } from "@sincpro/web-composer";
import { openIn, RECORD_SIZE, targetsFor } from "@sincpro/web-framework";
import { test } from "vitest";

import { clientes, facturas } from "../stories/support/ventas";

const customer = clientes.ref("C-004");

test("a related record opens in a modal the size of a record, by default", () => {
  const t = createTestApi(facturas.ref("F-2026-0004"));
  openIn(t.api, customer);
  assert.deepEqual(t.callsTo("open")[0]?.args, [
    customer,
    { to: "modal", size: RECORD_SIZE },
  ]);
});

test("where the person asked, when it is offered from here", () => {
  const t = createTestApi(facturas.ref("F-2026-0004"));
  openIn(t.api, customer, "page");
  openIn(t.api, customer, "peek");
  assert.deepEqual(
    t.callsTo("open").map((call) => call.args[1]),
    [{ to: "page" }, { to: "peek" }],
  );
});

test("from inside a modal, never another modal: beside, or a preview", () => {
  const t = createTestApi(clientes.ref("C-004"), { over: facturas.ref("F-2026-0004") });
  assert.deepEqual(targetsFor(t.api), ["side", "peek", "page"]);
  openIn(t.api, facturas.ref("F-2026-0010"));
  openIn(t.api, facturas.ref("F-2026-0010"), "modal");
  assert.deepEqual(
    t.callsTo("open").map((call) => call.args[1]),
    [{ to: "side" }, { to: "side" }],
  );
});

test("a short task opens as a modal of its own size", () => {
  const t = createTestApi(facturas.ref("F-2026-0004"));
  openIn(t.api, { domain: "ventas", kind: "pago" }, "modal", { w: 640, h: 460 });
  assert.deepEqual(t.callsTo("open")[0]?.args[1], { to: "modal", size: { w: 640, h: 460 } });
});
