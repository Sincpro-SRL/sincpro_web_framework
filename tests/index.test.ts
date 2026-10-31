import assert from "node:assert/strict";

import { test } from "vitest";

test("the package entry loads", async () => {
  const entry = await import("@sincpro/web-framework");
  assert.equal(typeof entry, "object");
});
