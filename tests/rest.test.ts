import assert from "node:assert/strict";

import { criteria, plain } from "@sincpro/criteria";
import {
  entity,
  explain,
  installFrameworkCopy,
  restTransport,
  SPANISH_FRAMEWORK_COPY,
  TransportError,
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

const PAGE = {
  projects: [{ id: "odoo-acme" }],
  cursor: null,
  count: { value: 1, exact: true },
  entity_meta_data: null,
  dropped: [],
};

test("the criteria joins a route that already has its own query", async () => {
  const calls: Call[] = [];
  const transport = restTransport({ base: "/v1", fetch: server(200, PAGE, calls) });
  await transport.list("/projects?tenant_id=acme", plain(criteria().limit(5)));
  const url = calls[0]?.url ?? "";
  assert.ok(url.startsWith("/v1/projects?tenant_id=acme&criteria="), url);
});

test("the criteria travels as plain JSON — what the framework's REST entrypoint reads", async () => {
  const calls: Call[] = [];
  const transport = restTransport({ fetch: server(200, PAGE, calls) });
  await transport.list("/projects", plain(criteria().where(["id", "=", "x"])));
  const sent = new URL(calls[0]?.url ?? "", "http://x").searchParams.get("criteria") ?? "";
  assert.deepEqual(JSON.parse(sent).where, { field: "id", operator: "=", value: "x" });
});

test("the records come out of the field named after them", async () => {
  const transport = restTransport({ fetch: server(200, PAGE, []) });
  const page = await transport.list("/projects", {});
  assert.deepEqual(page.rows, [{ id: "odoo-acme" }]);
});

test("one record is the answer's own field; the envelope is left out", async () => {
  const answer = { tenant: { id: "acme" }, entity_meta_data: null, dropped: [], draft: null };
  const transport = restTransport({ fetch: server(200, answer, []) });
  const one = await transport.one(entity("auth:tenant", { list: "/tenants" }).one("acme"));
  assert.deepEqual(one.record, { id: "acme" });
});

test("headers are asked for on every call: a token that rotates", async () => {
  const calls: Call[] = [];
  let token = "a";
  const transport = restTransport({
    fetch: server(200, PAGE, calls),
    headers: () => ({ Authorization: `Bearer ${token}` }),
  });
  await transport.list("/projects", {});
  token = "b";
  await transport.list("/projects", {});
  assert.deepEqual(
    calls.map((c) => c.headers["Authorization"]),
    ["Bearer a", "Bearer b"],
  );
});

test("a refusal carries the server's problem, and reads as its guidance", async () => {
  const problem = {
    type: "about:blank",
    title: "Sin permiso",
    status: 403,
    kind: "permission_denied",
    reason: "MISSING_PERMISSION",
    next_step: "ask_for_access",
    guidance: "Pedí acceso al administrador.",
    retryable: false,
  };
  const transport = restTransport({ fetch: server(403, problem, []) });
  await assert.rejects(transport.list("/projects", {}), (error: unknown) => {
    assert.ok(error instanceof TransportError);
    assert.equal(error.problem?.kind, "permission_denied");
    const told = explain(error);
    assert.equal(told.heading, "Sin permiso");
    assert.equal(told.sentence, "Pedí acceso al administrador.");
    assert.equal(told.retryable, false);
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

test("an entity is domain:kind, and its record lives under its list", () => {
  const invoices = entity("billing:invoice", { list: "/invoices" });
  assert.equal(invoices.one("F 1"), "/invoices/F%201");
  assert.throws(() => entity("invoice", { list: "/invoices" }), /domain:kind/);
});
