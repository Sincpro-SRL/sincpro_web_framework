import assert from "node:assert/strict";

import { ownCrumbs, ownLabel } from "@sincpro/web-framework/core/crumbs";
import { test } from "vitest";

/* A crumb says only what is its own (#67): under its parent, the parent's name is not repeated. */

test("a crumb drops its parent's name and the joint that held it", () => {
  assert.equal(
    ownLabel("Pagos · María Fernanda Apaza Quispe", "María Fernanda Apaza Quispe"),
    "Pagos",
  );
  assert.equal(ownLabel("Pagos de María Fernanda", "María Fernanda"), "Pagos");
  assert.equal(ownLabel("María Fernanda: pagos", "María Fernanda"), "pagos");
  assert.equal(ownLabel("Invoices of Acme", "Acme"), "Invoices");
});

test("a crumb whose parent is not in it, or is all of it, is left whole", () => {
  assert.equal(ownLabel("Pagos", "María Fernanda"), "Pagos");
  assert.equal(ownLabel("María Fernanda", "María Fernanda"), "María Fernanda");
  assert.equal(ownLabel("Pagos", undefined), "Pagos");
});

test("the trail keeps its crumbs and their presses; only the words change", () => {
  const press = () => {};
  const trail = ownCrumbs([
    { label: "Pagos", onClick: press },
    { label: "María Fernanda Apaza Quispe", onClick: press },
    { label: "Pagos · María Fernanda Apaza Quispe" },
  ]);
  assert.deepEqual(
    trail.map((c) => c.label),
    ["Pagos", "María Fernanda Apaza Quispe", "Pagos"],
  );
  assert.equal(trail[1]!.onClick, press);
});
