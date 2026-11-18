import assert from "node:assert/strict";

import { facetsOf, modelOf } from "@sincpro/web-framework";
import { test } from "vitest";

import { inscripcionMeta } from "../stories/support/colegio";
import { pagoMeta } from "../stories/support/pagos";

const ids = (facets: readonly { id: string }[]) => facets.map((one) => one.id);

test("a typed text is offered where the entity's search template looks — never every text field", () => {
  assert.deepEqual(ids(facetsOf(inscripcionMeta, "es")), ["nombres", "ci"]);
});

test("the screen names where a typed text is looked for, in its order", () => {
  assert.deepEqual(ids(facetsOf(inscripcionMeta, "es", ["curso_titulo", "nombres"])), [
    "curso_titulo",
    "nombres",
  ]);
  assert.deepEqual(
    facetsOf(inscripcionMeta, "es", ["curso_titulo"]).map((one) => one.label),
    ["Curso"],
  );
});

test("without a search template, the display field alone", () => {
  const { search: _search, ...sinPlantilla } = inscripcionMeta;
  assert.deepEqual(ids(facetsOf(sinPlantilla, "es")), ["nombres"]);
});

test("the bar's model keeps only the text fields it offers; the builder's keeps them all", () => {
  const bar = modelOf(inscripcionMeta, "es", ["nombres", "ci"]);
  assert.deepEqual(Object.keys(bar.fields), ["nombres", "ci"]);
  assert.deepEqual(Object.keys(modelOf(inscripcionMeta, "es").fields).length, 7);
  // A choice, a number, a date, a yes/no stay: they are asked as questions, not typed into.
  const pagos = modelOf(pagoMeta, "es", ["concepto"]);
  for (const kept of ["concepto", "estado", "monto", "urgente", "enviado_el"])
    assert.ok(kept in pagos.fields, kept);
  assert.ok(!("colegiado" in pagos.fields));
});
