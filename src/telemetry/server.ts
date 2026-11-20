import type { TraceAPI, Tracer as OpenTelemetryTracer } from "@opentelemetry/api";
import {
  type Attributes,
  configureProcess,
  identityOf,
  NO_TRACER,
  type ProcessOptions,
  type Tracer,
} from "@sincpro/client-framework";
import { tracerResource } from "@sincpro/web-framework/telemetry";

/**
 * The server's side of `./telemetry`: what a server that renders pages — Next.js, TanStack
 * Start, Remix, a Node process of one's own — needs so its use cases are traced like the
 * browser's, and their `traceparent` reaches the API.
 *
 *     // once per process — Next's instrumentation.ts (no Next here: the application wires it)
 *     export async function register() {
 *       if (process.env.NEXT_RUNTIME !== "nodejs") return;
 *       const { registerServerTracing } = await import("@sincpro/web-framework/telemetry/server");
 *       const endpoint = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT; // from its settings
 *       await registerServerTracing({ endpoint, release, environment, oneTreePerRequest: true });
 *     }
 *
 *     // once per realm, where the server runs use cases — a module that reads on the server
 *     configureServerProcess({ identity: { release } });
 *
 * Context: two lifetimes, because a server that renders is one process with several module
 * realms — Next loads instrumentation, its Server Components and its server rendering of Client
 * Components as separate bundles, each with its own copy of this package and of
 * @sincpro/client-framework, so each its own `configureProcess`. What is per PROCESS lives where
 * every realm sees it: OpenTelemetry's global provider (`registerServerTracing`), which the
 * SSR framework's own spans reach too. What is per REALM is the process's configuration
 * (`configureServerProcess`), tracing on that global provider — whoever registered it, this
 * entry or the application's own SDK (`@vercel/otel`, `NodeSDK`).
 *
 * Optional on every count, like `./telemetry`: an entry of its own that nothing else imports,
 * the same optional peers (`@opentelemetry/api`, `@opentelemetry/sdk-trace`,
 * `@opentelemetry/exporter-trace-otlp-http`, `@opentelemetry/resources`, `@opentelemetry/core`, and
 * `@opentelemetry/context-async-hooks` for `oneTreePerRequest`) loaded with `import()`,
 * and nothing throws: without an endpoint nothing loads and nothing is registered; if the SDK
 * is not installed or fails, that is said once on the console and use cases run untraced,
 * sending no `traceparent`. Node only — an edge runtime skips it (its exporter speaks `http`).
 */
export type ServerTracingOptions = {
  /**
   * The OTLP/HTTP traces endpoint (`https://collector.example.com/v1/traces`), from the
   * application's settings. None — an empty setting — and tracing is off: nothing is loaded.
   */
  endpoint: string | undefined;
  /** `<name>:<version>` as deployed, the backend's `APP_RELEASE`: read as `tracerResource` reads it. */
  release?: string;
  /** `service.name`, when it is not the release's name. */
  service?: string;
  /** `deployment.environment.name`: `production`, `staging`… */
  environment?: string;
  /** Headers the endpoint asks for. A secret may go here: it never leaves the server. */
  headers?: Readonly<Record<string, string>>;
  /** Fraction of traces kept, 0 to 1 — a trace begun elsewhere keeps its decision. Default 1. */
  sampling?: number;
  /** More resource attributes (`tenant.group`, …). */
  attributes?: Attributes;
  /**
   * Each request one tree — the request the SSR framework traces, its renders, the use cases a
   * page reads and what the backend did with them. Node's AsyncLocalStorage carries the active
   * span through each request's awaits (registered here, unless the platform registered a
   * context manager of its own first), and a use case run with no parent of its own starts
   * under it (client-framework's `adoptActiveSpan`, 2.5+).
   *
   * Default `false`, as before: a use case's span is the root of its trace. Turning it on loads
   * one more optional peer, `@opentelemetry/context-async-hooks`; if it does not load, that is
   * said once and the rest works as without it.
   */
  oneTreePerRequest?: boolean;
};

