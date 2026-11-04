import { type Criteria, type Dropped, type Meta, readProblem } from "@sincpro/criteria";
import { RestError, restSource } from "@sincpro/criteria/rest";
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
 * Context: a list is criteria's `restSource` (0.3.1 sends the criteria as plain JSON and joins
 * a route that carries its own query, `/projects?tenant_id=acme` — the two things forge's
 * console found wrong in 0.3.0, fixed there). What this adds is what criteria does not know:
 * one record (`one()`), a write (`send()`, with its `Idempotency-Key`), and its refusals as a
 * `TransportError`, the one error every screen explains.
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

  const own = () =>
    typeof options.headers === "function" ? options.headers() : (options.headers ?? {});

  async function get(
    route: string,
    url: string,
    signal?: AbortSignal,
    write?: { method: Method; body: unknown; key?: string | undefined },
  ): Promise<unknown> {
    const headers = write
      ? {
          ...own(),
          "Content-Type": "application/json",
          ...(write.key === undefined ? {} : { "Idempotency-Key": write.key }),
        }
      : own();
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
      const source = restSource<never>(`${base}${route}`, { headers: own, fetch: doFetch });
      try {
        return await source.read(criteria as never, signal);
      } catch (error) {
        if (error instanceof RestError)
          throw new TransportError(route, error.status, error.problem, undefined);
        throw error;
      }
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
