import assert from "node:assert/strict";

import { defineMeta, field } from "@sincpro/client-framework";
import {
  defaultFields,
  installFrameworkCopy,
  relatedOf,
  sortKeyOf,
  SPANISH_FRAMEWORK_COPY,
  textOf,
  viewOf,
} from "@sincpro/web-framework";
import { test } from "vitest";

import { tenantMeta } from "../stories/support/forge";
import { FACTURA_GRANDE, facturaMeta, FACTURAS } from "../stories/support/ventas";

installFrameworkCopy(SPANISH_FRAMEWORK_COPY);

test("a choice reads as the word the model gave it", () => {
  assert.equal(textOf(facturaMeta, "state", "paid", "es"), "Pagada");
});

test("a boolean reads as the copy table says", () => {
  assert.equal(textOf(facturaMeta, "tags", [], "es"), null);
  assert.equal(textOf(tenantMeta, "active", true, "es"), "sí");
});

test("a date is a local date: no day lost to UTC", () => {
  const text = textOf(facturaMeta, "invoice_date", "2026-03-01", "es") ?? "";
  assert.match(text, /^1 /);
});

test("a decimal that travels as text keeps its digits", () => {
  assert.equal(textOf(facturaMeta, "amount_total", "1150.50", "es"), "1150,50");
  assert.equal(sortKeyOf(facturaMeta, "amount_total", "1150.50"), 1150.5);
});

test("a many2one reads as the display of the record it points at", () => {
  assert.equal(
    textOf(facturaMeta, "customer", { id: "C-001", name: "Globex" }, "es"),
    "Globex",
  );
});

test("a one2many reads as its TOTAL, not as the page the record brought", () => {
  const grande = FACTURAS.find((f) => f.number === FACTURA_GRANDE);
  assert.equal(textOf(facturaMeta, "lines", grande?.lines, "es"), "120 elementos");
  const related = relatedOf(grande?.lines);
  assert.equal(related.items.length, 20);
  assert.equal(related.partial, true);
});

test("a bare array is a relation with nothing left out", () => {
  assert.deepEqual(relatedOf([1, 2]), {
    items: [1, 2],
    count: { value: 2, exact: true },
    cursor: null,
    partial: false,
  });
});

test("without labels a field is called by its own name — what forge shows today", () => {
  assert.equal(viewOf(tenantMeta, "display_name", "es").label, "display_name");
});

test("the default fields are the scalars, relations left for their own page", () => {
  const fields = defaultFields(facturaMeta);
  assert.ok(fields.includes("amount_total"));
  assert.ok(!fields.includes("lines"));
  assert.ok(!fields.includes("customer"));
});

test("a field the model does not declare is drawn plain, never thrown", () => {
  assert.equal(textOf(facturaMeta, "nope", { a: 1 }), '{"a":1}');
  assert.equal(viewOf(facturaMeta, "nope").sortable, false);
});

test("a decimal longer than a float holds is drawn whole: no digit through a number", () => {
  assert.equal(
    textOf(facturaMeta, "amount_total", "12345678901234567.89", "en"),
    "12,345,678,901,234,567.89",
  );
});

test("a money reads in its currency, rounded as an invoice shows it — the amount never a float", () => {
  const meta = defineMeta({
    aggregate: "Line",
    identity: "id",
    fields: {
      id: field.text(),
      price: field.embedded(
        defineMeta({
          aggregate: "Money",
          identity: "currency",
          fields: { amount: field.number({ exact: true }), currency: field.text() },
        }),
      ),
    },
  });
  assert.equal(
    textOf(meta, "price", { amount: "1150.5", currency: "USD" }, "en"),
    "$1,150.50",
  );
  assert.equal(textOf(meta, "price", { amount: "1000", currency: "JPY" }, "en"), "¥1,000");
  // A code Intl does not know is drawn as «amount CODE».
  assert.equal(textOf(meta, "price", { amount: "2.5", currency: "USDT" }, "en"), "2.50 USDT");
  // A money whose amount or code is not one reads as nothing, never as an error in a cell.
  assert.equal(textOf(meta, "price", { amount: "1,50", currency: "BOB" }, "en"), null);
  assert.equal(textOf(meta, "price", { amount: "", currency: "BOB" }, "en"), null);
  assert.equal(textOf(meta, "price", { amount: "1.5", currency: "" }, "en"), null);
  // Any other value object still has no text of its own.
  assert.equal(textOf(meta, "price", { street: "Calle 1" }, "en"), null);
});
