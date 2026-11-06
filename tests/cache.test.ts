import assert from "node:assert/strict";

import { memoryTransport, pathFor, type Transport } from "@sincpro/client-framework";
import { cachedTransport, type CacheOptions } from "@sincpro/web-framework";
import { test } from "vitest";

import { servidorVentas } from "../stories/support/servidor";
import { facturas } from "../stories/support/ventas";

function counted() {
  const servidor = servidorVentas();
  let reads = 0;
  const inner = memoryTransport(servidor.tables, {
    handle: servidor.handle,
    observe: () => void (reads += 1),
  });
  let clock = 0;
  const transport = cachedTransport(inner, { ttl: 1000, now: () => clock });
  return { transport, reads: () => reads, tick: (ms: number) => void (clock += ms) };
}

test("the same question while fresh is answered from memory", async () => {
  const { transport, reads } = counted();
  await transport.list("/facturas", { pagination: { limit: 5 } });
  await transport.list("/facturas", { pagination: { limit: 5 } });
  assert.equal(reads(), 1);
  await transport.list("/facturas", { pagination: { limit: 6 } });
  assert.equal(reads(), 2, "another question is another answer");
});

test("an answer older than its ttl is asked again", async () => {
  const { transport, reads, tick } = counted();
  await transport.list("/facturas", {});
  tick(1001);
  await transport.list("/facturas", {});
  assert.equal(reads(), 2);
});

test("a write forgets what was read of that entity, and only of it", async () => {
  const { transport, reads } = counted();
  await transport.list("/facturas", {});
  await transport.list("/clientes", {});
  const confirm = facturas.commands["confirmar"]!;
  await transport.send(confirm.method, pathFor(confirm, "F-2026-0007"), {});
  await transport.list("/facturas", {});
  await transport.list("/clientes", {});
  assert.equal(reads(), 3, "facturas read again, clientes still remembered");
  const one = await transport.one<{ state: string }>(facturas.one("F-2026-0007"));
  assert.equal(one.record.state, "posted", "the record read after the write is the new one");
});

test("a refused write also forgets: a 409 says someone else changed it", async () => {
  const { transport, reads } = counted();
  await transport.list("/facturas", {});
  const save = facturas.save!;
  await assert.rejects(
    transport.send(save.method, pathFor(save, "F-2026-0007"), { version: -1 }),
  );
  await transport.list("/facturas", {});
  assert.equal(reads(), 2);
});

test("a preview writes nothing and forgets nothing", async () => {
  const { transport, reads } = counted();
  await transport.list("/facturas", {});
  const preview = facturas.preview!;
  await transport.send(preview.method, preview.path, { values: {} });
  await transport.list("/facturas", {});
  assert.equal(reads(), 1);
});

/** Any route answers: what is counted is which questions reached the server. */
function anyServer(options: CacheOptions) {
  const asked: string[] = [];
  const inner: Transport = {
    list: async (route) => {
      asked.push(route);
      return { rows: [], meta: null } as never;
    },
    one: async (route) => {
      asked.push(route);
      return { record: {} } as never;
    },
    send: async () => ({}) as never,
  };
  return { transport: cachedTransport(inner, options), asked };
}

test("a write forgets every collection its route names, not only the first", async () => {
  const { transport, asked } = anyServer({});
  await transport.list("/tenants/acme/members", {});
  await transport.list("/projects", {});
  await transport.send("POST", "/users/ana@x.bo/tenants/acme/leave", {});
  await transport.list("/tenants/acme/members", {});
  await transport.list("/projects", {});
  assert.deepEqual(asked, ["/tenants/acme/members", "/projects", "/tenants/acme/members"]);
});

test("a write under an entity forgets its history too", async () => {
  const { transport, asked } = anyServer({ entities: [facturas] });
  await transport.list("/ventas-events", {});
  const confirm = facturas.commands["confirmar"]!;
  await transport.send(confirm.method, pathFor(confirm, "F-2026-0007"), {});
  await transport.list("/ventas-events", {});
  assert.equal(asked.length, 2, "the events were asked again");
});

test("forgetting a collection keeps its namesakes: /facturas is not /facturas-events", async () => {
  const { transport, asked } = anyServer({});
  await transport.list("/facturas-events", {});
  transport.invalidate("/facturas");
  await transport.list("/facturas-events", {});
  assert.equal(asked.length, 1);
});

test("forgetting a list route with its params forgets that collection", async () => {
  const { transport, asked } = anyServer({});
  await transport.list("/projects?tenant_id=acme", {});
  transport.invalidate("/projects?tenant_id=acme");
  await transport.list("/projects?tenant_id=acme", {});
  assert.equal(asked.length, 2, "the list was asked again");
});
