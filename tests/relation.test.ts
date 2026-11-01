import assert from "node:assert/strict";

import { entity, entityFor, relationFieldOf } from "@sincpro/web-framework";
import { test } from "vitest";

import { personaMeta, personas } from "../stories/support/contactos";
import { clienteMeta, clientes, facturaMeta, facturas } from "../stories/support/ventas";

test("a form may name the relation or its key: both are the customer", () => {
  for (const name of ["customer", "customer_id"]) {
    const found = relationFieldOf(facturaMeta, name);
    assert.equal(found?.relation, "customer", name);
    assert.equal(found?.key, "customer_id", name);
    assert.equal(found?.target, "Cliente", name);
    assert.equal(found?.many, false, name);
  }
});

test("a field that points at nothing is not a relation", () => {
  assert.equal(relationFieldOf(facturaMeta, "notes"), undefined);
  assert.equal(relationFieldOf(facturaMeta, "missing"), undefined);
  assert.equal(relationFieldOf(null, "customer"), undefined);
});

test("a relation is resolved to the entity the application declared", () => {
  const all = [facturas, clientes, personas];
  // By the model definition the application already knows.
  const metas: Record<string, typeof clienteMeta> = {
    [clientes.key]: clienteMeta,
    [personas.key]: personaMeta,
  };
  assert.equal(
    entityFor(all, "Cliente", (key) => metas[key]),
    clientes,
  );
  // Before any definition is known: by the aggregate the entity declares.
  const declared = entity("ventas:cliente", { list: "/clientes", aggregate: "Cliente" });
  assert.equal(entityFor([facturas, declared], "Cliente"), declared);
  // Or by its key; and nothing when no entity is that aggregate.
  assert.equal(entityFor(all, "ventas:cliente"), clientes);
  assert.equal(
    entityFor(all, "Proveedor", (key) => metas[key]),
    undefined,
  );
});
