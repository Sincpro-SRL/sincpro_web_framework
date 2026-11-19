import {
  bodyFor,
  pathFor,
  type SendOptions,
  type Transport,
  type WriteRoute,
} from "@sincpro/client-framework";
import type { AnyRecord } from "@sincpro/criteria";

/**
 * A write route of an entity sent as a Command for one record — what a button runs once
 * (`useCommand`) and a batch once per record (`useBatchCommand`).
 *
 *     await sendRoute(transport, invoices.commands.confirm, "F-7", {}, { idempotencyKey })
 *       -> POST /invoices/F-7/confirm
 *
 * A Command whose body names its record (`target`) gets the id there; the path takes it, and
 * every other `{name}`, from the body (`bodyFor`, `pathFor`). The idempotency key is the caller's:
 * one per gesture and record, kept while it goes unanswered (`retryKeys`).
 */
export function sendRoute<A>(
  transport: Transport,
  route: WriteRoute,
  id: string | undefined,
  body: AnyRecord,
  options: SendOptions & { signal?: AbortSignal } = {},
): Promise<A> {
  const { signal, ...sending } = options;
  const sent = bodyFor(route, id, body);
  return transport.send<A>(route.method, pathFor(route, id, sent), sent, signal, sending);
}
