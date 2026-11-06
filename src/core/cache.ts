import {
  type CallOptions,
  type Entity,
  type Method,
  type One,
  type SendOptions,
  type Transport,
} from "@sincpro/client-framework";
import type { Criteria, Page } from "@sincpro/criteria";

/**
 * A transport that remembers what it read, for a while, and forgets it when something writes.
 *
 * Context: in a workspace the same questions come back all the time — the list you go back to
 * through the breadcrumb, the record reopened from ⌘K, the select that points at the same
 * customers, two panels on the same entity. Each one was a request. This answers a repeated
 * read from memory while it is fresh (`ttl`), and drops every answer of an entity the moment
 * a write touches it: a save, a Command, a draft. Stale data after a write is worse than a
 * request, so a write always wins.
 *
 * What it keys on is the question as it travels — the route and the criteria — so two
 * different filters, orders or pages never share an answer. A read that fails is not kept.
 * Only completed answers are remembered: a request aborted half-way is simply not cached.
 *
 * A write forgets every collection its route NAMES, not only the first: «leave a tenant»
 * (`POST /users/{email}/tenants/{tenant}/leave`) changes the tenant's members as much as the
 * user. And an entity's business events live on a route of their own (`/project-events`): with
 * `entities`, a write under an entity's list also forgets its history.
 *
 *     const transport = cachedTransport(restTransport({ base: "/v1" }), { ttl: 30_000 });
 *     transport.invalidate("/facturas");   // forget an entity by hand (a push from the server)
 */
export type CachedTransport = Transport & {
  /** Forget every answer whose route lies under this path: `"/facturas"` forgets the list,
   *  every page and filter of it, and every record under it — not `"/facturas-events"`. */
  invalidate: (path?: string) => void;
};

export type CacheOptions = {
  /** How long an answer is served from memory, in milliseconds. */
  ttl?: number;
  /** The clock — for tests. */
  now?: () => number;
  /** The application's entities: a write to one also forgets its history route. */
  entities?: readonly Entity[];
};

type Entry = { at: number; answer: unknown };

function pathOf(route: string): string {
  return route.split("?")[0] ?? route;
}

/** `route` is `path` or lies under it: `"/facturas"` holds `"/facturas/F-1"`, never `"/facturas-events"`. */
function under(route: string, path: string): boolean {
  const own = pathOf(route);
  return own === path || own.startsWith(path.endsWith("/") ? path : `${path}/`);
}

/** What a write may have changed: every segment of its route as a collection, and the history
 *  of each entity it writes under. A segment that is a key (`/F-1`) forgets nothing. */
function touchedBy(route: string, entities: readonly Entity[]): string[] {
  const path = pathOf(route);
  const segments = path.split("/").filter((one) => one !== "");
  const history = entities
    .filter((one) => one.history !== undefined && under(path, pathOf(one.list)))
    .map((one) => pathOf(one.history?.route ?? ""));
  return [...segments.map((one) => `/${one}`), ...history];
}

export function cachedTransport(
  transport: Transport,
  options: CacheOptions = {},
): CachedTransport {
  const ttl = options.ttl ?? 30_000;
  const now = options.now ?? (() => Date.now());
  const entries = new Map<string, Entry>();

  async function remembered<A>(key: string, read: () => Promise<A>): Promise<A> {
    const kept = entries.get(key);
    if (kept !== undefined && now() - kept.at < ttl) return kept.answer as A;
    const answer = await read();
    entries.set(key, { at: now(), answer });
    return answer;
  }

  const entities = options.entities ?? [];

  /** Forget every answer under any of `paths` — one walk over the entries, whatever their
   *  number. A path with a query (`/projects?tenant_id=acme`) forgets its whole collection. */
  const forget = (paths: readonly string[]) => {
    const targets = paths.map(pathOf);
    for (const key of [...entries.keys()]) {
      // `list <route> <criteria>` / `one <route>`: the route is the second word.
      const route = key.split(" ", 2)[1] ?? "";
      if (targets.some((path) => under(route, path))) entries.delete(key);
    }
  };

  const invalidate = (path?: string) => {
    if (path === undefined) return entries.clear();
    forget([path]);
  };

  return {
    // A call's own headers (a use case's trace) never change the answer: they travel, and the
    // answer is kept by the question alone.
    list<T>(
      route: string,
      criteria: Criteria<T>,
      signal?: AbortSignal,
      options?: CallOptions,
    ): Promise<Page<T>> {
      return remembered(`list ${route} ${JSON.stringify(criteria)}`, () =>
        transport.list<T>(route, criteria, signal, options),
      );
    },
    one<T>(route: string, signal?: AbortSignal, options?: CallOptions): Promise<One<T>> {
      return remembered(`one ${route}`, () => transport.one<T>(route, signal, options));
    },
    // A read of the context's own (`GET /me`) is not an entity's: no write forgets it, so it is
    // never kept — it goes to the server every time.
    ...(transport.read === undefined
      ? {}
      : {
          read: <T>(route: string, signal?: AbortSignal, options?: CallOptions) =>
            transport.read!<T>(route, signal, options),
        }),
    async send<T>(
      method: Method,
      route: string,
      body: unknown,
      signal?: AbortSignal,
      sending?: SendOptions,
    ) {
      // A preview writes nothing; anything else may have changed what was read.
      const preview = route.endsWith("/preview");
      try {
        return await transport.send<T>(method, route, body, signal, sending);
      } finally {
        // Even a refused write may have changed something (a 409 says someone else did).
        if (!preview) forget(touchedBy(route, entities));
      }
    },
    invalidate,
  };
}
