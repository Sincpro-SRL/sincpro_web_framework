import assert from "node:assert/strict";

import { entityView, lookupOf, memoryTransport } from "@sincpro/web-framework";
import { test } from "vitest";

import {
  contactoMeta,
  CONTACTOS,
  contactos,
  productoMeta,
  PRODUCTOS,
  productos,
} from "../stories/support/contactos";
import { tenantMeta } from "../stories/support/forge";
import { clienteMeta, CLIENTES, clientes, VENTAS } from "../stories/support/ventas";

const Nothing = () => null;

test("a record as a choice: its display, and its key beside it when they differ", () => {
  const [first] = lookupOf(clienteMeta, CLIENTES);
  assert.deepEqual(first, { id: "C-001", label: "Importadora del Oriente", detail: "C-001" });
});

test("a choice reads its key from the model the server sent", () => {
  const [one] = lookupOf(tenantMeta, [{ id: "acme", display_name: "ACME" }]);
  assert.deepEqual(one, { id: "acme", label: "ACME", detail: "acme" });
});

test("an entity is a workspace reference: the list without an id, a record with one", () => {
  assert.deepEqual(clientes.ref(), { domain: "ventas", kind: "cliente" });
  assert.deepEqual(clientes.ref("C-004"), { domain: "ventas", kind: "cliente", id: "C-004" });
});

test("⌘K finds a record by the entity's own search template", async () => {
  const spec = entityView(clientes, {
    transport: memoryTransport(VENTAS),
    name: "Clientes",
    list: Nothing,
    record: Nothing,
  });
  const hits = (await spec.search?.("Globex")) ?? [];
  assert.deepEqual(
    hits.map((hit) => [hit.ref.id, hit.label]),
    [["C-004", "Globex Bolivia"]],
  );
  assert.deepEqual(await spec.search?.("  "), []);
  assert.equal(spec.title({ domain: "ventas", kind: "cliente" }), "Clientes");
});

test("a choice carries the record's picture: a person is chosen by their face", () => {
  const [andina, maria] = lookupOf(contactoMeta, CONTACTOS, contactos.summary);
  assert.equal(andina?.image, CONTACTOS[0]?.image);
  assert.equal(maria?.image, undefined, "no photo: no picture, the initials are drawn");
  // A picture the entity names by a field of its own.
  const [cemento] = lookupOf(productoMeta, PRODUCTOS, productos.summary);
  assert.equal(cemento?.image, PRODUCTOS[0]?.picture);
});
