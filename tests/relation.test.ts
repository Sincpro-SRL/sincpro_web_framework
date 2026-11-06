import assert from "node:assert/strict";

import { defineMeta, entity, field } from "@sincpro/client-framework";
import { entityFor, relationFieldOf } from "@sincpro/web-framework";
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

/** An issue as sincpro_framework publishes `tenant_id: EntityID[Tenant]` and
 *  `project_id: EntityID[Project]`: keys alone, each saying whose record it names. */
const issueMeta = defineMeta({
  aggregate: "Issue",
  identity: "id",
  fields: {
    id: field.text(),
    title: field.text(),
    tenant_id: { ...field.text(), relation: "auth.Tenant" },
    project_id: { ...field.text(), relation: "Project" },
  },
});

test("a key alone that says whose record it names is a many2one, holding only its key", () => {
  const tenant = relationFieldOf(issueMeta, "tenant_id");
  assert.deepEqual(
    {
      relation: tenant?.relation,
      key: tenant?.key,
      target: tenant?.target,
      many: tenant?.many,
    },
    { relation: "tenant_id", key: "tenant_id", target: "auth.Tenant", many: false },
  );
  assert.equal(tenant?.held, false);
  // A relation the server expands beside its key still holds its record.
  assert.equal(relationFieldOf(facturaMeta, "customer_id")?.held, true);
  assert.equal(relationFieldOf(issueMeta, "title"), undefined);
});

test("a key's entity is found by the model it names, in another context or in its own", () => {
  const tenants = entity("auth:tenant", { list: "/tenants" });
  const projects = entity("project:project", { list: "/projects" });
  const all = [tenants, projects, facturas];
  assert.equal(entityFor(all, "auth.Tenant"), tenants);
  assert.equal(entityFor(all, "Project"), projects);
  // A context named by its own name, where the application keys it by alias: the only tenant.
  assert.equal(entityFor(all, "sincpro-forge-auth.Tenant"), tenants);
  assert.equal(entityFor(all, "billing.Invoice"), undefined);
});
