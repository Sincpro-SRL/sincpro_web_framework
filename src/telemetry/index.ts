import {
  type Attributes,
  identityOf,
  type Span,
  type Tracer,
} from "@sincpro/client-framework";

/**
 * A `Tracer` for the browser, built from the application's own settings: OpenTelemetry's SDK
 * exporting OTLP/HTTP to the endpoint the application names.
 *
 *     // the application — domains/common/infrastructure/telemetry.ts
 *     import { browserTracer } from "@sincpro/web-framework/telemetry";
 *     const release = "forge-web:1.4.0";                   // the backend's APP_RELEASE
 *     const tracer = browserTracer({ endpoint: settings.otlp, release });
 *     configureProcess({ identity: { release }, tracer, reporter });   // entrypoints/main.tsx
 *
 * Context: optional on every count. It is an entry of its own that nothing else in this package
 * imports, and its SDK (`@opentelemetry/sdk-trace`, `@opentelemetry/exporter-trace-otlp-http`,
 * `@opentelemetry/resources`, `@opentelemetry/api`) is an optional peer: an application that
 * does not import it installs nothing and ships nothing. It is also only a convenience — an
 * application that wants its own provider builds it and wraps its tracer with
 * `openTelemetryTracer` (`@sincpro/client-framework/opentelemetry`), or hands any object that
 * fulfils the `Tracer` port.
 *
 * Like sincpro_framework's optional extras, it never breaks what it serves: the SDK loads after
 * the first render (`import()`), and until it is there — or if it is not installed, or fails —
 * use cases run untraced and send no `traceparent`; a failure to load is said once on the
 * console. Nothing is registered globally: the provider is this tracer's own.
 */
export type BrowserTracerOptions = {
  /** The application's OTLP/HTTP traces endpoint (`https://collector.example.com/v1/traces`). */
  endpoint: string;
  /**
   * `<name>:<version>` as deployed — the backend's `APP_RELEASE`, the same text
   * `configureProcess({ identity })` takes. The resource's `release`, and `service.name` and
   * `service.version` read out of it with the backend's rules (`identityOf`).
   */
  release?: string;
  /** `service.name`, when it is not the release's name. One of the two is needed. */
  service?: string;
  /** `deployment.environment.name`: `production`, `staging`… */
  environment?: string;
  /** Headers the endpoint asks for. Never a secret: whatever ships to a browser is public. */
  headers?: Readonly<Record<string, string>>;
  /** Fraction of traces kept, 0 to 1. Default 1 — a backoffice is low volume; sample in the
   *  Collector, where a trace is decided whole. */
  sampling?: number;
  /** More resource attributes (`tenant.group`, …). */
  attributes?: Attributes;
};

export type BrowserTracer = Tracer & {
  /** Sends what is buffered now. Called by itself when the page is hidden or left. */
  flush: () => Promise<void>;
};

const SILENT: Span = {
  traceId: "",
  spanId: "",
  sampled: false,
  set: () => undefined,
  end: () => undefined,
};

/**
 * Who sends the traces, with sincpro_framework's keys: `service.name` and `service.version` read
 * out of the release (`sincpro-forge-web:1.4.0` → `sincpro-forge-web`, `1.4.0`), the release
 * itself, the environment and the application's own attributes.
 */
export function tracerResource(options: BrowserTracerOptions): Attributes {
  const identity = options.release ? identityOf(options.release) : undefined;
  return {
    "service.name": options.service ?? identity?.serviceName ?? "unknown_service",
    ...(identity?.serviceVersion ? { "service.version": identity.serviceVersion } : {}),
    ...(identity ? { release: identity.release } : {}),
    ...(options.environment ? { "deployment.environment.name": options.environment } : {}),
    ...options.attributes,
  };
}

export function browserTracer(options: BrowserTracerOptions): BrowserTracer {
  let ready: Tracer | null = null;
  let flush: () => Promise<void> = () => Promise.resolve();

  void (async () => {
    try {
      const [
        { TracerProvider, BatchSpanProcessor, TraceIdRatioBasedSampler, ParentBasedSampler },
        { OTLPTraceExporter },
        { resourceFromAttributes },
        { openTelemetryTracer },
      ] = await Promise.all([
        import("@opentelemetry/sdk-trace"),
        import("@opentelemetry/exporter-trace-otlp-http"),
        import("@opentelemetry/resources"),
        import("@sincpro/client-framework/opentelemetry"),
      ]);
      const exporter = new OTLPTraceExporter({
        url: options.endpoint,
        ...(options.headers ? { headers: { ...options.headers } } : {}),
      });
      const resource = tracerResource(options);
      const provider = new TracerProvider({
        resource: resourceFromAttributes(resource),
        sampler: new ParentBasedSampler({
          root: new TraceIdRatioBasedSampler(options.sampling ?? 1),
        }),
        spanProcessors: [new BatchSpanProcessor({ exporter })],
      });
      ready = openTelemetryTracer(provider.getTracer(String(resource["service.name"])));
      flush = () => provider.forceFlush();
      // A page that is hidden may never come back: what is buffered goes now.
      const leave = () => void flush().catch(() => undefined);
      globalThis.addEventListener?.("pagehide", leave);
      globalThis.document?.addEventListener("visibilitychange", () => {
        if (globalThis.document?.visibilityState === "hidden") leave();
      });
    } catch (error) {
      console.warn(
        "@sincpro/web-framework/telemetry: tracing is off — OpenTelemetry's SDK did not load",
        error,
      );
    }
  })();

  return {
    start: (name, startOptions) =>
      ready === null ? SILENT : ready.start(name, startOptions),
    flush: () => flush(),
  };
}
