/**
 * What every reported event leaves without — the browser's (`./errors`) and the server's
 * (`./errors/server`) alike: in an ERP a request body is an invoice and a customer.
 */

/** The parts of an event the reporters narrow; the rest passes as the SDK built it. */
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

/** The person's id — what GlitchTip counts «users affected» by, and what already travels as the
 *  `user_id` tag —; nothing else of the person (email, name, IP…). */
function idOf(user: unknown): { id: string } | undefined {
  if (typeof user !== "object" || user === null || !("id" in user)) return undefined;
  const id = (user as { id: unknown }).id;
  return typeof id === "string" || typeof id === "number" ? { id: String(id) } : undefined;
}

/** Every event leaves without what may carry a person's or a customer's data. */
export function narrowed(event: SentEvent): SentEvent {
  const { user, ...others } = event;
  const person = idOf(user);
  const rest: SentEvent = person === undefined ? others : { ...others, user: person };
  if (rest.request === undefined) return rest;
  const { cookies: _c, headers: _h, data: _d, query_string: _q, ...request } = rest.request;
  return {
    ...rest,
    request: { ...request, ...(request.url ? { url: request.url.split("?")[0] } : {}) },
  };
}
