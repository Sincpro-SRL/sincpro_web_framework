import assert from "node:assert/strict";

import { defineMeta, field } from "@sincpro/client-framework";
import { formOf } from "@sincpro/web-framework";
import { test } from "vitest";

import { contactoMeta, contactos } from "../stories/support/contactos";
import { clienteMeta, facturaMeta } from "../stories/support/ventas";

test("an invoice's form: its fields, its many2one by its key, its lines as a page", () => {
  const { fields, pages } = formOf(facturaMeta);
  // `customer_id` is the customer (a picker); `customer` beside it would be it twice.
  assert.ok(fields.includes("customer_id"));
  assert.equal(fields.includes("customer"), false);
  // The bookkeeping and who made it are the paper's last line, not fields.
  for (const told of ["version", "created_at"]) assert.equal(fields.includes(told), false);
  assert.deepEqual(pages, ["lines"]);
  // In the order the model declares them.
  assert.ok(fields.indexOf("customer_id") < fields.indexOf("notes"));
});

test("a read-only identity is the record's name, not a field", () => {
  assert.equal(formOf(clienteMeta).fields.includes("id"), false);
  assert.deepEqual(formOf(clienteMeta).pages, ["invoices"]);
});

test("the picture and the audit parts are not text boxes", () => {
  const { fields } = formOf(contactoMeta, contactos.summary);
  for (const told of ["image", "created_at", "created_by", "updated_at", "updated_by"])
    assert.equal(fields.includes(told), false, told);
  assert.deepEqual(fields.slice(0, 4), ["name", "description", "type", "state"]);
});

test("without a model there is nothing to draw", () => {
  assert.deepEqual(formOf(null), { fields: [], pages: [], sections: [] });
});

const recibo = defineMeta({
  aggregate: "Recibo",
  identity: "numero",
  fields: {
    numero: field.text({ label: "N.º de recibo" }),
    concepto: field.text({ label: "Concepto" }),
  },
});
const monto = defineMeta({
  aggregate: "Money",
  identity: "currency",
  fields: { amount: field.number({ exact: true }), currency: field.text() },
});
const pagoMeta = defineMeta({
  aggregate: "Pago",
  identity: "id",
  fields: {
    id: field.text({ readonly: true }),
    concepto: field.text({ label: "Concepto" }),
    recibo: field.embedded(recibo, { label: "Recibo" }),
    total: field.embedded(monto, { label: "Total" }),
    archived_at: field.datetime({ nullable: true }),
  },
});

test("a value the record embeds is a section of its own fields; a money stays a field", () => {
  const { fields, sections } = formOf(pagoMeta);
  assert.deepEqual(sections, ["recibo"]);
  assert.equal(fields.includes("recibo"), false);
  assert.equal(fields.includes("total"), false);
});

test("when it went to the trash is a stamp, not a field", () => {
  assert.equal(formOf(pagoMeta).fields.includes("archived_at"), false);
});
