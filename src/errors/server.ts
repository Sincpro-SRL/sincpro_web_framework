import type {
  BaseTransportOptions,
  Client,
  createTransport,
  TransportRequest,
} from "@sentry/core";
import { type ErrorReporter, outcomeOf } from "@sincpro/client-framework";
import { narrowed, type SentEvent } from "@sincpro/web-framework/errors/narrowed";

/**
 * The server's side of `./errors`: what a server that renders pages — Next.js, TanStack Start,
 * Remix, a Node process of one's own — needs so what fails there reaches GlitchTip like what
 * fails in the browser and in the backend.
 *
 *     // once per process — Next's instrumentation.ts (no Next here: the application wires it)
 *     export async function register() {
 *       if (process.env.NEXT_RUNTIME !== "nodejs") return;
 *       const { registerServerErrors } = await import("@sincpro/web-framework/errors/server");
 *       await registerServerErrors({ dsn: process.env.SENTRY_DSN, release, environment });
 *     }
 *
 *     // a request that failed on the server: the page that broke while drawing
 *     export async function onRequestError(error, request, context) {
 *       const { reportRequestError } = await import("@sincpro/web-framework/errors/server");
 *       reportRequestError(error, { method: request.method, path: request.path, route: context.routePath });
 *     }
 *
 *     // once per realm, where the server runs use cases
 *     configureServerProcess({ identity: { release }, reporter: serverReporter() });
 *
 * Context: one client per PROCESS, kept on `globalThis`, because a server that renders loads
 * this package once per realm (Next: instrumentation, Server Components, the server render of
 * Client Components) and every realm reports through the one `register` built. The client is
 * `@sentry/core`'s server client — not `@sentry/node`, which sets up its own OpenTelemetry,
 * instrumentation and bundler plugins and would clash with `./telemetry/server`. Nothing global
 * besides it: no `Sentry.init`, no handlers on `process`; only what the process decides is
 * unexpected, and the requests the application hands over, reach it.
 *
 * A request's report carries the `digest` — the code the visitor's `RouteError` shows and the
 * browser's own report carries —, the route and the active span's trace: the three reports of
 * one failure (browser, server, trace) find each other. A use case that failed and also broke
 * the page is two events of one issue — the use case's and the request's —, in one trace.
 *
 * Optional on every count, like `./errors`: an entry of its own that nothing else imports,
 * `@sentry/core` an optional peer loaded with `import()`, and nothing throws: without a DSN
 * nothing loads; if the SDK does not load, that is said once and reports are dropped. What it
 * sends is narrowed as the browser's: no cookies, headers, bodies, query strings or the person.
 */
export type ServerErrorsOptions = {
  /** The application's DSN, from its settings. None — an empty setting — and reporting is off. */
  dsn: string | undefined;
  /** `<name>:<version>` as deployed, the same text as `configureProcess({ identity })`. */
  release?: string;
  /** `production`, `staging`… */
  environment?: string;
  /** Fraction of errors sent, 0 to 1. Default 1. */
  sampling?: number;
  /** The application's last word on an event: change it, or answer `null` to drop it. */
  beforeSend?: (event: SentEvent) => SentEvent | null;
};

/** The process's reporting, once registered. */
export type ServerErrors = {
  /** Sends what is queued now: a script that ends, a test. */
  flush: (timeoutMs?: number) => Promise<boolean>;
  /** Sends what is queued and stops: a server shutting down. */
  close: (timeoutMs?: number) => Promise<boolean>;
};

/** What a failed request was, for its report — never its headers, cookies, body or query. */
export type FailedRequest = {
  /** The code the SSR framework gave the failure (Next's `digest`); read from the error if absent. */
  digest?: string;
  method?: string;
  /** The path asked for; its query string is dropped. */
  path?: string;
  /** The route that drew it (`/cursos/[id]`). */
  route?: string;
};

type SpanReader = {
  getActiveSpan(): { spanContext(): { traceId: string; spanId: string } } | undefined;
};

