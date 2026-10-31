import assert from "node:assert/strict";
import { test } from "node:test";

test("the package entry loads", async () => {
  const entry = await import("@sincpro/web-framework");
  assert.equal(typeof entry, "object");
});
