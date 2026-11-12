import assert from "node:assert/strict";

import { touchedBy, touches } from "@sincpro/web-framework/core/changes";
import { test } from "vitest";

import { facturas } from "../stories/support/ventas";

const write = (route: string) => ({ method: "POST" as const, route });

test("a write touches every collection its route names, and what lies under each", () => {
  const leave = write("/users/ana@x.bo/tenants/acme/leave");
  assert.ok(touches(leave, "/users?q=ana", []));
  assert.ok(touches(leave, "/tenants/acme/members", []));
  assert.ok(touches(leave, "/users/ana@x.bo?draft=true", []));
  assert.ok(!touches(leave, "/projects", []));
});

test("a namesake is another collection: /facturas is not /facturas-events", () => {
  assert.ok(!touches(write("/facturas/F-1/confirm"), "/facturas-events", []));
});

test("a write under an entity touches its history, wherever its events live", () => {
  const elsewhere = { ...facturas, history: "/factura-events/{id}" };
  assert.deepEqual(touchedBy("/facturas/F-1/confirm", [elsewhere]).at(-1), "/factura-events");
  assert.ok(touches(write("/facturas/F-1/confirm"), "/factura-events/F-1", [elsewhere]));
});
