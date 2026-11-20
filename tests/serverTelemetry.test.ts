import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { trace } from "@opentelemetry/api";
import {
  BoundedContext,
  Command,
  configureProcess,
  processIdentity,
  restTransport,
  servicesWith,
  type Transport,
} from "@sincpro/client-framework";
import {
  configureServerProcess,
  registerServerTracing,
} from "@sincpro/web-framework/telemetry/server";
import { afterAll, beforeAll, test } from "vitest";

/** What an OTLP/HTTP collector receives, as JSON: who sent it and its spans. */
type Exported = {
  resourceSpans: {
    resource: { attributes: { key: string; value: { stringValue?: string } }[] };
    scopeSpans: { spans: { name: string; traceId: string; spanId: string }[] }[];
  }[];
};

/** A collector that keeps what it is sent — the endpoint a deployment names. */
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

/** A bounded context as a server reads it: one use case that asks the API. */
type Dependencies = { transport: Transport };
const { Feature } = servicesWith<Dependencies, Record<string, never>>();

class CommandReadCourses extends Command<{ next: string[] }> {}

class ReadCourses extends Feature<CommandReadCourses, { next: string[] }> {
  execute() {
    return this.transport.send<{ next: string[] }>("POST", "/courses/search", {});
  }
}

/** What the API was sent: the `traceparent` of each request. */
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
coursesBoundedContext.feature(CommandReadCourses)(ReadCourses);

let endpoint: Awaited<ReturnType<typeof collector>>;
beforeAll(async () => (endpoint = await collector()));
afterAll(async () => {
  trace.disable();
  configureProcess();
  // OpenTelemetry's and this entry's process-wide state: the test leaves it as it found it.
  delete (globalThis as Record<symbol, unknown>)[
    Symbol.for("@sincpro/web-framework/telemetry/server")
  ];
  await new Promise((closed) => endpoint.server.close(closed));
});

test("in a browser it configures nothing: the browser's process is its main's", () => {
  const global = globalThis as { window?: unknown };
  global.window = {};
  try {
    assert.equal(configureServerProcess({ identity: { release: "cauor-web:1.2.0" } }), false);
    assert.equal(processIdentity(), undefined);
  } finally {
    delete global.window;
  }
});

test("without an endpoint tracing stays off: nothing loads, nothing is registered", async () => {
  assert.equal(await registerServerTracing({ endpoint: undefined }), undefined);
  assert.equal(await registerServerTracing({ endpoint: "" }), undefined);
  assert.equal(trace.getTracer("probe").startSpan("probe").isRecording(), false);
});

test("a use case read on the server is exported with who sent it, and the API continues it", async () => {
  const release = "cauor-web:1.2.0";
  const tracing = await registerServerTracing({
    endpoint: endpoint.url,
    release,
    environment: "test",
  });
  assert.ok(tracing, "tracing is on");
  // Once per process: any later call — another realm, another endpoint — answers the first.
  assert.equal(
    await registerServerTracing({ endpoint: "http://elsewhere/v1/traces" }),
    tracing,
  );
  // Once per realm: the first configures, the rest leave the process as it is.
  assert.equal(configureServerProcess({ identity: { release } }), true);
  assert.equal(configureServerProcess({ identity: { release: "other:9" } }), false);
  assert.equal(processIdentity()?.release, release);

  assert.deepEqual(await coursesBoundedContext.execute(new CommandReadCourses()), {
    next: ["C-1"],
  });
  await tracing.flush();

  const [sent] = endpoint.received;
  assert.ok(sent, "the collector received the trace");
  const resource = Object.fromEntries(
    (sent.resourceSpans[0]?.resource.attributes ?? []).map((one) => [
      one.key,
      one.value.stringValue,
    ]),
  );
  assert.equal(resource["service.name"], "cauor-web");
  assert.equal(resource["service.version"], "1.2.0");
  assert.equal(resource["release"], release);
  assert.equal(resource["deployment.environment.name"], "test");
  const spans = sent.resourceSpans.flatMap((one) =>
    one.scopeSpans.flatMap((scope) => scope.spans),
  );
  const read = spans.find((one) => one.name === "courses/ReadCourses");
  assert.ok(read, `the use case's span among ${spans.map((one) => one.name).join(", ")}`);
  assert.deepEqual(sentToTheApi, [`00-${read.traceId}-${read.spanId}-01`]);
});