/** What every realm of this process shares, kept where the SDKs keep theirs. */
type Held = {
  registered?: Promise<ServerErrors | undefined>;
  client?: Client;
  reporter?: ErrorReporter;
  /** OpenTelemetry's API, when the application has it: the trace a request failed in. */
  spans?: SpanReader;
};

const HELD = Symbol.for("@sincpro/web-framework/errors/server");
const WHO = "@sincpro/web-framework/errors/server";

function held(): Held {
  const global = globalThis as { [HELD]?: Held };
  return (global[HELD] ??= {});
}

/**
 * The process's error reporting: a Sentry-compatible client — GlitchTip — with the application's
 * DSN, kept for every realm. Once per process: a second call, from any realm, answers the
 * first's. It answers `undefined` when reporting stays off — no DSN, or the SDK did not load.
 */
export function registerServerErrors(
  options: ServerErrorsOptions,
): Promise<ServerErrors | undefined> {
  const dsn = options.dsn;
  if (!dsn) return Promise.resolve(undefined);
  const shared = held();
  shared.registered ??= started({ ...options, dsn });
  return shared.registered;
}

/** A transport over `fetch` — Node 18+, an edge runtime, Bun: whatever the server runs on. */
function overFetch(transportOver: typeof createTransport) {
  return (transportOptions: BaseTransportOptions) =>
    transportOver(transportOptions, async (request: TransportRequest) => {
      const response = await fetch(transportOptions.url, {
        method: "POST",
        body: request.body as BodyInit,
        ...(transportOptions.headers ? { headers: transportOptions.headers } : {}),
      });
      return {
        statusCode: response.status,
        headers: {
          "x-sentry-rate-limits": response.headers.get("X-Sentry-Rate-Limits"),
          "retry-after": response.headers.get("Retry-After"),
        },
      };
    });
}

/** Node's reading of a built file's source map (`node:module`), when it loaded one. */
type FindSourceMap = (path: string) =>
  | {
      findOrigin(
        line: number,
        column: number,
      ): { fileName?: string; lineNumber?: number; columnNumber?: number };
    }
  | undefined;

type Frame = {
  filename?: string;
  abs_path?: string;
  lineno?: number;
  colno?: number;
  in_app?: boolean;
};

/**
 * Each frame where it was in the source — `app/cursos/page.tsx:12:7`, not a built bundle's
 * `page.js:1:4313` —, when the built file has a source map Node loaded (the server built with
 * its source maps, Node run with `--enable-source-maps`). An SSR framework may print its stacks
 * mapped and still hand over an error whose `stack` is not (Next replaces Node's formatter): the
 * report is mapped here, with nothing uploaded anywhere.
 */
