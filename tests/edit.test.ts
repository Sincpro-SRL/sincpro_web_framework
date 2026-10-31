import assert from "node:assert/strict";

import {
  changesOf,
  entity,
  errorsByField,
  fieldStateOf,
  historyOf,
  memoryTransport,
  missingOf,
  pathFor,
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
  assert.deepEqual(
    errorsByField([
      { pointer: "/card_reference", detail: "Falta." },
      { pointer: "/values/notes/0", detail: "Larga." },
    ]),
    { card_reference: "Falta.", notes: "Larga." },
  );
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
