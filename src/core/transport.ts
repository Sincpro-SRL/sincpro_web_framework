import type { Criteria, Dropped, Meta, Page, Problem } from "@sincpro/criteria";
import { frameworkCopy } from "@sincpro/web-framework/core/copy";

/**
 * The one seam between this package and a server.
 *
 * Context: a list and a record are the same two questions whatever the wire is — «a page of
 * these, under this criteria» and «this one». REST today; JSON-RPC and gRPC are the other
 * wires sincpro_framework serves. Each of those is
 * one adapter implementing this, and nothing above it changes. A route is a string the adapter
 * understands: a path for REST, a method for RPC.
 *
 * Every adapter throws `TransportError` for a refusal, so a screen explains a failure once
 * whichever wire it came over.
 */
export interface Transport {
  /** A page of records under the criteria. */
  list<T>(route: string, criteria: Criteria<T>, signal?: AbortSignal): Promise<Page<T>>;
  /** One record, with the definition of its model. */
  one<T>(route: string, signal?: AbortSignal): Promise<One<T>>;
  /** A Command — a write, an action, a preview: `method` and a JSON body, its answer back. */
  send<T>(
    method: Method,
    route: string,
    body: unknown,
    signal?: AbortSignal,
    options?: SendOptions,
  ): Promise<T>;
}

export type Method = "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * How a Command travels besides its body.
 *
 * Context: sincpro_framework runs a Command declared `@idempotency` once per key (REST: the
 * `Idempotency-Key` header; 400 `IDEMPOTENCY_KEY_MISSING` without it) and answers a repeat with
 * the first answer. That is what makes «retry» safe after a request that got no answer: the
 * server may have created the invoice, and the same key cannot create it twice.
 */
export type SendOptions = {
  /** One per gesture, kept while it is retried — `retryKeys()`. */
  idempotencyKey?: string;
};

/** One record as sincpro_framework answers it (`ResponseRecord`): the record, its model. */
export type One<T> = {
  record: T;
  meta: Meta | null;
  dropped: Dropped[];
  /** What this caller kept of an edit between requests (sincpro_framework `Drafts`). */
  draft: Draft | null;
};

/** A kept edit: the values typed, the version of the draft, the record version it started on. */
export type Draft = {
  values: Record<string, unknown>;
  version: number;
  origin_version?: number;
};

/**
 * A refusal, from any wire. `problem` is what the server said about it (RFC 9457 plus the
 * engine's `kind`, `next_step`, `guidance`) or `null` when it said nothing readable — a proxy's
 * HTML page. `status` is `null` when the request never got an answer.
 */
export class TransportError extends Error {
  constructor(
    readonly route: string,
    readonly status: number | null,
    readonly problem: Problem | null,
    message?: string,
  ) {
    super(
      message ?? problem?.detail ?? problem?.title ?? `${status ?? "no answer"} at ${route}`,
    );
    this.name = "TransportError";
  }
}

/**
 * What a person reads about a failure: a heading, and a sentence with what happened and what
 * to do. The server's own words first; the copy table's when it sent none.
 *
 *     explain(new TransportError("/x", 403, { kind: "permission_denied", guidance: "Pedí acceso.", … }))
 *       -> { heading: "No tenés acceso", sentence: "Pedí acceso.", retryable: false }
 */
export function explain(error: unknown): {
  heading: string;
  sentence: string;
  retryable: boolean;
} {
  const copy = frameworkCopy().failure;
  if (error instanceof TransportError && error.problem !== null) {
    const { kind, title, detail, guidance, retryable } = error.problem;
    return {
      heading: title ?? copy.kind[kind] ?? copy.status(error.status ?? 0),
      sentence: [detail, guidance].filter(Boolean).join(" "),
      retryable,
    };
  }
  if (error instanceof TransportError && error.status !== null)
    return { heading: copy.status(error.status), sentence: error.message, retryable: true };
  return {
    heading: copy.unreachable,
    sentence: error instanceof Error ? error.message : String(error),
    retryable: true,
  };
}