function readable(event: SentEvent, findSourceMap: FindSourceMap | undefined): SentEvent {
  if (findSourceMap === undefined) return event;
  const exception = event["exception"] as
    { values?: { stacktrace?: { frames?: Frame[] } }[] } | undefined;
  for (const value of exception?.values ?? []) {
    for (const frame of value.stacktrace?.frames ?? []) {
      const file = (frame.abs_path ?? frame.filename)?.replace(/^file:\/\//, "");
      if (!file || frame.lineno === undefined || frame.colno === undefined) continue;
      let origin:
        ReturnType<NonNullable<ReturnType<FindSourceMap>>["findOrigin"]> | undefined;
      try {
        origin = findSourceMap(file)?.findOrigin(frame.lineno, frame.colno);
      } catch {
        continue;
      }
      if (!origin?.fileName || origin.lineNumber === undefined) continue;
      frame.filename = origin.fileName;
      frame.abs_path = origin.fileName;
      frame.lineno = origin.lineNumber;
      if (origin.columnNumber !== undefined) frame.colno = origin.columnNumber;
      frame.in_app = !origin.fileName.includes("node_modules");
    }
  }
  return event;
}

async function started(
  options: ServerErrorsOptions & { dsn: string },
): Promise<ServerErrors | undefined> {
  try {
    const [core, { ServerRuntimeClient, nodeStackLineParser }, { sentryReporter }] =
      await Promise.all([
        import("@sentry/core"),
        import("@sentry/core/server"),
        import("@sincpro/client-framework/sentry"),
      ]);
    const runtime = (globalThis as { process?: { version?: string } }).process?.version;
    // An edge runtime has no `node:module`: its frames stay as they are.
    // A bundler may hand a builtin over as its `default` (webpack does).
    const findSourceMap = await import("node:module").then(
      (module) =>
        (module.findSourceMap ??
          (module as { default?: { findSourceMap?: FindSourceMap } }).default
            ?.findSourceMap) as FindSourceMap | undefined,
      () => undefined,
    );
    const client = new ServerRuntimeClient({
      dsn: options.dsn,
      transport: overFetch(core.createTransport),
      stackParser: core.createStackParser(nodeStackLineParser()),
      integrations: [],
      platform: "node",
      runtime: { name: "node", ...(runtime ? { version: runtime } : {}) },
      ...(options.release ? { release: options.release } : {}),
      ...(options.environment ? { environment: options.environment } : {}),
      ...(options.sampling === undefined ? {} : { sampleRate: options.sampling }),
      beforeSend: (event) => {
        const own = narrowed(readable(event as unknown as SentEvent, findSourceMap));
        const kept = options.beforeSend ? options.beforeSend(own) : own;
        return kept as unknown as typeof event | null;
      },
    });
    client.init();
    const shared = held();
    shared.client = client;
    shared.reporter = sentryReporter(client);
    shared.spans = await import("@opentelemetry/api").then(
      ({ trace }) => trace,
      () => undefined,
    );
    return {
      flush: async (timeoutMs) => client.flush(timeoutMs),
      close: async (timeoutMs) => client.close(timeoutMs),
    };
  } catch (error) {
    console.warn(`${WHO}: error reporting is off — @sentry/core did not load`, error);
    return undefined;
  }
}

/**
 * An `ErrorReporter` over the process's client — what `configureServerProcess({ reporter })`
 * plugs, so a use case that fails unexpectedly on the server is reported with its trace, as
 * the browser's are. Before `registerServerErrors` (or without a DSN) it reports nothing.
 */
export function serverReporter(): ErrorReporter {
  return { report: (error, about) => held().reporter?.report(error, about) };
}

function digestOf(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("digest" in error)) return undefined;
  const digest = (error as { digest: unknown }).digest;
  return typeof digest === "string" && digest !== "" ? digest : undefined;
}

/**
 * A request that failed on the server — a page that broke while drawing —, reported with what
 * finds it again: its `digest`, its route, its method and path (without the query), and
 * the trace it failed in. What the server already explained (a refusal, a cancellation) is not
 * a fault and is not reported. One error handed over twice (two phases of one render) is one
 * event: the client marks what it captured. Before `registerServerErrors` (or without a DSN) it
 * does nothing.
 */
export function reportRequestError(error: unknown, request: FailedRequest = {}): void {
  const shared = held();
  const client = shared.client;
  if (client === undefined) return;
  try {
    if (outcomeOf(error) !== "failed") return;
  } catch {
    // An outcome that cannot be told is a failure.
  }
  const digest = request.digest ?? digestOf(error);
  const path = request.path?.split("?")[0];
  const span = shared.spans?.getActiveSpan()?.spanContext();
  client.captureException(error, {
    captureContext: {
      tags: {
        "sincpro.layer": "request",
        ...(digest ? { digest } : {}),
        ...(request.route ? { route: request.route } : {}),
        ...(request.method ? { "http.method": request.method } : {}),
        ...(path ? { "url.path": path } : {}),
        ...(span ? { trace_id: span.traceId } : {}),
      },
      ...(span
        ? { contexts: { trace: { trace_id: span.traceId, span_id: span.spanId } } }
        : {}),
    },
  });
}
