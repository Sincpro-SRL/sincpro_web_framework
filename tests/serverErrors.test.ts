import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { context, trace } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { TracerProvider } from "@opentelemetry/sdk-trace";
import {
  BoundedContext,
  Command,
  configureProcess,
  restTransport,
  servicesWith,
  type Transport,
} from "@sincpro/client-framework";
import {
  registerServerErrors,
  reportRequestError,
  serverReporter,
} from "@sincpro/web-framework/errors/server";
import { afterAll, beforeAll, beforeEach, test } from "vitest";

/** An event as GlitchTip stores it — the parts these tests read. */
type Received = {
  release?: string;
  environment?: string;
  platform?: string;
  user?: unknown;
  request?: Record<string, unknown>;
  tags?: Record<string, string>;
  contexts?: { trace?: { trace_id?: string; span_id?: string } };
  exception?: {
    values: {
      type?: string;
      value?: string;
      stacktrace?: { frames?: { filename?: string; lineno?: number; in_app?: boolean }[] };
    }[];
  };
};

/** A GlitchTip: it keeps every event an envelope carries, and the raw bodies. */
function glitchtip(): Promise<{
  server: Server;
  dsn: string;
  events: Received[];
  raw: string[];
}> {
  const events: Received[] = [];
  const raw: string[] = [];
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk: Buffer) => (body += chunk.toString()));
    request.on("end", () => {
      raw.push(body);
      // An envelope: a header line, then an item header and its payload, line by line.
      const lines = body.split("\n").filter((line) => line.trim() !== "");
      for (let at = 1; at + 1 < lines.length; at += 2) {
        const item = JSON.parse(lines[at] ?? "{}") as { type?: string };
        if (item.type === "event") events.push(JSON.parse(lines[at + 1] ?? "{}") as Received);
      }
      response.writeHead(200, { "content-type": "application/json" }).end("{}");
    });
  });
  return new Promise((ready) =>
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      ready({ server, dsn: `http://public@127.0.0.1:${port}/1`, events, raw });
    }),
  );
}

/** A bounded context as a server reads it: a use case that breaks, one the server refuses. */
type Dependencies = { transport: Transport };
const { Feature } = servicesWith<Dependencies, Record<string, never>>();

class CommandExplode extends Command<{ ok: boolean }> {}
class Explode extends Feature<CommandExplode, { ok: boolean }> {
  execute(): Promise<{ ok: boolean }> {
    throw new Error("the read broke on the server");
  }
}

class CommandReadMissing extends Command<{ ok: boolean }> {}
class ReadMissing extends Feature<CommandReadMissing, { ok: boolean }> {
  execute() {
    return this.transport.send<{ ok: boolean }>("POST", "/courses/missing", {});
  }
}

const coursesBoundedContext = new BoundedContext<Dependencies>("courses");
coursesBoundedContext.addDependency(
  "transport",
  restTransport({
    base: "http://api.test/v1",
    document: null,
    fetch: () =>
      Promise.resolve(
        Response.json(
          { type: "about:blank", title: "Not found", status: 404, detail: "No such course" },
          { status: 404, headers: { "content-type": "application/problem+json" } },
        ),
      ),
  }),
);
coursesBoundedContext.feature(CommandExplode, { name: "Explode" })(Explode);
coursesBoundedContext.feature(CommandReadMissing, { name: "ReadMissing" })(ReadMissing);

let fake: Awaited<ReturnType<typeof glitchtip>>;
beforeAll(async () => (fake = await glitchtip()));
beforeEach(() => {
  fake.events.length = 0;
  fake.raw.length = 0;
});
afterAll(async () => {
  configureProcess();
  trace.disable();
  context.disable();
  delete (globalThis as Record<symbol, unknown>)[
    Symbol.for("@sincpro/web-framework/errors/server")
  ];
  await new Promise((closed) => fake.server.close(closed));
});

async function sent(): Promise<void> {
  assert.ok(await (await registerServerErrors({ dsn: fake.dsn }))?.flush(2000), "flushed");
}

test("without a DSN reporting stays off: nothing loads, and reporting does nothing", async () => {
  assert.equal(await registerServerErrors({ dsn: undefined }), undefined);
  assert.equal(await registerServerErrors({ dsn: "" }), undefined);
  // Nothing registered: neither reports nor throws.
  serverReporter().report(new Error("nowhere"), {
    useCase: "x",
    traceId: "",
    executionId: "1",
    context: {},
  });
  reportRequestError(new Error("nowhere"), { path: "/" });
});

