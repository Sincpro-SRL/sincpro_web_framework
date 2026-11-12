import assert from "node:assert/strict";

import { BIND, memoryTransport, pathFor, type Transport } from "@sincpro/client-framework";
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

test("a write under an entity forgets its history too, wherever its events live", async () => {
  // A record's events on a route of their own, not under the entity's list.
  const elsewhere = { ...facturas, history: "/factura-events/{id}" };
  const { transport, asked } = anyServer({ entities: [elsewhere] });
  await transport.list("/factura-events/F-2026-0007", {});
  const confirm = facturas.commands["confirmar"]!;
  await transport.send(confirm.method, pathFor(confirm, "F-2026-0007"), {});
  await transport.list("/factura-events/F-2026-0007", {});
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

test("a write made elsewhere — a use case's own client — is told with `changed` and forgets the same", async () => {
  const { transport, asked } = anyServer({});
  await transport.list("/issues?project_id=acme", {});
  await transport.list("/projects", {});
  // The write went through another transport; the process's change feed tells the cache.
  transport.changed({ method: "POST", route: "/issues/acme-7/cancel" });
  await transport.list("/issues?project_id=acme", {});
  await transport.list("/projects", {});
  assert.deepEqual(asked, [
    "/issues?project_id=acme",
    "/projects",
    "/issues?project_id=acme",
  ]);
});

test("a dry run through the cache changes nothing, as a preview does", async () => {
  const { transport, asked } = anyServer({});
  await transport.list("/facturas", {});
  await transport.send("POST", "/facturas/F-1/cancel", { dry_run: true });
  await transport.list("/facturas", {});
  assert.equal(asked.length, 1);
});

/** A server whose answers wait until the test lets them go, each read counted. */
function heldServer() {
  const asked: { route: string; signal: AbortSignal | undefined }[] = [];
  const pending: (() => void)[] = [];
  const inner: Transport = {
    list: (route, _criteria, signal) => {
      asked.push({ route, signal });
      return new Promise((answer, refuse) => {
        signal?.addEventListener("abort", () => refuse(signal.reason));
        pending.push(() => answer({ rows: [{ id: asked.length }], meta: null } as never));
      });
    },
    one: async () => ({ record: {} }) as never,
    send: async () => ({}) as never,
  };
  const release = () => {
    for (const answer of pending.splice(0)) answer();
  };
  return { transport: cachedTransport(inner, {}), asked, release };
}

test("the same question asked again while its answer flies joins it: one request", async () => {
  const { transport, asked, release } = heldServer();
  const first = transport.list("/facturas", {});
  const second = transport.list("/facturas", {});
  release();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(asked.length, 1);
  assert.deepEqual(a, b);
});

test("a reader who gives up leaves alone; the last one to leave cancels the request", async () => {
  const { transport, asked, release } = heldServer();
  const leaving = new AbortController();
  const staying = transport.list("/facturas", {}, new AbortController().signal);
  const gone = transport.list("/facturas", {}, leaving.signal);
  leaving.abort();
  await assert.rejects(gone);
  assert.equal(asked[0]?.signal?.aborted, false, "someone still waits: the request goes on");
  release();
  await staying;

  const alone = new AbortController();
  const lonely = transport.list("/clientes", {}, alone.signal);
  alone.abort();
  await assert.rejects(lonely);
  assert.equal(asked[1]?.signal?.aborted, true, "nobody waits: the request is cancelled");
});

test("a write while a read flies: its answer is handed over but never kept", async () => {
  const { transport, asked, release } = heldServer();
  const before = transport.list("/facturas", {});
  await transport.send("POST", "/facturas/F-1/confirm", {});
  const after = transport.list("/facturas", {});
  release();
  await Promise.all([before, after]);
  assert.equal(asked.length, 2, "the reader after the write did not join the old answer");
  await transport.list("/facturas", {});
  assert.equal(asked.length, 2, "the answer read after the write is the one kept");
});

test("a run binds the cache like any transport of the framework", () => {
  const { transport } = anyServer({});
  assert.equal(typeof (transport as unknown as Record<symbol, unknown>)[BIND], "function");
});
