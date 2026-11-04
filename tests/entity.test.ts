import assert from "node:assert/strict";

import type { Expression } from "@sincpro/criteria";
import { entity, pathFor, SCOPE_PARAM, scopeOfRef } from "@sincpro/web-framework";
import { test } from "vitest";

const projects = entity("forge:project", {
  list: "/projects",
  commands: {
    revoke: "POST /projects/{id}/shares/{tenant_id}/revoke",
    move: "POST /projects/{id}/move",
  },
  create: "POST /tenants/{tenant_id}/projects",
});

test("a route with two keys takes the second from the body, as the server reads it", () => {
  const revoke = projects.commands["revoke"]!;
  assert.equal(
    pathFor(revoke, "p 1", { tenant_id: "acme/bo" }),
    "/projects/p%201/shares/acme%2Fbo/revoke",
  );
});

test("a key the body lacks is the screen's bug, said before anything is sent", () => {
  const revoke = projects.commands["revoke"]!;
  assert.throws(() => pathFor(revoke, "p1", {}), /needs "tenant_id"/);
  assert.throws(() => pathFor(revoke, "p1", { tenant_id: "" }), /needs "tenant_id"/);
});

test("a create fills its route's keys from what it sends; a route with only {id} is as before", () => {
  assert.equal(
    pathFor(projects.create!, undefined, { tenant_id: "acme" }),
    "/tenants/acme/projects",
  );
  assert.equal(pathFor(projects.commands["move"]!, "p1"), "/projects/p1/move");
});

const customers = entity("ventas:cliente", { list: "/clientes" });

test("a chooser carries the picker's cut, and reads it back as the expression it was", () => {
  const cut: Expression = { field: "id", operator: "not in", value: ["C-001", "C-004"] };
  const ref = customers.chooserRef("Glo", cut);
  assert.equal(ref.params?.[SCOPE_PARAM], JSON.stringify(cut));
  assert.deepEqual(scopeOfRef(ref), cut);
  assert.equal(scopeOfRef(customers.chooserRef("Glo")), undefined);
});

test("a cut typed in an address bar that does not read is no cut, never an error", () => {
  assert.equal(scopeOfRef({ params: { [SCOPE_PARAM]: "{not json" } }), undefined);
  assert.equal(scopeOfRef({ params: { [SCOPE_PARAM]: '{"name":"Globex"}' } }), undefined);
});