test("a use case that fails on the server is reported with its real stack, who sent it and its use case", async () => {
  const reporting = await registerServerErrors({
    dsn: fake.dsn,
    release: "cauor-web:1.2.0",
    environment: "test",
  });
  assert.ok(reporting, "reporting is on");
  // Once per process: any later call — another realm — answers the first.
  assert.equal(await registerServerErrors({ dsn: "http://other@elsewhere/9" }), reporting);
  configureProcess({ identity: { release: "cauor-web:1.2.0" }, reporter: serverReporter() });

  await assert.rejects(coursesBoundedContext.execute(new CommandExplode()));
  await sent();

  const [event] = fake.events;
  assert.ok(event, "GlitchTip received the failure");
  assert.equal(fake.events.length, 1);
  assert.equal(event.release, "cauor-web:1.2.0");
  assert.equal(event.environment, "test");
  assert.equal(event.platform, "node");
  assert.equal(event.tags?.["sincpro.use_case"], "courses.Explode");
  const exception = event.exception?.values[0];
  assert.equal(exception?.value, "the read broke on the server");
  const files = (exception?.stacktrace?.frames ?? []).map((frame) => frame.filename ?? "");
  assert.ok(
    files.some((file) => file.includes("serverErrors.test")),
    `the real stack, where it broke: ${files.join(", ")}`,
  );
});

test("a refusal the server explained is not a fault: it is not reported", async () => {
  const refused: unknown = await coursesBoundedContext.execute(new CommandReadMissing()).then(
    () => assert.fail("the server refused it"),
    (error: unknown) => error,
  );
  // Nor when it is what broke a request.
  reportRequestError(refused, {
    method: "GET",
    path: "/cursos/missing",
    route: "/cursos/[id]",
  });
  await sent();
  assert.deepEqual(fake.events, []);
});

test("a request that broke on the server carries the digest the visitor sees, its route and its trace — and nothing private", async () => {
  // What an SSR framework does: the request's span active while it draws.
  const contexts = new AsyncLocalStorageContextManager().enable();
  context.setGlobalContextManager(contexts);
  trace.setGlobalTracerProvider(new TracerProvider());
  const broke = Object.assign(new Error("the page broke while drawing"), {
    digest: "2914071551",
  });
  const request = trace.getTracer("next.js").startActiveSpan("GET /cursos", (span) => {
    reportRequestError(broke, {
      method: "GET",
      path: "/cursos?token=secret-of-a-customer",
      route: "/cursos",
    });
    // Handed over twice — two phases of one render —: reported once.
    reportRequestError(broke, { method: "GET", path: "/cursos", route: "/cursos" });
    span.end();
    return span.spanContext();
  });
  await sent();

  assert.equal(fake.events.length, 1);
  const [event] = fake.events;
  assert.ok(event);
  assert.equal(event.tags?.["digest"], "2914071551");
  assert.equal(event.tags?.["route"], "/cursos");
  assert.equal(event.tags?.["http.method"], "GET");
  assert.equal(event.tags?.["url.path"], "/cursos");
  assert.equal(event.tags?.["trace_id"], request.traceId);
  assert.equal(event.contexts?.trace?.trace_id, request.traceId);
  assert.equal(event.contexts?.trace?.span_id, request.spanId);
  assert.equal(event.exception?.values[0]?.value, "the page broke while drawing");
  assert.equal(event.user, undefined);
  assert.ok(
    fake.raw.every((body) => !body.includes("secret-of-a-customer")),
    "the query never leaves the server",
  );
});

test("a frame of a built file is reported where it was in the source, when Node has its source map", async () => {
  // A server built with its source maps and run with `--enable-source-maps`: Node loads the map
  // of each built file it requires.
  process.setSourceMapsEnabled(true);
  const built = mkdtempSync(join(tmpdir(), "built-"));
  writeFileSync(
    join(built, "page.cjs"),
    'module.exports = function e() { throw new Error("thrown in a built file"); };\n' +
      "//# sourceMappingURL=page.cjs.map\n",
  );
  // Every position of the built line comes from line 10 of the source.
  writeFileSync(
    join(built, "page.cjs.map"),
    JSON.stringify({
      version: 3,
      file: "page.cjs",
      sources: ["app/cursos/page.tsx"],
      names: [],
      mappings: "AASA",
    }),
  );
  const draw = createRequire(import.meta.url)(join(built, "page.cjs")) as () => void;
  let broke: unknown;
  try {
    draw();
  } catch (error) {
    broke = error;
  }
  reportRequestError(broke, { path: "/cursos", route: "/cursos" });
  await sent();

  const frames = fake.events[0]?.exception?.values[0]?.stacktrace?.frames ?? [];
  const top = frames.at(-1);
  assert.ok(
    top?.filename?.endsWith("app/cursos/page.tsx"),
    `the source, not the build: ${top?.filename}`,
  );
  assert.equal(top?.lineno, 10);
  assert.equal(top?.in_app, true);
});
