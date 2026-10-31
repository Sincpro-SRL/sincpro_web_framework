import assert from "node:assert/strict";

import { summaryOf, textOf } from "@sincpro/web-framework";
import { test } from "vitest";

import {
  contactoMeta,
  CONTACTOS,
  contactos,
  notaMeta,
  NOTAS,
  productoMeta,
  PRODUCTOS,
  productos,
} from "../stories/support/contactos";
import { facturaMeta, FACTURAS } from "../stories/support/ventas";

const [andina, maria] = CONTACTOS as [(typeof CONTACTOS)[0], (typeof CONTACTOS)[0]];

test("a record that has every part under its conventional name says all of them", () => {
  const summary = summaryOf(contactoMeta, andina, {
    fields: contactos.summary,
    locale: "es",
  });
  assert.equal(summary.id, "P-001");
  assert.equal(summary.name, "Distribuidora Andina S.R.L.");
  assert.equal(summary.description, andina.description);
  // A choice reads as the word the model gives it, never its value.
  assert.equal(summary.state, "Activo");
  assert.equal(summary.type, "Empresa");
  assert.equal(summary.image, andina.image);
  assert.equal(summary.person, true);
  assert.deepEqual(summary.updated, {
    at: textOf(contactoMeta, "updated_at", andina.updated_at, "es"),
    by: "Luis Pérez",
  });
});

test("what a record does not have is null, so nothing is drawn for it", () => {
  const summary = summaryOf(contactoMeta, maria, { locale: "es" });
  assert.equal(summary.description, null);
  assert.equal(summary.image, null);
  assert.deepEqual(summary.updated, { at: null, by: null });
  assert.equal(summary.created.by, "Ana Rojas");
});

test("an entity names its own fields when they are not the conventional ones", () => {
  const [cemento] = PRODUCTOS;
  const summary = summaryOf(productoMeta, cemento!, {
    fields: productos.summary,
    locale: "es",
  });
  assert.equal(summary.id, "CEM-50", "the identity the model declares");
  assert.equal(summary.name, "Cemento 50 kg", "the display the model declares");
  assert.equal(summary.state, "Agotado");
  assert.equal(summary.description, "Vuelve a llegar el lunes.");
  assert.equal(summary.image, cemento!.picture);
  assert.equal(summary.person, false);
});

test("a record with only a name is only its name", () => {
  const summary = summaryOf(notaMeta, NOTAS[0]!);
  assert.deepEqual(summary, {
    id: "N-001",
    name: "Llamar el martes",
    description: null,
    state: null,
    type: null,
    image: null,
    person: false,
    created: { at: null, by: null },
    updated: { at: null, by: null },
  });
});

test("a field the model does not declare is not guessed from the record", () => {
  // The invoice row carries no `status`, and its model has `state` — a choice with words.
  const summary = summaryOf(facturaMeta, FACTURAS[2]!, { locale: "es" });
  assert.equal(summary.name, "F-2026-0003");
  assert.equal(summary.state, "Pagada");
  assert.equal(
    summary.created.at,
    textOf(facturaMeta, "created_at", FACTURAS[2]!.created_at, "es"),
  );
  assert.equal(summary.updated.at, null, "the model has no updated_at");
});

test("without a model, the record's own keys are read", () => {
  const summary = summaryOf(null, { id: "x-1", name: "Algo", status: "abierto" });
  assert.equal(summary.name, "Algo");
  assert.equal(summary.state, "abierto");
});

test("a record whose display is empty is called by its identity", () => {
  assert.equal(summaryOf(notaMeta, { id: "N-9", name: "" }).name, "N-9");
});
