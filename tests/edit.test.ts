import assert from "node:assert/strict";

import {
  adviceAt,
  changesOf,
  entity,
  errorAt,
  errorsByField,
  fieldStateOf,
  type FieldStates,
  historyOf,
  lineStatesOf,
  memoryTransport,
  missingOf,
  pathFor,
  pathOf,
  restTransport,
  writeRoute,
} from "@sincpro/web-framework";
import { test } from "vitest";

import { eventoMeta, servidorVentas } from "../stories/support/servidor";
import { facturaMeta, FACTURAS, facturas } from "../stories/support/ventas";

const factura = FACTURAS[6]!; // draft, cash

test("a hint is evaluated over what is on screen: card makes its reference required", () => {
  const cash = { ...factura, payment: "cash" };
  const card = { ...factura, payment: "card" };
  assert.deepEqual(fieldStateOf(facturaMeta, "card_reference", cash), {
    readonly: false,
    required: false,
    visible: false,
  });
  assert.equal(fieldStateOf(facturaMeta, "card_reference", card).required, true);
  assert.deepEqual(missingOf(facturaMeta, { ...card, card_reference: "" }), [
    "card_reference",
  ]);
});

test("readonly_when: the payment of a posted invoice is not edited", () => {
  assert.equal(fieldStateOf(facturaMeta, "payment", factura).readonly, false);
  assert.equal(
    fieldStateOf(facturaMeta, "payment", { ...factura, state: "posted" }).readonly,
    true,
  );
});

test("the server's word on a field wins over the hint", () => {
  const state = fieldStateOf(facturaMeta, "card_reference", factura, {
    card_reference: { visible: true, required: true },
  });
  assert.deepEqual(state, { readonly: false, required: true, visible: true });
});

test("only what changed travels", () => {
  assert.deepEqual(changesOf(factura, { notes: "x", payment: factura.payment }), {
    notes: "x",
  });
});

test("a field's error is read from the problem's JSON pointer", () => {
  const errors = errorsByField([
    { pointer: "/card_reference", detail: "Falta." },
    { pointer: "/values/notes/0", detail: "Larga." },
  ]);
  assert.deepEqual(errors, { card_reference: "Falta.", "notes/0": "Larga." });
  // A field is invalid when an error points at it or inside it.
  assert.equal(errorAt(errors, "notes"), "Larga.");
  assert.equal(errorAt(errors, "card_reference"), "Falta.");
  assert.equal(errorAt(errors, "discount"), undefined);
});

test("a line's cell error keeps its whole path, from a pointer written as a fragment", () => {
  // sincpro_framework writes `#/values/lines/1/qty` (RFC 6901 as a URI fragment): the "#" used
  // to leave every error under the key "#", and a cell's error fell on the whole field.
  const errors = errorsByField([
    { pointer: "#/values/lines/1/qty", detail: "La cantidad tiene que ser mayor a cero." },
    { pointer: "#/values/discount", detail: "Hasta 50 %." },
    { pointer: "#/values/lines/1/price", detail: "Bajo el costo." },
  ]);
  assert.deepEqual(errors, {
    "lines/1/qty": "La cantidad tiene que ser mayor a cero.",
    discount: "Hasta 50 %.",
    "lines/1/price": "Bajo el costo.",
  });
  assert.equal((errors as Record<string, string>)["#"], undefined);
  assert.equal(errorAt(errors, "lines"), "La cantidad tiene que ser mayor a cero.");
  assert.equal(errorAt(errors, "lines/1"), "La cantidad tiene que ser mayor a cero.");
  assert.equal(errorAt(errors, "lines/0"), undefined);
  // The first word for a place wins; an escaped "/" in a name is read back.
  assert.deepEqual(
    errorsByField([
      { pointer: "#/values/a~1b", detail: "uno" },
      { pointer: "/a~1b", detail: "dos" },
    ]),
    { "a/b": "uno" },
  );
});

