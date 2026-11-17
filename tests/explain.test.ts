import assert from "node:assert/strict";

import {
  memoryTransport,
  readRoute,
  restTransport,
  TransportError,
} from "@sincpro/client-framework";
import {
  cachedTransport,
  explain,
  installFrameworkCopy,
  SPANISH_FRAMEWORK_COPY,
} from "@sincpro/web-framework";
import { test } from "vitest";

installFrameworkCopy(SPANISH_FRAMEWORK_COPY);

type Call = { url: string; headers: Record<string, string> };

function server(status: number, body: unknown, calls: Call[]): typeof fetch {
  return (async (url: string, init?: RequestInit) => {
    calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  }) as typeof fetch;
}

test("a refusal is headed in the client's words by its kind, and says what the server said happened", async () => {
  const problem = {
    type: "about:blank",
    // The server's title is one per kind, in English until the language travels at the edge.
    title: "Permission denied",
    status: 403,
    kind: "permission_denied",
    reason: "MISSING_PERMISSION",
    detail: "Ese pago es de otro colegiado.",
    next_step: "ask_for_access",
    guidance: "Ask an administrator for access.",
    retryable: false,
  };
  const transport = restTransport({ fetch: server(403, problem, []) });
  await assert.rejects(transport.list("/projects", {}), (error: unknown) => {
    assert.ok(error instanceof TransportError);
    assert.equal(error.problem?.kind, "permission_denied");
    const told = explain(error);
    assert.equal(told.heading, "No tenés acceso");
    // What happened is the server's; what to do next is the copy's for this kind.
    assert.equal(
      told.sentence,
      "Ese pago es de otro colegiado. Pedí acceso a quien lo administra.",
    );
    assert.equal(told.retryable, false);
    return true;
  });
});

test("a refusal only the use case knows how to fix keeps the server's guidance", async () => {
  const problem = {
    type: "about:blank",
    title: "Refused",
    status: 422,
    kind: "domain",
    reason: "ALREADY_SENT",
    next_step: "fix_input",
    detail: "Ese comprobante ya fue enviado antes.",
    guidance: "Revisá el historial del pago.",
    retryable: false,
  };
  const transport = restTransport({ fetch: server(422, problem, []) });
  await assert.rejects(transport.list("/pagos", {}), (error: unknown) => {
    const told = explain(error);
    assert.equal(told.heading, "La operación fue rechazada");
    assert.equal(
      told.sentence,
      "Ese comprobante ya fue enviado antes. Revisá el historial del pago.",
    );
    return true;
  });
});

test("an answer that is not a problem still says its status", async () => {
  const transport = restTransport({ fetch: server(502, "<html>bad gateway</html>", []) });
  await assert.rejects(transport.list("/projects", {}), (error: unknown) => {
    assert.equal(explain(error).heading, "El servidor respondió 502");
    return true;
  });
});

test("the cache passes a read of the context's own through, and keeps nothing of it", async () => {
  let asked = 0;
  const answering = memoryTransport({}, { read: (route) => ({ route, asked: ++asked }) });
  const cached = cachedTransport(answering, { entities: [] });
  assert.deepEqual(await readRoute(cached, "/me"), { route: "/me", asked: 1 });
  assert.deepEqual(await readRoute(cached, "/me"), { route: "/me", asked: 2 });
});

test("the cache hands a call's own headers to the transport under it, and keeps by the question", async () => {
  const seen: (Record<string, string> | undefined)[] = [];
  const cached = cachedTransport(
    {
      list: async (_route, _criteria, _signal, options) => {
        seen.push(options?.headers as Record<string, string> | undefined);
        return { rows: [], total: 0 } as never;
      },
      one: async () => ({ record: {}, meta: null, dropped: [], draft: null }) as never,
      send: async () => undefined as never,
    },
    { entities: [] },
  );
  await cached.list("/projects", {}, undefined, { headers: { traceparent: "00-a-b-01" } });
  await cached.list("/projects", {}, undefined, { headers: { traceparent: "00-c-d-01" } });
  assert.deepEqual(seen, [{ traceparent: "00-a-b-01" }]);
});
