import assert from "node:assert/strict";

import { test, vi } from "vitest";

/** A page load, as far as a module is concerned: a fresh copy of it. */
async function aPageLoad() {
  vi.resetModules();
  return (await import("@sincpro/web-framework/core/trail")).trailKeyOf;
}

test("a list keeps its trail's key while the page lives, and no two lists share one", async () => {
  const trailKeyOf = await aPageLoad();
  assert.equal(trailKeyOf("_r_5q_"), trailKeyOf("_r_5q_"));
  assert.notEqual(trailKeyOf("_r_5q_"), trailKeyOf("_r_5r_"));
  assert.match(trailKeyOf("_r_5q_"), /^trail:/);
});

test("after a reload, an old link never names the trail of a new list that got the same React id", async () => {
  // React's ids start over on every load: the list drawn first after a reload may well get
  // `_r_5q_` again — and a record restored from the URL still carries the old `from`.
  const before = (await aPageLoad())("_r_5q_");
  const after = (await aPageLoad())("_r_5q_");
  assert.notEqual(before, after);
});
