import assert from "node:assert/strict";

import {
  addingOf,
  blankLine,
  defineMeta,
  editableLines,
  field,
  lineFields,
  lineKey,
  linesAnswered,
  moved,
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
  // The product is a picker of a declared entity; the date and time is only read.
  assert.equal(addingOf(productoLine, declared), "inline");
  // Its entity not declared, the product is an id nobody types: the dialog.
  assert.equal(addingOf(productoLine, none), "editor");
  // A date and time to WRITE has no control a cell holds.
  const writable = {
    ...productoLine,
    fields: { ...productoLine.fields, delivered_at: field.datetime({ label: "Entregada" }) },
  };
  assert.equal(addingOf(writable, declared), "editor");
  // No model, no columns to write in: the dialog.
  assert.equal(addingOf(null, declared), "editor");
});

test("the screen may always ask for the dialog, and for the table only where it works", () => {
  assert.equal(addingOf(productoLine, declared, "editor"), "editor");
  assert.equal(addingOf(productoLine, declared, "inline"), "inline");
  assert.equal(addingOf(productoLine, none, "inline"), "editor");
});
