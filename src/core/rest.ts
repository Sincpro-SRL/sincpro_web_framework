import {
  type Criteria,
  type Dropped,
  type Envelope,
  type Meta,
  pageFrom,
  plain,
  readProblem,
} from "@sincpro/criteria";
import {
  type Draft,
  type Method,
  type One,
  type SendOptions,
  type Transport,
  TransportError,
} from "@sincpro/web-framework/core/transport";

/**
 * The REST wire of sincpro_framework (`FastApiGateway`).
 *
 * Context: two things `restSource` from `@sincpro/criteria` 0.3 gets wrong against
 * sincpro_framework 3.27, both found by forge's console, which had to write its own client:
 *
 * - it appends `?criteria=` to the route as it is, which breaks a route that already carries
 *   its own query (`/projects?tenant_id=acme`) — here the criteria joins that query;
 * - it sends `pack()` (base64url), and the REST entrypoint reads the parameter as plain JSON
 *   and refuses anything else («criteria is not JSON») — here it travels as JSON.
 *
 * Once criteria fixes both, this keeps only what it adds: `one()`.
 *
 *     const transport = restTransport({
 *       base: "/v1",
 *       headers: () => ({ Authorization: `Bearer ${session.secret}` }),
 *     });
 */
export type RestOptions = {
  /** Prepended to every route: `"/v1"`, `"https://forge.sincpro.com.bo/v1"`. */
  base?: string;
  /** Sent with every request. A function is called fresh each time — a token that rotates. */
  headers?: Record<string, string> | (() => Record<string, string>);
  /** Defaults to the global `fetch`. Inject one for tests. */
  fetch?: typeof fetch;
};

/** The keys of an answer that are not the record: what is left is the record's own field. */
const ENVELOPE = new Set(["cursor", "count", "entity_meta_data", "dropped", "draft"]);

export function urlOf<T>(base: string, route: string, criteria?: Criteria<T>): string {
  const url = `${base}${route}`;
  if (criteria === undefined) return url;
  const joiner = url.includes("?") ? "&" : "?";
  return `${url}${joiner}criteria=${encodeURIComponent(JSON.stringify(criteria))}`;
}

export function restTransport(options: RestOptions = {}): Transport {
  const base = options.base ?? "";
  const doFetch = options.fetch ?? ((input, init) => fetch(input, init));

  async function get(
    route: string,
    url: string,
    signal?: AbortSignal,
    write?: { method: Method; body: unknown; key?: string | undefined },
  ): Promise<unknown> {
    const own =
      typeof options.headers === "function" ? options.headers() : (options.headers ?? {});
    const headers = write
      ? {
          ...own,
          "Content-Type": "application/json",
          ...(write.key === undefined ? {} : { "Idempotency-Key": write.key }),
        }
      : own;
    const response = await doFetch(url, {
      headers,
      ...(write ? { method: write.method, body: JSON.stringify(write.body) } : {}),
      ...(signal ? { signal } : {}),
    });
    const text = await response.text();
    if (!response.ok)
      throw new TransportError(route, response.status, readProblem(text), undefined);
    return text ? JSON.parse(text) : null;
  }

  return {
    async list(route, criteria, signal) {
      const answer = await get(route, urlOf(base, route, plain(criteria)), signal);
      return pageFrom(answer as Envelope & Record<string, unknown>);
    },

    async one<T>(route: string, signal?: AbortSignal): Promise<One<T>> {
      const answer = (await get(route, urlOf(base, route), signal)) as Record<
        string,
        unknown
      >;
      const own = Object.keys(answer).filter((key) => !ENVELOPE.has(key));
      const [key] = own;
      if (own.length !== 1 || key === undefined)
        throw new TransportError(
          route,
          200,
          null,
          `${route} answered ${own.length} fields of its own (${own.join(", ")}); a record answers one`,
        );
      return {
        record: answer[key] as T,
        meta: (answer["entity_meta_data"] as Meta | undefined) ?? null,
        dropped: (answer["dropped"] as Dropped[] | undefined) ?? [],
        draft: (answer["draft"] as Draft | undefined) ?? null,
      };
    },

    async send<T>(
      method: Method,
      route: string,
      body: unknown,
      signal?: AbortSignal,
      sending?: SendOptions,
    ) {
      return (await get(route, urlOf(base, route), signal, {
        method,
        body,
        key: sending?.idempotencyKey,
      })) as T;
    },
  };
}
