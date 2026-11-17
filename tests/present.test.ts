import assert from "node:assert/strict";

import { defineMeta, field, installTimeZone } from "@sincpro/client-framework";
import {
  currencyNow,
  dateStyleNow,
  defaultFields,
  installCurrency,
  installDateStyle,
  installFrameworkCopy,
  relatedOf,
  sortKeyOf,
  SPANISH_FRAMEWORK_COPY,
  textOf,
  valueAt,
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
  assert.equal(textOf(facturaMeta, "invoice_date", "2026-03-01", "es"), "01/03/2026");
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
  // A value that is not the money its definition says has no text.
  assert.equal(textOf(meta, "price", { street: "Calle 1" }, "en"), null);
});

test("a date is written day first by default, and the month in words when asked", () => {
  const meta = defineMeta({
    aggregate: "Cita",
    identity: "id",
    fields: {
      id: field.text(),
      day: field.date({ label: "Día" }),
      at: field.datetime({ label: "Hora" }),
    },
  });
  installTimeZone("America/La_Paz");
  try {
    // Day first whatever the language: `en` would put the month first.
    assert.equal(textOf(meta, "day", "2026-11-16", "en"), "16/11/2026");
    assert.equal(textOf(meta, "at", "2026-11-16T19:36:00Z", "es"), "16/11/2026 15:36");
    installDateStyle("literal");
    assert.match(textOf(meta, "day", "2026-11-16", "es") ?? "", /^16 nov/);
    assert.equal(dateStyleNow(), "literal");
  } finally {
    installDateStyle(undefined);
    installTimeZone(undefined);
  }
});

test("an amount the model draws as money is money: in the business's currency, rounded", () => {
  const meta = defineMeta({
    aggregate: "Pago",
    identity: "id",
    fields: { id: field.text(), monto: field.number({ exact: true, label: "Monto" }) },
  });
  const money = {
    ...meta,
    fields: { ...meta.fields, monto: { ...meta.fields["monto"]!, widget: "money" } },
  };
  // No currency installed: two decimals, no symbol — never «25».
  assert.equal(textOf(money, "monto", "25", "es-BO"), "25,00");
  installCurrency("BOB");
  try {
    assert.match(textOf(money, "monto", "1150.5", "es-BO") ?? "", /^Bs\s?1\.150,50$/);
    assert.equal(currencyNow(), "BOB");
  } finally {
    installCurrency(undefined);
  }
  // The same decimal without the widget is a number with its digits.
  assert.equal(textOf(meta, "monto", "25", "es-BO"), "25");
});

const reciboMeta = defineMeta({
  aggregate: "Pago",
  identity: "id",
  fields: {
    id: field.text(),
    recibo: field.embedded(
      defineMeta({
        aggregate: "Recibo",
        identity: "numero",
        fields: {
          numero: field.text({ label: "N.º de recibo" }),
          emitido_en: field.date({ label: "Emitido" }),
          concepto: field.text({ label: "Concepto" }),
        },
      }),
      { label: "Recibo" },
    ),
  },
});
const pago = {
  id: "P-1",
  recibo: { numero: "0042", emitido_en: "2026-11-16", concepto: null },
};

test("a value the record embeds reads through its definition, never as JSON", () => {
  assert.equal(
    textOf(reciboMeta, "recibo", pago.recibo, "es"),
    "N.º de recibo: 0042 · Emitido: 16/11/2026",
  );
});

test("a field of an embedded value is named by its path: its label, its type, its value", () => {
  assert.equal(viewOf(reciboMeta, "recibo.emitido_en", "es").label, "Emitido");
  assert.equal(viewOf(reciboMeta, "recibo.emitido_en", "es").type, "date");
  assert.equal(valueAt(reciboMeta, pago, "recibo.numero"), "0042");
  assert.equal(textOf(reciboMeta, "recibo.emitido_en", "2026-11-16", "es"), "16/11/2026");
  assert.equal(valueAt(reciboMeta, pago, "recibo.nada"), undefined);
});
