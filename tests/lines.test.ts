import assert from "node:assert/strict";

import { defineMeta, field } from "@sincpro/client-framework";
import {
  addingOf,
  backReference,
  blankLine,
  editableLines,
  frameworkCopy,
  isReference,
  lineFields,
  lineKey,
  linesAnswered,
  moved,
  relatedOf,
  relatedScope,
  sameLine,
} from "@sincpro/web-framework";
import { test } from "vitest";

test("a line from the server is keyed by its id; a new one by a local key it keeps", () => {
  const stored = { id: "L-1", product: "Impresora" };
  const fresh = blankLine({ id: "x", product: "", quantity: 1 }, "id");
  assert.equal(lineKey(stored, "id"), "L-1");
  // A new line goes without an id: the server refuses one it does not know.
  assert.equal("id" in fresh, false);
  const key = lineKey(fresh, "id");
  assert.match(key, /^new-/);
  assert.equal(lineKey(fresh, "id"), key);
  // Edited, it is a copy that keeps the key.
  const edited = sameLine(fresh, { ...fresh, product: "Toner" });
  assert.equal(lineKey(edited, "id"), key);
});

test("what the server answers about the list keeps each new line's key by position", () => {
  const a = blankLine({ product: "" }, "id");
  const b = { id: "L-1", product: "Impresora" };
  const sent = [b, a];
  const keyA = lineKey(a, "id");
  // The preview answers the list computed — new objects, the new line still with no id.
  const answered = linesAnswered(sent, [
    { id: "L-1", product: "Impresora", subtotal: "10.00" },
    { product: "", subtotal: "0.00" },
  ]);
  assert.equal(lineKey(answered[0]!, "id"), "L-1");
  assert.equal(lineKey(answered[1]!, "id"), keyA);
});

test("only a whole list is editable: a page of them, written back, would delete the rest", () => {
  const page = (shown: number, count: number) => ({
    items: Array.from({ length: shown }, (_, i) => ({ id: `L-${i}` })),
    count: { value: count, exact: true },
    cursor: shown < count ? "next" : null,
  });
  assert.equal(editableLines(page(3, 3))?.length, 3);
  assert.equal(editableLines(page(20, 120)), null);
  assert.equal(editableLines([{ id: "L-1" }])?.length, 1);
});

test("a line moves before another, or to the end, by key", () => {
  const lines = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const keys = (list: { id: string }[]) => list.map((one) => one.id).join("");
  assert.equal(keys(moved(lines, "id", "c", "a")), "cab");
  assert.equal(keys(moved(lines, "id", "a", null)), "bca");
  assert.equal(keys(moved(lines, "id", "zz", "a")), "abc");
});

const productoLine = defineMeta({
  aggregate: "LineaPedido",
  identity: "id",
  display: "product_code",
  fields: {
    id: field.text({ label: "Línea", readonly: true }),
    product_code: field.text({ label: "Producto" }),
    product: field.many2one(
      "Producto",
      { identifiedBy: "product_code" },
      { label: "Producto" },
    ),
    quantity: field.integer({ label: "Cantidad" }),
    delivered_at: field.datetime({ label: "Entregada", readonly: true }),
    version: field.integer({ label: "Versión", readonly: true }),
  },
});
const declared = (target: string) => target === "Producto";
const none = () => false;

test("a line is drawn by its scalars — a many2one by its key — never its id nor bookkeeping", () => {
  assert.deepEqual(lineFields(productoLine), ["product_code", "quantity", "delivered_at"]);
  assert.deepEqual(lineFields(null), []);
});

test("a line is added in the table when every field a person writes fits a cell", () => {
  // The product is a picker of a declared entity.
  assert.equal(addingOf(productoLine, { declared }), "inline");
  // Its entity not declared, the product is an id nobody types: the dialog.
  assert.equal(addingOf(productoLine, { declared: none }), "editor");
  // A date and time to write fits too: the cell holds a date-and-time control.
  const writable = {
    ...productoLine,
    fields: { ...productoLine.fields, delivered_at: field.datetime({ label: "Entregada" }) },
  };
  assert.equal(addingOf(writable, { declared }), "inline");
  // No model, no columns to write in: the dialog.
  assert.equal(addingOf(null, { declared }), "editor");
});

test("the screen may always ask for the dialog, and for the table only where it works", () => {
  assert.equal(addingOf(productoLine, { declared, asked: "editor" }), "editor");
  assert.equal(addingOf(productoLine, { declared, asked: "inline" }), "inline");
  assert.equal(addingOf(productoLine, { declared: none, asked: "inline" }), "editor");
});

test("a control of the screen's own fits a cell; a required field left out of the columns does not", () => {
  // The screen writes the product with its own widget: it fits, declared or not.
  assert.equal(
    addingOf(productoLine, { declared: none, own: new Set(["product_code"]) }),
    "inline",
  );
  // Columns without the quantity: optional, the row can still be finished.
  assert.equal(addingOf(productoLine, { declared, shown: ["product_code"] }), "inline");
  // Without the product, which is REQUIRED: the row could never be finished there.
  const required = {
    ...productoLine,
    fields: {
      ...productoLine.fields,
      product_code: field.text({ label: "Producto", required: true }),
    },
  };
  assert.equal(addingOf(required, { declared, shown: ["quantity"] }), "editor");
});

test("the records a relation only references are never lines to edit, however few came", () => {
  const references = { type: "one2many", kind: "relation", reference: true } as never;
  const parts = { type: "one2many", kind: "relation" } as never;
  const page = (shown: number, count: number) => ({
    items: Array.from({ length: shown }, (_, i) => ({ id: `I-${i}` })),
    count: { value: count, exact: true },
    cursor: null,
  });

  assert.equal(isReference(references), true);
  assert.equal(isReference(parts), false);
  assert.equal(editableLines(page(3, 3), references), null);
  assert.equal(editableLines([{ id: "I-1" }], references), null);
  assert.equal(editableLines(page(3, 3), parts)?.length, 3);
});

test("a count the server stopped at its cap is a floor: «at least», never the total", () => {
  const related = relatedOf({
    items: [{ id: "a" }, { id: "b" }],
    count: { value: 1000, exact: false },
    cursor: null,
  });

  assert.equal(related.partial, true);
  assert.deepEqual(related.count, { value: 1000, exact: false });
  assert.equal(relatedOf({ items: [{ id: "a" }], cursor: "x" }).count.exact, false);
  assert.equal(relatedOf({ items: [{ id: "a" }] }).partial, false);
  assert.equal(frameworkCopy().record.partial(2, 1000, false), "Showing 2 of at least 1000.");
  assert.equal(frameworkCopy().record.partial(2, 30), "Showing 2 of 30.");
});

test("a relation of one record is asked by its key — by identity or by a business key — and not before it is known", () => {
  const customer = { id: "c1", code: "ACME" };
  const byIdentity = {
    type: "one2many",
    kind: "relation",
    identified_by: "customer_id",
  } as never;
  const byCode = {
    type: "one2many",
    kind: "relation",
    parent_field: "code",
    related_field: "customer_code",
  } as never;

  assert.deepEqual(relatedScope(customer, byIdentity, "id")?.selection, {
    field: "customer_id",
    operator: "=",
    value: "c1",
  });
  assert.deepEqual(relatedScope(customer, byCode, "id")?.selection, {
    field: "customer_code",
    operator: "=",
    value: "ACME",
  });
  assert.equal(relatedScope(null, byIdentity, "id"), null);
  assert.deepEqual(backReference(customer, byCode, "id"), {
    field: "customer_code",
    value: "ACME",
  });
});
