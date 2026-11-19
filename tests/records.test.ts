import assert from "node:assert/strict";

import { chosen, memoryTransport, metaStore } from "@sincpro/client-framework";
import type { Criteria } from "@sincpro/criteria";
import { modelLoader, modelOf, recordsBrowser, recordsSearch } from "@sincpro/web-framework";
import { nameBook } from "@sincpro/web-framework/core/names";
import { test } from "vitest";

import { servidorVentas } from "../stories/support/servidor";
import { clienteMeta, clientes, facturaMeta, facturas } from "../stories/support/ventas";

const waitUntil = async (done: () => boolean) => {
  for (let tries = 0; tries < 50 && !done(); tries++)
    await new Promise((ok) => setTimeout(ok, 5));
  assert.ok(done(), "never happened");
};

/** The framework's reads over the sales server, and its search of a relation's records. */
function searchWith() {
  const servidor = servidorVentas();
  const transport = memoryTransport(servidor.tables, { handle: servidor.handle });
  const framework = {
    transport,
    metas: metaStore(),
    names: nameBook(transport, metaStore(), [clientes]),
    entities: [facturas, clientes],
  };
  return { framework, searchRecords: recordsSearch(framework, "es") };
}

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

test("the builder walks a path: a relation's own definition, else its entity's", async () => {
  const { framework } = searchWith();
  const loadModel = modelLoader(framework, facturaMeta, "es");
  // The invoice's customer carries its definition inside.
  const customers = await loadModel(["customer"]);
  assert.equal(customers.aggregate, "Cliente");
  assert.ok(customers.fields["tax_id"]);
  // A customer's invoices do not: their entity's, read once.
  const invoices = await loadModel(["customer", "invoices"]);
  assert.equal(invoices.aggregate, facturaMeta.aggregate);
  // A path that leads nowhere is refused, never a model invented.
  await assert.rejects(loadModel(["state", "x"]));
});

test("«Buscar más…» opens the relation's chooser — several or one —, without what is chosen", async () => {
  const { framework, searchRecords } = searchWith();
  const asked: { many: boolean; scope: unknown; query: string }[] = [];
  let answerMany: ((selection: ReturnType<typeof chosen>) => void) | undefined;
  let answerOne: ((id: string) => void) | undefined;
  const browse = recordsBrowser(
    framework,
    {
      chooseMany: (_entity, answer, query, scope) => {
        asked.push({ many: true, scope, query });
        answerMany = answer;
      },
      choose: (_entity, answer, query, scope) => {
        asked.push({ many: false, scope, query });
        answerOne = answer;
      },
    },
    searchRecords,
    () => assert.fail("nothing refused"),
  );
  const chosenNow: unknown[][] = [];
  const done = (records: readonly unknown[]) => void chosenNow.push([...records]);

  browse({
    relation: "Cliente",
    path: ["customer"],
    label: "Cliente",
    text: "glo",
    many: true,
    chosen: [{ id: "C-004", name: "Globex Bolivia" }],
    choose: done,
  });
  assert.deepEqual(asked[0], {
    many: true,
    query: "glo",
    scope: { field: "id", operator: "not in", value: ["C-004"] },
  });
  answerMany?.(chosen(["C-001", "C-002"]));
  await waitUntil(() => chosenNow.length === 1);
  assert.deepEqual(chosenNow[0], [
    { id: "C-001", name: "Importadora del Oriente" },
    { id: "C-002", name: "Clínica San Gabriel" },
  ]);

  browse({
    relation: "Cliente",
    path: ["customer"],
    label: "Cliente",
    text: "",
    many: false,
    chosen: [],
    choose: done,
  });
  assert.equal(asked[1]?.many, false);
  answerOne?.("C-003");
  await waitUntil(() => chosenNow.length === 2);
  assert.deepEqual(chosenNow[1], [{ id: "C-003", name: "Ferretería El Progreso" }]);
});