/** The process's tracing, once registered. */
export type ServerTracing = {
  /** Sends what is buffered now: a script that ends, a test. */
  flush: () => Promise<void>;
  /** Sends what is buffered and stops: a server shutting down. */
  shutdown: () => Promise<void>;
};

/** What every realm of this process shares, kept where OpenTelemetry keeps its own. */
type Held = {
  /** The first registration — a later call, from any realm, answers it. */
  registered?: Promise<ServerTracing | undefined>;
  /** A tracer over OpenTelemetry's global provider, once its API is loaded. */
  tracerOf?: (name: string) => Tracer;
  /** The first registration asked for one tree per request: use cases start under the active span. */
  adoptActiveSpan?: boolean;
};

const HELD = Symbol.for("@sincpro/web-framework/telemetry/server");

function held(): Held {
  const global = globalThis as { [HELD]?: Held };
  return (global[HELD] ??= {});
}

const WHO = "@sincpro/web-framework/telemetry/server";

/**
 * OpenTelemetry's provider for this server process: OTLP/HTTP to the application's endpoint,
 * resource and sampling as `browserTracer`'s (`tracerResource`), registered GLOBALLY — so the
 * SSR framework's own spans (each request, each render) go there, and every realm's use cases
 * (`configureServerProcess`). Once per process: a second call, from any realm, answers the
 * first's. It answers `undefined` when tracing stays off — no endpoint, the SDK did not load, or
 * another provider was registered first (then use cases trace on THAT one).
 */
export function registerServerTracing(
  options: ServerTracingOptions,
): Promise<ServerTracing | undefined> {
  const endpoint = options.endpoint;
  if (!endpoint) return Promise.resolve(undefined);
  const shared = held();
  if (shared.registered === undefined) {
    // Before the first page: every realm's tracer reads it when it is first asked for.
    shared.adoptActiveSpan = options.oneTreePerRequest === true;
    shared.registered = started({ ...options, endpoint });
  }
  return shared.registered;
}

/** A tracer of client-framework's over OpenTelemetry's, as this process's registration asked. */
function tracerOver(
  trace: TraceAPI,
  overOpenTelemetry: (
    tracer: OpenTelemetryTracer,
    options: { adoptActiveSpan: boolean },
  ) => Tracer,
): (name: string) => Tracer {
  return (name) =>
    overOpenTelemetry(trace.getTracer(name), {
      adoptActiveSpan: held().adoptActiveSpan === true,
    });
}

/**
 * What is active follows each request through its awaits: Node's AsyncLocalStorage, registered
 * with OpenTelemetry's API — unless the platform registered a context manager first, which then
 * carries it.
 */
async function followEachRequest(): Promise<void> {
  try {
    const [{ context }, { AsyncLocalStorageContextManager }] = await Promise.all([
      import("@opentelemetry/api"),
      import("@opentelemetry/context-async-hooks"),
    ]);
    const manager = new AsyncLocalStorageContextManager().enable();
    if (!context.setGlobalContextManager(manager)) manager.disable();
  } catch (error) {
    console.warn(
      `${WHO}: a request is not one tree — @opentelemetry/context-async-hooks did not load`,
      error,
    );
  }
}

