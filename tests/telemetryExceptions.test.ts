import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { propagation, trace } from "@opentelemetry/api";
import {
  BoundedContext,
  Command,
  configureProcess,
  servicesWith,
  type Tracer,
} from "@sincpro/client-framework";
import { browserTracer } from "@sincpro/web-framework/telemetry";
import {
  configureServerProcess,
  registerServerTracing,
} from "@sincpro/web-framework/telemetry/server";
import { afterAll, beforeAll, beforeEach, test } from "vitest";

/** A span as an OTLP/HTTP collector receives it, with what a failure leaves on it. */
type ExportedSpan = {
  name: string;
  status?: { code?: number; message?: string };
  events?: { name: string }[];
  attributes?: { key: string }[];
};
type Exported = { resourceSpans: { scopeSpans: { spans: ExportedSpan[] }[] }[] };

let server: Server;
let url: string;
const received: Exported[] = [];
beforeAll(
  () =>
    new Promise<void>((ready) => {
      server = createServer((request, response) => {
        let body = "";
        request.on("data", (chunk: Buffer) => (body += chunk.toString()));
        request.on("end", () => {
          received.push(JSON.parse(body) as Exported);
          response.writeHead(200, { "content-type": "application/json" }).end("{}");
        });
      });
      server.listen(0, "127.0.0.1", () => {
        url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1/traces`;
        ready();
      });
    }),
);
beforeEach(() => {
  received.length = 0;
});
afterAll(async () => {
  trace.disable();
  propagation.disable();
  configureProcess();
  delete (globalThis as Record<symbol, unknown>)[
    Symbol.for("@sincpro/web-framework/telemetry/server")
  ];
  await new Promise((closed) => server.close(closed));
});

/** A use case that fails with a message that names a customer. */
type Dependencies = { owed?: string };
const { Feature } = servicesWith<Dependencies, Dependencies>();
class CommandCharge extends Command<null> {}
class Charge extends Feature<CommandCharge, null> {
  execute(): Promise<null> {
    return Promise.reject(new Error("Globex Bolivia owes Bs 12.400"));
  }
}
const billingBoundedContext = new BoundedContext<Dependencies>("billing");
billingBoundedContext.feature(CommandCharge)(Charge);

/** Runs the failing use case, sends what is buffered and finds its span at the collector. */
async function failed(flush: () => Promise<void>): Promise<ExportedSpan> {
  await assert.rejects(billingBoundedContext.execute(new CommandCharge()));
  await flush();
  const spans = received
    .flatMap((sent) => sent.resourceSpans)
    .flatMap((one) => one.scopeSpans.flatMap((scope) => scope.spans))
    .filter((one) => one.name === "billing/Charge");
  assert.equal(spans.length, 1, "one span of the use case");
  return spans[0]!;
}

/** `browserTracer` answers silent spans until its SDK has loaded. */
async function loaded(tracer: Tracer): Promise<void> {
  for (let tries = 0; tries < 200; tries += 1) {
    const probe = tracer.start("probe", {});
    probe.end("ok");
    if (probe.sampled) return;
    await new Promise((later) => setTimeout(later, 10));
  }
  throw new Error("the browser tracer never loaded");
}

test("a browser tracer with recordExceptions: false says a use case failed, never its message", async () => {
  const tracer = browserTracer({ endpoint: url, service: "web", recordExceptions: false });
  await loaded(tracer);
  configureProcess({ tracer });
  const span = await failed(() => tracer.flush());
  assert.equal(span.status?.code, 2, "an ERROR status");
  assert.ok(!span.status?.message, "without the message");
  assert.deepEqual(span.events ?? [], [], "without the exception event");
  assert.ok(
    span.attributes?.some((one) => one.key === "error.type"),
    "error.type kept",
  );
});

test("a browser tracer keeps the exception by default, as client-framework does", async () => {
  const tracer = browserTracer({ endpoint: url, service: "web" });
  await loaded(tracer);
  configureProcess({ tracer });
  const span = await failed(() => tracer.flush());
  assert.ok(span.events?.some((one) => one.name === "exception"));
});

test("a server registered with recordExceptions: false leaves the detail to the error tracker", async () => {
  configureProcess();
  const tracing = await registerServerTracing({
    endpoint: url,
    service: "web-server",
    recordExceptions: false,
  });
  assert.ok(tracing, "tracing is on");
  assert.equal(configureServerProcess({ identity: { release: "web-server:1.0.0" } }), true);
  const span = await failed(() => tracing.flush());
  assert.equal(span.status?.code, 2);
  assert.ok(!span.status?.message);
  assert.deepEqual(span.events ?? [], []);
});
