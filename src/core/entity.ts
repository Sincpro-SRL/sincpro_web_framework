import type { AnyRecord } from "@sincpro/criteria";
import type { Method } from "@sincpro/web-framework/core/transport";

/**
 * Everything a screen needs to know about where an entity lives on the server, declared once.
 *
 * Context: a screen should not know a URL. It names the entity, and the entity says where its
 * list is, where one record is, which Commands it takes, how it is saved and previewed, where a
 * draft is kept and where its history is. `key` is how the workspace refers to it
 * (`domain:kind`, the shape of a composer `ResourceRef`).
 *
 * The routes are declared, not guessed: sincpro_framework publishes a route per use case and
 * its model definition does not list them (yet). A route is `"METHOD /path/{id}"` for a write.
 *
 *     export const invoices = entity<Invoice>("billing:invoice", {
 *       list: "/invoices",
 *       create: "POST /invoices",
 *       save: "PUT /invoices/{id}",
 *       preview: "POST /invoices/preview",
 *       commands: { confirm: "POST /invoices/{id}/confirm", cancel: "POST /invoices/{id}/cancel" },
 *       history: { route: "/billing-events", type: "Invoice" },
 *     });
 */
export type Entity<T extends AnyRecord = AnyRecord> = {
  /** `domain:kind`, e.g. `"billing:invoice"`. */
  key: string;
  domain: string;
  kind: string;
  /** Where the workspace finds it: the list without an id, one record with it — the shape of a
   *  composer `ResourceRef`, built here so no screen writes `{ domain, kind, id }` by hand. */
  ref: (id?: string) => EntityRef;
  /** A record that does not exist yet — the form that creates one. Its view is the record's. */
  newRef: () => EntityRef;
  /** Its list opened to CHOOSE one: a row answers whoever asked (composer's `api.pick`). */
  chooserRef: () => EntityRef;
  /** The route of its list. */
  list: string;
  /** The route of one record. */
  one: (id: string) => string;
  /** Its Commands, by name. */
  commands: Readonly<Record<string, WriteRoute>>;
  /** How a new record is created: the list's own route, usually. */
  create?: WriteRoute;
  /** How an edit is saved: the record's own route with `{id}`. */
  save?: WriteRoute;
  /** «What does this record become?» before saving — sincpro_framework's `Preview`. */
  preview?: WriteRoute;
  /** Where this caller keeps an edit between requests — sincpro_framework's `Drafts`. */
  draft?: WriteRoute;
  /** Its business events: the context's events route, and the `entity_type` they carry. */
  history?: { route: string; type: string };
  /** Only carries the record type; never read. */
  readonly _record?: T;
};

/** A composer `ResourceRef`, structurally: `core/` does not import the composer. */
export type EntityRef = {
  domain: string;
  kind: string;
  id?: string;
  params?: Readonly<Record<string, string>>;
};

/**
 * The params that say what a reference without an id is for: `new` is the form of a record
 * that does not exist yet, `pick` is the list opened to choose one. Params, because they are
 * what a composer reference carries and survives a reload with.
 */
export const NEW_PARAM = "new";
export const PICK_PARAM = "pick";

/** A write: its method and its path, `{id}` where the record's key goes. */
export type WriteRoute = { method: Method; path: string };

export type EntityRoutes = {
  list: string;
  /** With `{id}` where the key goes. Without it, `<list>/<id>` — sincpro_framework's convention. */
  one?: string;
  /** `"POST /invoices/{id}/confirm"`, by name. */
  commands?: Readonly<Record<string, string>>;
  /** `"POST /invoices"`: where a new record goes. */
  create?: string;
  save?: string;
  preview?: string;
  draft?: string;
  history?: { route: string; type: string };
};

const METHODS = new Set<Method>(["POST", "PUT", "PATCH", "DELETE"]);

/** `"POST /invoices/{id}/confirm"` → its method and path. A write without a method is a bug. */
export function writeRoute(text: string): WriteRoute {
  const [method, path] = text.trim().split(/\s+/, 2);
  if (!METHODS.has(method as Method) || path === undefined)
    throw new Error(`"${text}" is not "METHOD /path": a write says how it is sent`);
  return { method: method as Method, path };
}

/** The path with the record's key in place of `{id}`. */
export function pathFor(route: WriteRoute, id?: string): string {
  return id === undefined ? route.path : route.path.replace("{id}", encodeURIComponent(id));
}

export function entity<T extends AnyRecord = AnyRecord>(
  key: string,
  routes: EntityRoutes,
): Entity<T> {
  if (!/^[^:\s]+:[^:\s]+$/.test(key))
    throw new Error(`entity key "${key}" is not domain:kind`);
  const list = routes.list.split("?")[0] ?? routes.list;
  const template = routes.one ?? `${list}/{id}`;
  const [domain = "", kind = ""] = key.split(":");
  return {
    key,
    domain,
    kind,
    ref: (id) => ({ domain, kind, ...(id === undefined || id === "" ? {} : { id }) }),
    newRef: () => ({ domain, kind, params: { [NEW_PARAM]: "1" } }),
    chooserRef: () => ({ domain, kind, params: { [PICK_PARAM]: "1" } }),
    list: routes.list,
    one: (id) => template.replace("{id}", encodeURIComponent(id)),
    commands: Object.fromEntries(
      Object.entries(routes.commands ?? {}).map(([name, text]) => [name, writeRoute(text)]),
    ),
    ...(routes.create === undefined ? {} : { create: writeRoute(routes.create) }),
    ...(routes.save === undefined ? {} : { save: writeRoute(routes.save) }),
    ...(routes.preview === undefined ? {} : { preview: writeRoute(routes.preview) }),
    ...(routes.draft === undefined ? {} : { draft: writeRoute(routes.draft) }),
    ...(routes.history === undefined ? {} : { history: routes.history }),
  };
}
