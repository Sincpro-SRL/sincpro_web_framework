import assert from "node:assert/strict";

import * as entry from "@sincpro/web-framework";
import * as core from "@sincpro/web-framework/core";
import { test } from "vitest";

// Imported statically, not with `await import()` inside the test: loading the whole package
// cold (web-ui and its stylesheets, bundled) counted against the test's timeout, and beside the
// stories in Chrome it took over 30 s now and then — on main too. Loading a file is not timed;
// what this proves is that the entries load, not how fast.

test("the package entry loads", () => {
  assert.equal(typeof entry.entity, "function");
  assert.equal(typeof entry.EntityList, "function");
});

test("the core entry holds the transport and the entity, for code that draws nothing", () => {
  assert.equal(typeof core.restTransport, "function");
  assert.equal(typeof core.entity, "function");
});
