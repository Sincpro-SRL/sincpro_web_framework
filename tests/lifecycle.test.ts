import assert from "node:assert/strict";

import { defineMeta, field } from "@sincpro/client-framework";
import { creationOf, defaultsOf, editedOf } from "@sincpro/web-framework";
import { test } from "vitest";

import { facturaMeta } from "../stories/support/ventas";

test("a new record starts from the defaults the model publishes, and nothing else", () => {
  assert.deepEqual(defaultsOf(facturaMeta), {
    state: "draft",
    payment: "cash",
    discount: "0",
    urgent: false,
  });
  assert.deepEqual(defaultsOf(null), {});
});

test("a create sends what the caller may write: no read-only field, no empty one", () => {
  const sent = creationOf(facturaMeta, {
    ...defaultsOf(facturaMeta),
    customer_id: "C-004",
    notes: "",
    number: "F-9",
  });
  assert.deepEqual(sent, {
    payment: "cash",
    discount: "0",
    urgent: false,
    customer_id: "C-004",
  });
});

test("a create sends what was written, even what a condition locks afterwards", () => {
  const meta = defineMeta({
    aggregate: "Tenant",
    identity: "slug",
    display: "name",
    fields: {
      // Written once, when the tenant is created; read-only once it is stored.
      slug: field.text({
        label: "Slug",
        readonlyWhen: { field: "version", operator: ">", value: 0 },
      }),
      // Chosen first, locked once there are lines: still the record's currency.
      currency: field.text({
        label: "Moneda",
        readonlyWhen: { field: "has_lines", operator: "=", value: true },
      }),
      has_lines: field.boolean({ label: "Con líneas" }),
      name: field.text({ label: "Nombre" }),
      number: field.text({ label: "Número", readonly: true }),
    },
  });
  assert.deepEqual(
    creationOf(meta, {
      slug: "acme",
      currency: "BOB",
      has_lines: true,
      name: "Acme",
      number: "T-1",
    }),
    { slug: "acme", currency: "BOB", has_lines: true, name: "Acme" },
  );
});

test("an edit of a stored record sends what changed, never what the framework writes", () => {
  const stored = {
    number: "F-7",
    version: 3,
    created_at: "2026-11-01T12:00:00Z",
    notes: "antes",
    discount: "0",
    amount_total: "100.00",
    lines: [
      { id: "L-1", product: "Tornillo", quantity: 2, price: "10", subtotal: "20" },
      { product: "Tuerca", quantity: 1, price: "5", subtotal: "5" },
    ],
  };
  // The record whole is on screen; only the note and the lines were changed.
  assert.deepEqual(
    editedOf(facturaMeta, { ...stored, notes: "después" }, ["notes", "lines", "version"]),
    {
      notes: "después",
      // A line keeps its identity — the form names the line it edits — and loses what the
      // line's model marks read-only (its computed subtotal).
      lines: [
        { id: "L-1", product: "Tornillo", quantity: 2, price: "10" },
        { product: "Tuerca", quantity: 1, price: "5" },
      ],
    },
  );
  // Nothing changed: nothing travels — a save then stores the draft the server holds.
  assert.deepEqual(editedOf(facturaMeta, stored, []), {});
  // Without a model, what changed travels as it is.
  assert.deepEqual(editedOf(null, { ...stored, notes: "x" }, ["notes"]), { notes: "x" });
});
