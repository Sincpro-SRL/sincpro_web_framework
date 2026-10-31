import type { Criteria, Page } from "@sincpro/criteria";
import type { Method, One, Transport } from "@sincpro/web-framework/core/transport";

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
 *     const transport = cachedTransport(restTransport({ base: "/v1" }), { ttl: 30_000 });
 *     transport.invalidate("/facturas");   // forget an entity by hand (a push from the server)
 */
export type CachedTransport = Transport & {
  /** Forget every answer whose route starts with this path: `"/facturas"` forgets the list,
   *  every page and filter of it, and every record under it. */
  invalidate: (path?: string) => void;
};

export type CacheOptions = {
  /** How long an answer is served from memory, in milliseconds. */
  ttl?: number;
  /** The clock — for tests. */
  now?: () => number;
};

type Entry = { at: number; answer: unknown };

/** The entity a route belongs to: its first segment, `"/facturas/F-1/confirm"` → `"/facturas"`. */
function rootOf(route: string): string {
  const path = route.split("?")[0] ?? route;
  const [, first = ""] = path.split("/");
  return `/${first}`;
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

  const invalidate = (path?: string) => {
    if (path === undefined) return entries.clear();
    for (const key of [...entries.keys()])
      if (key.slice(key.indexOf(" ") + 1).startsWith(path)) entries.delete(key);
  };

  return {
    list<T>(route: string, criteria: Criteria<T>, signal?: AbortSignal): Promise<Page<T>> {
      return remembered(`list ${route} ${JSON.stringify(criteria)}`, () =>
        transport.list<T>(route, criteria, signal),
      );
    },
    one<T>(route: string, signal?: AbortSignal): Promise<One<T>> {
      return remembered(`one ${route}`, () => transport.one<T>(route, signal));
    },
    async send<T>(method: Method, route: string, body: unknown, signal?: AbortSignal) {
      // A preview writes nothing; anything else may have changed what was read.
      const preview = route.endsWith("/preview");
      try {
        return await transport.send<T>(method, route, body, signal);
      } finally {
        // Even a refused write may have changed something (a 409 says someone else did).
        if (!preview) invalidate(rootOf(route));
      }
    },
    invalidate,
  };
}