async function started(
  options: ServerTracingOptions & { endpoint: string },
): Promise<ServerTracing | undefined> {
  try {
    const [
      { trace, propagation },
      { TracerProvider, BatchSpanProcessor, TraceIdRatioBasedSampler, ParentBasedSampler },
      { OTLPTraceExporter },
      { resourceFromAttributes },
      { W3CTraceContextPropagator },
      { openTelemetryTracer },
    ] = await Promise.all([
      import("@opentelemetry/api"),
      import("@opentelemetry/sdk-trace"),
      import("@opentelemetry/exporter-trace-otlp-http"),
      import("@opentelemetry/resources"),
      import("@opentelemetry/core"),
      import("@sincpro/client-framework/opentelemetry"),
    ]);
    // An SSR framework reads and writes `traceparent` only through the global propagator: with
    // it Next continues a request's incoming trace and can write it into the page
    // (`experimental.clientTraceMetadata`); without one, both are silently nothing. W3C trace
    // context only — no baggage —, unless the platform registered a propagator first.
    propagation.setGlobalPropagator(new W3CTraceContextPropagator());
    if (options.oneTreePerRequest === true) await followEachRequest();
    const exporter = new OTLPTraceExporter({
      url: options.endpoint,
      ...(options.headers ? { headers: { ...options.headers } } : {}),
    });
    const provider = new TracerProvider({
      resource: resourceFromAttributes(tracerResource(options)),
      sampler: new ParentBasedSampler({
        root: new TraceIdRatioBasedSampler(options.sampling ?? 1),
      }),
      spanProcessors: [new BatchSpanProcessor({ exporter })],
    });
    held().tracerOf ??= tracerOver(trace, openTelemetryTracer);
    if (!trace.setGlobalTracerProvider(provider)) {
      await provider.shutdown();
      console.warn(`${WHO}: another provider was registered first — use cases trace on it`);
      return undefined;
    }
    return { flush: () => provider.forceFlush(), shutdown: () => provider.shutdown() };
  } catch (error) {
    console.warn(`${WHO}: tracing is off — OpenTelemetry's SDK did not load`, error);
    return undefined;
  }
}

let loading: Promise<void> | undefined;

/** OpenTelemetry's API, for a realm that did not register the provider itself. */
function loadApi(): Promise<void> {
  loading ??= (async () => {
    try {
      const [{ trace }, { openTelemetryTracer }] = await Promise.all([
        import("@opentelemetry/api"),
        import("@sincpro/client-framework/opentelemetry"),
      ]);
      held().tracerOf ??= tracerOver(trace, openTelemetryTracer);
    } catch (error) {
      console.warn(`${WHO}: tracing is off — @opentelemetry/api did not load`, error);
    }
  })();
  return loading;
}

/**
 * A `Tracer` over the process's OpenTelemetry provider — the loose piece `configureServerProcess`
 * plugs, for an application that calls `configureProcess` itself:
 *
 *     configureProcess({ identity: { release }, tracer: serverTracer({ release }), logger });
 *
 * Context: the provider is the process's, never this tracer's: the one `registerServerTracing`
 * registered, or the application's own SDK. Read synchronously once some realm of the process
 * loaded OpenTelemetry's API — `registerServerTracing` does, before the first page —; until then
 * (a realm that registers nothing, the first moment), use cases run untraced. With no provider
 * registered OpenTelemetry records nothing, so no `traceparent` claims a trace that does not
 * exist.
 */
export function serverTracer(options: { release?: string; service?: string } = {}): Tracer {
  const name =
    options.service ??
    (options.release ? identityOf(options.release).serviceName : undefined) ??
    "unknown_service";
  let ready: Tracer | undefined;
  const now = (): Tracer | undefined => (ready ??= held().tracerOf?.(name));
  if (now() === undefined) void loadApi();
  return {
    start: (span, startOptions) => (now() ?? NO_TRACER).start(span, startOptions),
  };
}

let configured = false;

/**
 * The process configured for the use cases a server runs, once per realm: client-framework's
 * `configureProcess` with these options — `identity`, `reporter`, `logger`, `context`… — and,
 * unless one is given, a tracer on the process's OpenTelemetry provider (`serverTracer`). Every
 * module that reads on the server may call it at its top: the first call in a realm configures,
 * the rest do nothing. In a browser it does nothing — the browser's process is its `main`'s
 * (`browserTracer`) —, so a module the server and the browser both load may call it too. It
 * answers whether this call configured the process.
 *
 *     // domains/common/infrastructure/server.ts — imported where the server reads
 *     configureServerProcess({ identity: { release: "my-web:1.4.0" } });
 *
 * Context: `configureProcess` replaces everything it is given — the context store included —,
 * so a second call per realm would start the process over between two requests. A test that
 * needs its own tracer calls `configureProcess` directly.
 */
export function configureServerProcess(options: ProcessOptions = {}): boolean {
  if (configured || typeof window !== "undefined") return false;
  configured = true;
  configureProcess({
    ...options,
    tracer:
      options.tracer ??
      serverTracer(options.identity ? { release: options.identity.release } : {}),
  });
  return true;
}
