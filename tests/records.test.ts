import assert from "node:assert/strict";

import { memoryTransport, metaStore } from "@sincpro/client-framework";
import type { Criteria } from "@sincpro/criteria";
import { modelOf, recordsSearch } from "@sincpro/web-framework";
import { nameBook } from "@sincpro/web-framework/core/names";
import { test } from "vitest";

import { servidorVentas } from "../stories/support/servidor";
import { clienteMeta, clientes, facturaMeta, facturas } from "../stories/support/ventas";

/** The framework's search of a relation's records over the sales server, its pages counted. */
function search() {
  const servidor = servidorVentas();
  const asked: { route: string; criteria: Criteria }[] = [];
  const transport = memoryTransport(servidor.tables, {
    handle: servidor.handle,
    observe: (route, criteria) => void asked.push({ route, criteria }),
  });
  const framework = {
    transport,
    metas: metaStore(),
    names: nameBook(transport, metaStore(), [clientes]),
    entities: [facturas, clientes],
  };
  return { searchRecords: recordsSearch(framework, "es"), asked };
}

const signal = new AbortController().signal;

test("a relation's records are its entity's literal search: chosen by key, read by name", async () => {
  const { searchRecords, asked } = search();
  const found = await searchRecords({
    relation: "Cliente",
    path: ["customer"],
    text: "globex",
    signal,
  });
  assert.deepEqual(
    found.map((one) => [one.id, one.name]),
    [["C-004", "Globex Bolivia"]],
  );
  // The template's question, each record whole — what tells two apart reads more than a reference.
  const question = asked.at(-1);
  assert.equal(question?.route, "/clientes");
  assert.equal(question?.criteria.specification, undefined);
  assert.equal(question?.criteria.pagination?.limit, 8);
});

test("keys read back from a link are named, never shown as keys", async () => {
  const { searchRecords } = search();
  const named = await searchRecords({
    relation: "Cliente",
    path: ["customer"],
    text: "",
    keys: ["C-001", "C-404"],
    signal,
  });
  // A key no record answers reads as itself: unnamed is not an error.
  assert.deepEqual(named, [
    { id: "C-001", name: "Importadora del Oriente" },
    { id: "C-404", name: "C-404" },
  ]);
});

test("a relation the application did not declare finds nothing", async () => {
  const { searchRecords } = search();
  assert.deepEqual(
    await searchRecords({ relation: "Proveedor", path: ["supplier"], text: "x", signal }),
    [],
  );
});

test("a relation's key column stays in the bar's model, compared as a key and never typed into", () => {
  // The bar's model keeps only the text fields a person types into — and the foreign key.
  const bar = modelOf(facturaMeta, "es", ["number", "customer_name"]);
  assert.ok(bar.fields["customer_id"], "web-ui compares a chosen customer by it");
  assert.deepEqual(
    bar.fields["customer_id"]?.ops.filter((op) => op === "like" || op === "starts with"),
    [],
  );
  assert.ok(bar.fields["customer_id"]?.ops.includes("in"));
  // A text a person types into keeps its comparisons.
  assert.ok(bar.fields["customer_name"]?.ops.includes("like"));
});

test("the search model says an enum's words and a to-many relation's key", () => {
  const model = modelOf(facturaMeta, "es");
  // «pagada» is offered as the word a cell writes, and `paid` is what is sent.
  assert.equal(model.translations?.choices?.["state"]?.["paid"]?.default, "Pagada");
  // A customer's invoices, compared through the relation by the key their definition names.
  const withInvoices = {
    ...clienteMeta,
    fields: {
      ...clienteMeta.fields,
      invoices: { ...clienteMeta.fields["invoices"]!, definition: facturaMeta },
    },
  };
  assert.equal(
    modelOf(withInvoices, "es").fields["invoices"]?.relationKey,
    facturaMeta.get_id || facturaMeta.identity,
  );
  // Without a definition web-ui compares them by `id`, its default.
  assert.equal(modelOf(clienteMeta, "es").fields["invoices"]?.relationKey, undefined);
});
