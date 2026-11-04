import assert from "node:assert/strict";

import {
  blankLine,
  editableLines,
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
