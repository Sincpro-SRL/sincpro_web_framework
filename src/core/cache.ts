import {
  bindableTransport,
  type CallOptions,
  type Change,
  changeOf,
  type Entity,
  type Method,
  type One,
  type SendOptions,
  type Transport,
} from "@sincpro/client-framework";
import type { Criteria, Page } from "@sincpro/criteria";
import { pathOf, touchedBy, under } from "@sincpro/web-framework/core/changes";

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
 *
 * A question asked again while its answer is on its way joins it: two panels opening one record,
 * a picker beside a column, are one request. Each reader may give up on its own (its `signal`);
 * the request is cancelled only when every one of them did. A write while it flies makes its
 * answer old: it is handed to who waited, never kept, and the next reader asks again.
 *
 * Who wrote does not matter. A write through this transport forgets at once; one made elsewhere —
 * a use case's generated client, another transport — is told with `changed`, which is what the
 * process's change feed carries (`processChanges`, @sincpro/client-framework). What a write
 * touches is `touchedBy`'s rule (`core/changes`): every collection its route names, and the
 * history of each entity it writes under (`entities`).
 *
 * A run binds it like any transport of the framework (`bindableTransport`): what a use case reads
 * through it carries the run's trace and the process's context (`sincpro-context`), whether the
 * answer comes from memory or from the server.
 *
 *     const transport = cachedTransport(restTransport({ base: "/v1" }), { ttl: 30_000 });
 *     processChanges.follow((change) => transport.changed(change));
 *     transport.invalidate("/facturas");   // forget an entity by hand
 */
export type CachedTransport = Transport & {
  /** Forget every answer whose route lies under this path: `"/facturas"` forgets the list,
   *  every page and filter of it, and every record under it — not `"/facturas-events"`. */
  invalidate: (path?: string) => void;
  /** A write made elsewhere: forget what it touched, as a write through here does. */
  changed: (change: Change) => void;
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

/** One request every reader of the same question waits for. */
type Flight = {
  answer: Promise<unknown>;
  aborter: AbortController;
  /** Readers still waiting; at none, the request is cancelled. */
  waiting: number;
  /** A write landed while it flew: its answer is handed over, never kept. */
  stale: boolean;
};

export function cachedTransport(
  transport: Transport,
  options: CacheOptions = {},
): CachedTransport {
  const ttl = options.ttl ?? 30_000;
  const now = options.now ?? (() => Date.now());
  const entities = options.entities ?? [];
  const entries = new Map<string, Entry>();
  const flights = new Map<string, Flight>();

  /** The answer to `key`: kept while fresh; else the request already flying for it; else a new one. */
  function remembered<A>(
    key: string,
    read: (signal: AbortSignal) => Promise<A>,
    signal?: AbortSignal,
  ): Promise<A> {
    if (signal?.aborted) return Promise.reject(signal.reason);
    const kept = entries.get(key);
    if (kept !== undefined && now() - kept.at < ttl) return Promise.resolve(kept.answer as A);
    return awaited(key, flights.get(key) ?? fly(key, read), signal) as Promise<A>;
  }

  function fly(key: string, read: (signal: AbortSignal) => Promise<unknown>): Flight {
    const aborter = new AbortController();
    const flight: Flight = { answer: Promise.resolve(), aborter, waiting: 0, stale: false };
    flight.answer = read(aborter.signal)
      .then((answer) => {
        if (!flight.stale) entries.set(key, { at: now(), answer });
        return answer;
      })
      .finally(() => {
        if (flights.get(key) === flight) flights.delete(key);
      });
    // Every reader may have given up: the cancelled request then has nobody to tell.
    flight.answer.catch(() => undefined);
    flights.set(key, flight);
    return flight;
  }

  /** `flight`'s answer for one reader, who may give up alone; the last one to go cancels it. */
  function awaited(key: string, flight: Flight, signal?: AbortSignal): Promise<unknown> {
    flight.waiting += 1;
    if (signal === undefined) return flight.answer;
    return new Promise((resolve, reject) => {
      const leave = () => {
        flight.waiting -= 1;
        if (flight.waiting === 0) {
          if (flights.get(key) === flight) flights.delete(key);
          flight.aborter.abort(signal.reason);
        }
        reject(signal.reason);
      };
      signal.addEventListener("abort", leave, { once: true });
      flight.answer.then(
        (answer) => {
          signal.removeEventListener("abort", leave);
          resolve(answer);
        },
        (error: unknown) => {
          signal.removeEventListener("abort", leave);
          reject(error);
        },
      );
    });
  }

  /** Forget every answer under any of `paths`, and leave behind the ones still flying there —
   *  one walk over each, whatever their number. A path with a query forgets its collection. */
  const forget = (paths: readonly string[]) => {
    const targets = paths.map(pathOf);
    // `list <route> <criteria>` / `one <route>`: the route is the second word.
    const touched = (key: string) =>
      targets.some((path) => under(key.split(" ", 2)[1] ?? "", path));
    for (const key of [...entries.keys()]) if (touched(key)) entries.delete(key);
    for (const [key, flight] of [...flights]) {
      if (!touched(key)) continue;
      flight.stale = true;
      flights.delete(key);
    }
  };

  const changed = (change: Change) => forget(touchedBy(change.route, entities));

  const invalidate = (path?: string) => {
    if (path !== undefined) return forget([path]);
    entries.clear();
    for (const flight of flights.values()) flight.stale = true;
    flights.clear();
  };

  return bindableTransport({
    // A call's own headers (a use case's trace) never change the answer: they travel, and the
    // answer is kept by the question alone.
    list<T>(
      route: string,
      criteria: Criteria<T>,
      signal?: AbortSignal,
      options?: CallOptions,
    ): Promise<Page<T>> {
      return remembered(
        `list ${route} ${JSON.stringify(criteria)}`,
        (flying) => transport.list<T>(route, criteria, flying, options),
        signal,
      );
    },
    one<T>(route: string, signal?: AbortSignal, options?: CallOptions): Promise<One<T>> {
      return remembered(
        `one ${route}`,
        (flying) => transport.one<T>(route, flying, options),
        signal,
      );
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
      try {
        return await transport.send<T>(method, route, body, signal, sending);
      } finally {
        // Even a refused write may have changed something (a 409 says someone else did); a
        // preview or a dry run changes nothing (`changeOf`).
        const change = changeOf(method, route, body);
        if (change !== undefined) changed(change);
      }
    },
    invalidate,
    changed,
  });
}
