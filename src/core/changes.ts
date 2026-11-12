import type { Change, Entity } from "@sincpro/client-framework";

/**
 * What a write touches on a screen: the rule every reader of this package shares — the cache,
 * the lists and records on screen, the names in a cell.
 *
 * Context: a write says only how and where it was sent (`Change`, @sincpro/client-framework). What
 * it may have changed is a rule of REST routes, the screens' wire: every collection its route
 * NAMES, not only the first — «leave a tenant» (`POST /users/{email}/tenants/{tenant}/leave`)
 * changes the tenant's members as much as the user —, and the history of each entity it writes
 * under, wherever its events live (`/issue-events/{id}`). A segment that is a key (`/F-1`) names no
 * collection. It is generous on purpose: reading again something that did not change costs a
 * request; showing something that did is the bug.
 *
 *     touches({ method: "POST", route: "/issues/7/cancel" }, "/issues?project_id=acme")  ->  true
 *     touches({ method: "POST", route: "/issues/7/cancel" }, "/projects/acme")           ->  false
 */

/** A route without its query: `/projects?tenant_id=acme` → `/projects`. */
export function pathOf(route: string): string {
  return route.split("?")[0] ?? route;
}

/** `route` is `path` or lies under it: `"/facturas"` holds `"/facturas/F-1"`, never `"/facturas-events"`. */
export function under(route: string, path: string): boolean {
  const own = pathOf(route);
  return own === path || own.startsWith(path.endsWith("/") ? path : `${path}/`);
}

/** The collections a write to `route` may have changed: each one its route names, and the
 *  history of each entity it writes under. */
export function touchedBy(route: string, entities: readonly Entity[]): string[] {
  const path = pathOf(route);
  const segments = path.split("/").filter((one) => one !== "");
  const history = entities
    .filter((one) => one.history !== undefined && under(path, pathOf(one.list)))
    // The route up to its first key: `/issue-events/{id}` forgets `/issue-events`.
    .map((one) => pathOf(one.history ?? "").split("/{")[0] ?? "");
  return [...segments.map((one) => `/${one}`), ...history];
}

/** Whether `change` may have changed what was read at `route`. */
export function touches(change: Change, route: string, entities: readonly Entity[]): boolean {
  return touchedBy(change.route, entities).some((path) => under(route, path));
}
