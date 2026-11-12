import type { ErrorAbout, ErrorReporter } from "@sincpro/client-framework";

/**
 * An `ErrorReporter` for the browser, built from the application's own settings: a
 * Sentry-compatible client — GlitchTip, where the backend reports too — with the application's
 * DSN.
 *
 *     // the application — domains/common/infrastructure/telemetry.ts
 *     import { glitchtipReporter } from "@sincpro/web-framework/errors";
 *     const reporter = glitchtipReporter({ dsn: settings.glitchtip, release, environment });
 *     configureProcess({ identity: { release }, tracer, reporter });   // entrypoints/main.tsx
 *
 * Context: optional on every count, like `./telemetry`: an entry of its own, `@sentry/browser`
 * an optional peer, and only a convenience — an application with its own client wraps it with
 * `sentryReporter` (`@sincpro/client-framework/sentry`), or hands any `ErrorReporter`.
 *
 * It never breaks what it serves: the SDK loads after the first render; what is reported before
 * it is there waits (a handful), and if it is not installed or fails, reports are dropped and
 * that is said once on the console. Nothing global: no `Sentry.init`, no handlers on `window` —
 * this client is the reporter's own, and only what the process decides is unexpected reaches it.
 *
 * What it sends is narrow by default, because in an ERP a request body is an invoice and a
 * customer: no breadcrumbs or default integrations, and every event leaves without cookies,
 * headers, request bodies, query strings or the user's address. `beforeSend` is the
 * application's, run after that.
 */
export type GlitchtipOptions = {
  /** The application's DSN. Public by nature: it ships to the browser. */
  dsn: string;
  /** `<name>:<version>`, the same text as `configureProcess({ identity })`: GlitchTip's release. */
  release?: string;
  environment?: string;
  /** Fraction of errors sent, 0 to 1. Default 1. */
  sampling?: number;
  /** The application's last word on an event: change it, or answer `null` to drop it. */
  beforeSend?: (event: SentEvent) => SentEvent | null;
};

/** The parts of an event this reporter narrows; the rest passes as the SDK built it. */
export type SentEvent = {
  request?: {
    url?: string;
    cookies?: unknown;
    headers?: unknown;
    data?: unknown;
    query_string?: unknown;
  };
  user?: unknown;
  [key: string]: unknown;
};

const WAITING_AT_MOST = 20;

/** Every event leaves without what may carry a person's or a customer's data. */
function narrowed(event: SentEvent): SentEvent {
  const { user: _user, ...rest } = event;
  if (rest.request === undefined) return rest;
  const { cookies: _c, headers: _h, data: _d, query_string: _q, ...request } = rest.request;
  return {
    ...rest,
    request: { ...request, ...(request.url ? { url: request.url.split("?")[0] } : {}) },
  };
}

export function glitchtipReporter(options: GlitchtipOptions): ErrorReporter {
  let ready: ErrorReporter | null = null;
  let failed = false;
  const waiting: [unknown, ErrorAbout][] = [];

  void (async () => {
    try {
      const [sentry, { sentryReporter }] = await Promise.all([
        import("@sentry/browser"),
        import("@sincpro/client-framework/sentry"),
      ]);
      const client = new sentry.BrowserClient({
        dsn: options.dsn,
        transport: sentry.makeFetchTransport,
        stackParser: sentry.defaultStackParser,
        integrations: [],
        ...(options.release ? { release: options.release } : {}),
        ...(options.environment ? { environment: options.environment } : {}),
        ...(options.sampling === undefined ? {} : { sampleRate: options.sampling }),
        beforeSend: (event) => {
          const own = narrowed(event as unknown as SentEvent);
          const kept = options.beforeSend ? options.beforeSend(own) : own;
          return kept as unknown as typeof event | null;
        },
      });
      client.init();
      ready = sentryReporter(client);
      for (const [error, about] of waiting.splice(0)) ready.report(error, about);
    } catch (error) {
      failed = true;
      waiting.length = 0;
      console.warn(
        "@sincpro/web-framework/errors: error reporting is off — @sentry/browser did not load",
        error,
      );
    }
  })();

  return {
    report(error, about) {
      if (ready !== null) return ready.report(error, about);
      if (!failed && waiting.length < WAITING_AT_MOST) waiting.push([error, about]);
    },
  };
}
