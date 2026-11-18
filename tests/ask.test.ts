import assert from "node:assert/strict";

import { askFormOf } from "@sincpro/web-framework";
import { test } from "vitest";

import { cuentaMeta } from "../stories/support/colegio";

const cuenta = { id: "C-01", nombre: "Lucía Choque", areas: ["CONTROL_PAGOS"] };

test("an asked field reads as the record's field of that name, filled from the record", () => {
  const form = askFormOf(["areas"], { meta: cuentaMeta, locale: "es", record: cuenta });
  assert.deepEqual(
    form.fields.map((one) => [one.name, one.label, one.labelled]),
    [["areas", "Áreas", true]],
  );
  assert.deepEqual(form.initial, { areas: ["CONTROL_PAGOS"] });
});

test("the record's key is never asked: the action already knows whose record it is", () => {
  const form = askFormOf(["id", "nombre"], { meta: cuentaMeta, record: cuenta });
  assert.deepEqual(
    form.fields.map((one) => one.name),
    ["nombre"],
  );
});

test("a field the entity does not have is the action's own, drawn by its label", () => {
  const form = askFormOf([{ name: "motivo", label: "Motivo", widget: "textarea" }], {
    meta: cuentaMeta,
    record: cuenta,
  });
  assert.deepEqual(
    form.fields.map((one) => [one.name, one.label, one.labelled]),
    [["motivo", "Motivo", false]],
  );
  assert.deepEqual(form.initial, {});
});
