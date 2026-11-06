import assert from "node:assert/strict";

import * as entry from "@sincpro/web-framework";
import * as core from "@sincpro/web-framework/core";
import { test } from "vitest";

// Imported statically, not with `await import()` inside the test: loading the whole package
// cold (web-ui and its stylesheets, bundled) counted against the test's timeout, and beside the
// stories in Chrome it took over 30 s now and then — on main too. Loading a file is not timed;
// what this proves is that the entries load, not how fast.

test("the package entry loads", () => {
  assert.equal(typeof entry.EntityList, "function");
  assert.equal(typeof entry.useListing, "function");
});

test("the core entry holds the screens' plain logic, for code that draws nothing", () => {
  assert.equal(typeof core.textOf, "function");
  assert.equal(typeof core.explain, "function");
});

test("what every platform shares is @sincpro/client-framework's, never re-exported here", () => {
  // One place for the transport and the entity: an application imports them from there, and a
  // second door here would let two versions meet in one screen.
  assert.equal("entity" in entry, false);
  assert.equal("restTransport" in core, false);
  // The same for the day/instant conversions: one zone installed, in one place.
  assert.equal("installTimeZone" in entry, false);
  assert.equal("installTimeZone" in core, false);
});
