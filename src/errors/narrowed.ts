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

/** Every event leaves without what may carry a person's or a customer's data. */
export function narrowed(event: SentEvent): SentEvent {
  const { user: _user, ...rest } = event;
  if (rest.request === undefined) return rest;
  const { cookies: _c, headers: _h, data: _d, query_string: _q, ...request } = rest.request;
  return {
    ...rest,
    request: { ...request, ...(request.url ? { url: request.url.split("?")[0] } : {}) },
  };
}