test("a warning lands where an error would, by its path or else its field", () => {
  const advice = [
    { message: "Precio bajo el costo", field: "lines", path: ["lines", 1, "price"] },
    { message: "Descuento alto", field: "discount" },
    { message: "Sobre la factura" },
  ];
  assert.equal(pathOf(["lines", 1, "price"]), pathOf("#/values/lines/1/price"));
  assert.deepEqual(
    adviceAt(advice, "lines/1").map((one) => one.message),
    ["Precio bajo el costo"],
  );
  assert.deepEqual(adviceAt(advice, "lines/0"), []);
  assert.deepEqual(
    adviceAt(advice, "discount").map((one) => one.message),
    ["Descuento alto"],
  );
});

test("each line's states are the server's items, by position — never a state of the field", () => {
  const fromServer: FieldStates = {
    lines: {
      required: true,
      items: [{ price: { readonly: true } }, { quantity: { required: true } }],
    },
  };
  assert.deepEqual(fieldStateOf(null, "lines", {}, fromServer), {
    readonly: false,
    required: true,
    visible: true,
  });
  assert.deepEqual(lineStatesOf(fromServer, "lines")[0], { price: { readonly: true } });
  assert.equal(
    fieldStateOf(null, "price", {}, lineStatesOf(fromServer, "lines")[0]).readonly,
    true,
  );
  assert.deepEqual(lineStatesOf(fromServer, "notes"), []);
});

test("a write route says how it is sent, and fills the key", () => {
  assert.deepEqual(writeRoute("POST /facturas/{id}/confirm"), {
    method: "POST",
    path: "/facturas/{id}/confirm",
  });
  assert.equal(pathFor(facturas.commands["anular"]!, "F 1"), "/facturas/F%201/cancel");
  assert.throws(() => entity("a:b", { list: "/b", save: "/b/{id}" }), /METHOD \/path/);
});

test("a history reads the event's own label and says the rest with the events' words", () => {
  const [entry] = historyOf(
    [
      {
        id: "e1",
        created_at: "2026-10-31T12:00:00Z",
        entity_type: "Factura",
        entity_id: "F-1",
        label: { default: "Confirmed", es: "Confirmada" },
        from_state: "Borrador",
        to_state: "Publicada",
      },
    ],
    eventoMeta,
    "es",
  );
  assert.deepEqual(entry, {
    id: "e1",
    label: "Confirmada",
    at: "2026-10-31T12:00:00Z",
    detail: "Antes: Borrador · Ahora: Publicada",
  });
});

test("a fact without a label reads as a change, never as its id", () => {
  const [entry] = historyOf(
    [{ id: "01a18fc5-9e", created_at: "2026-10-31T12:00:00Z", entity_id: "F-1" }],
    eventoMeta,
    "es",
  );
  assert.equal(entry?.label, "Change recorded");
});

test("a Command runs dry first, then for real; a stale save is a 409", async () => {
  const servidor = servidorVentas();
  const transport = memoryTransport(servidor.tables, { handle: servidor.handle });
  const cancel = facturas.commands["anular"]!;
  const rehearsal = await transport.send<{ text: string }>(
    cancel.method,
    pathFor(cancel, "F-2026-0002"),
    {
      dry_run: true,
    },
  );
  assert.match(rehearsal.text, /queda anulada/);
  const one = await transport.one<{ state: string; version: number }>(
    facturas.one("F-2026-0002"),
  );
  assert.notEqual(one.record.state, "cancelled");

  const save = facturas.save!;
  await assert.rejects(
    transport.send(save.method, pathFor(save, "F-2026-0002"), { notes: "x", version: -1 }),
    (error: { status?: number; problem?: { kind?: string } }) =>
      error.status === 409 && error.problem?.kind === "conflict",
  );
});

test("a write travels as JSON with its method", async () => {
  const calls: { method?: string; body?: string; type?: string }[] = [];
  const transport = restTransport({
    fetch: (async (_url: string, init?: RequestInit) => {
      calls.push({
        method: init?.method,
        body: String(init?.body),
        type: (init?.headers as Record<string, string>)["Content-Type"],
      });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch,
  });
  await transport.send("POST", "/facturas/F-1/confirm", { dry_run: true });
  assert.deepEqual(calls, [
    { method: "POST", body: '{"dry_run":true}', type: "application/json" },
  ]);
});
