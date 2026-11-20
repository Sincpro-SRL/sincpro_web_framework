import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { context, trace } from "@opentelemetry/api";
import {
  BoundedContext,
  Command,
  configureProcess,
  restTransport,
  servicesWith,
  type Transport,
} from "@sincpro/client-framework";
import {
  configureServerProcess,
  registerServerTracing,
} from "@sincpro/web-framework/telemetry/server";
import { afterAll, beforeAll, test } from "vitest";

/**
 * `oneTreePerRequest`: a page drawn on the server, the use cases it reads and what the API did
 * with them — one trace, as the request the SSR framework traced. A file of its own: what it
 * registers is the process's, once (`serverTelemetry.test.ts` keeps the default).
 */

/** What an OTLP/HTTP collector receives, as JSON: the spans and their parents. */
type Exported = {
  resourceSpans: {
    scopeSpans: {
      spans: { name: string; traceId: string; spanId: string; parentSpanId?: string }[];
    }[];
  }[];
};

function collector(): Promise<{ server: Server; url: string; received: Exported[] }> {
  const received: Exported[] = [];
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk: Buffer) => (body += chunk.toString()));
    request.on("end", () => {
      received.push(JSON.parse(body) as Exported);
      response.writeHead(200, { "content-type": "application/json" }).end("{}");
    });
  });
  return new Promise((ready) =>
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      ready({ server, url: `http://127.0.0.1:${port}/v1/traces`, received });
    }),
  );
}

type Dependencies = { transport: Transport };
const { Feature } = servicesWith<Dependencies, Record<string, never>>();

class CommandReadCourses extends Command<{ next: string[] }> {}

class ReadCourses extends Feature<CommandReadCourses, { next: string[] }> {
  execute() {
    return this.transport.send<{ next: string[] }>("POST", "/courses/search", {});
  }
}

const sentToTheApi: (string | null)[] = [];
const coursesBoundedContext = new BoundedContext<Dependencies>("courses");
coursesBoundedContext.addDependency(
  "transport",
  restTransport({
    base: "http://api.test/v1",
    document: null,
    fetch: (_url, init) => {
      sentToTheApi.push(new Headers(init?.headers).get("traceparent"));
      return Promise.resolve(Response.json({ next: ["C-1"] }));
    },
  }),
);
coursesBoundedContext.feature(CommandReadCourses, { name: "ReadCourses" })(ReadCourses);

let endpoint: Awaited<ReturnType<typeof collector>>;
beforeAll(async () => (endpoint = await collector()));
afterAll(async () => {
  trace.disable();
  context.disable();
  configureProcess();
  delete (globalThis as Record<symbol, unknown>)[
    Symbol.for("@sincpro/web-framework/telemetry/server")
  ];
  await new Promise((closed) => endpoint.server.close(closed));
});

test("with oneTreePerRequest a use case read while a request is drawn is a child of that request", async () => {
  const release = "cauor-web:1.2.0";
  const tracing = await registerServerTracing({
    endpoint: endpoint.url,
    release,
    oneTreePerRequest: true,
  });
  assert.ok(tracing, "tracing is on");
  configureServerProcess({ identity: { release } });

  // What an SSR framework does for each request: a span made active, then the page drawn —
  // with awaits in between, as a render has.
  const request = await trace
    .getTracer("next.js")
    .startActiveSpan("GET /courses", async (span) => {
      await new Promise((later) => setTimeout(later, 5));
      await coursesBoundedContext.execute(new CommandReadCourses());
      span.end();
      return span.spanContext();
    });
  await tracing.flush();

  const spans = endpoint.received.flatMap((sent) =>
    sent.resourceSpans.flatMap((one) => one.scopeSpans.flatMap((scope) => scope.spans)),
  );
  const read = spans.find((one) => one.name === "courses/ReadCourses");
  assert.ok(read, `the use case's span among ${spans.map((one) => one.name).join(", ")}`);
  assert.equal(read.traceId, request.traceId, "the request's trace");
  assert.equal(read.parentSpanId, request.spanId, "under the request's span");
  // And the API continues the same tree.
  assert.deepEqual(sentToTheApi, [`00-${request.traceId}-${read.spanId}-01`]);
});
