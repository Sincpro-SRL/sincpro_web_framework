import {
  type Entity,
  listRoute,
  type ResourceRef,
  screensTransport,
  type Transport,
} from "@sincpro/client-framework";
import {
  type AnyRecord,
  type Criteria,
  type Expression,
  type Grain,
  merge,
  type Page,
  type Sort,
} from "@sincpro/criteria";
import { frameworkCopy } from "@sincpro/web-framework/core/copy";

/**
 * A named way of looking at an entity: «Por cobrar», «Borradores», «Mis tickets».
 *
 * Context: an ERP rarely shows ONE list of invoices. It shows the invoices to collect, the
 * drafts, the overdue ones — the same entity under a fixed cut, each with its own columns,
 * its own named filters and maybe its own grouping (Odoo's window actions with a `domain`).
 * Written by hand, each of those is a screen repeating `useListing` options and `EntityList`
 * props. Declared once, it is data: `useListing(list)` reads it, `EntityList` draws it,
 * `listView(list)` opens it in the workspace with its own «Go to».
 *
 * The SCOPE is the cut: always asked, ANDed under whatever is searched, filtered or grouped,
 * and never in the search bar — a person cannot remove the «por cobrar» of «Por cobrar». It is
 * a convenience of the screen, not protection: the server answers whatever it allows.
 *
 *     export const porCobrar = defineList(facturas, {
 *       id: "por-cobrar",
 *       title: "Por cobrar",
 *       scope: { selection: { field: "state", operator: "=", value: "posted" } },
 *       columns: ["number", "customer", "due_date", "amount_total"],
 *       filters: [{ id: "vencidas", label: "Vencidas", selection: … }],
 *     });
 */
export type ListDefinition<T extends AnyRecord = AnyRecord> = {
  entity: Entity<T>;
  /** Unique within its entity: `"por-cobrar"`. */
  id: string;
  /** `domain:kind-id` — how the workspace and the definitions store refer to it. */
  key: string;
  /** Where the workspace opens it: a kind of its own, so ⌘K can offer it by name. */
  ref: () => ResourceRef;
  title: string;
  description?: string;
  /** The fixed cut, ANDed under everything a person searches or filters. */
  scope?: Criteria<T>;
  /** The order it opens in, before anyone clicks a header. */
  order?: Sort;
  /** The fields shown, in order. */
  columns?: readonly string[];
  /** The cuts it offers by name in the search bar. */
  filters?: readonly NamedFilter<T>[];
  /** The fields the search bar offers to look a typed text up in, in order — «Buscar Nombres:
   *  Excel». Without it, the ones the entity's search template names, else its display. */
  facets?: readonly string[];
  /** The faces it offers, the first one shown. */
  views?: readonly ("table" | "rows" | "board" | "sheet" | "pivot")[];
  /** Grouped from the start — the server counts the groups. */
  groupBy?: readonly GroupLevel[];
  /** The fields «Group by» offers, in this order — among those the model lets split the set. */
  groupable?: readonly string[];
  /** The entity's trash (`trashOf`): each row offers «Restore» when the entity declares it. */
  trash?: boolean;
};

/** A cut offered by name in the search bar: «sólo pagadas», «vencidas». */
export type NamedFilter<T> = {
  id: string;
  label: string;
  /** What it keeps, as criteria's `selection`. */
  selection: Expression<T>;
};

/** One level of a grouping: by which field, and by which cut of time when it is a date. */
export type GroupLevel = { field: string; grain?: Grain };

export type ListSpec<T extends AnyRecord> = Omit<ListDefinition<T>, "entity" | "key" | "ref">;

export function defineList<T extends AnyRecord>(
  entity: Entity<T>,
  spec: ListSpec<T>,
): ListDefinition<T> {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(spec.id))
    throw new Error(`list id "${spec.id}" is not kebab-case: it becomes a workspace kind`);
  const kind = `${entity.kind}-${spec.id}`;
  return {
    ...spec,
    entity,
    key: `${entity.domain}:${kind}`,
    ref: () => ({ domain: entity.domain, kind }),
  };
}

/** Whether what `useListing` was handed is a list definition rather than a bare entity. */
export function isList<T extends AnyRecord>(
  given: Entity<T> | ListDefinition<T>,
): given is ListDefinition<T> {
  return "entity" in given && "title" in given;
}

/** The criteria a definition always asks: its scope, in its order. */
export function scopeOf<T extends AnyRecord>(list: ListDefinition<T>): Criteria<T> {
  return {
    ...list.scope,
    ...(list.order === undefined ? {} : { order: [list.order] }),
  };
}

/** What a listing's first page depends on, besides the entity or the named list. */
export type ListingQuestion<T> = {
  /** The route's own parameters: `{ tenant_id: "acme" }` → `/projects?tenant_id=acme`. */
  params?: Readonly<Record<string, string>>;
  /** What the listing always asks — a scope. Search, filter and order AND it. */
  criteria?: Criteria<T>;
  /** Rows per page. 50 by default; the server's own default too. */
  pageSize?: number;
};

/**
 * The route and the criteria of a listing's first page: the named list's scope, a screen's cut
 * and the caller's criteria ANDed, the page size set.
 *
 *     listingAsk(porCobrar, { pageSize: 25 })
 *       → { route: "/facturas", criteria: { selection: state = posted, pagination: { limit: 25 } } }
 *
 * Context: `useListing` asks it on mount and `readListing` asks it on a server, so a page read
 * there is the very page the screen would have asked for, and hydrating it reads nothing twice.
 */
export function listingAsk<T extends AnyRecord>(
  given: Entity<T> | ListDefinition<T>,
  own: ListingQuestion<T> = {},
  cut?: Expression<T>,
): { route: string; criteria: Criteria<T> } {
  const definition = isList(given) ? given : undefined;
  const entity = definition?.entity ?? (given as Entity<T>);
  const parts: Criteria<T>[] = [
    ...(definition === undefined ? [] : [scopeOf(definition)]),
    ...(cut === undefined ? [] : [{ selection: cut } as Criteria<T>]),
    ...(own.criteria === undefined ? [] : [own.criteria]),
  ];
  const asked =
    parts.length === 0 ? undefined : parts.reduce((all, one) => merge<T>(all, one));
  const size = own.pageSize ?? asked?.pagination?.limit ?? 50;
  return {
    route: listRoute(entity.list, own.params),
    criteria: { ...asked, pagination: { ...asked?.pagination, limit: size } },
  };
}

/**
 * A listing's first page, read outside React — on the server that renders the screen, in a
 * route's loader —, through the same transport the `FrameworkProvider` is given. Handed to
 * `useListing(list, { ...own, page })`, the screen starts from it and asks nothing on mount.
 *
 *     // the loader, on the server
 *     const page = await readListing(transport, misPagos, { criteria: delColegiado });
 *     // the screen, rendered there and hydrated in the browser
 *     const listing = useListing(misPagos, { criteria: delColegiado, page });
 *
 * A chooser's cut (`ListScopeProvider`) lives in the screen and is not read here: a listing
 * under one is asked with it by the screen, as a SPA does.
 */
export function readListing<T extends AnyRecord>(
  transport: Transport,
  given: Entity<T> | ListDefinition<T>,
  own: ListingQuestion<T> = {},
  signal?: AbortSignal,
): Promise<Page<T>> {
  const { route, criteria } = listingAsk(given, own);
  return screensTransport(transport).list<T>(route, criteria, signal);
}

/**
 * An entity's trash, as a named list: its archived records (sincpro_framework's `Archive`,
 * `ArchivableMixin`), each row offering «Restore» when the entity declares `restore`.
 *
 *     listView(trashOf(banners))            // «Papelera» in the workspace and ⌘K
 *
 * Context: every other reading leaves an archived record out; the backend's trash is a `Search`
 * that names `archived_at` — the list route itself, under `archived_at` not null. So this is the
 * entity's own list under that cut, never a route of its own, and the server still decides what
 * comes back.
 */
export function trashOf<T extends AnyRecord>(
  entity: Entity<T>,
  options: { title?: string } = {},
): ListDefinition<T> {
  return {
    ...defineList(entity, {
      id: "trash",
      title: options.title ?? frameworkCopy().list.trash,
      scope: {
        selection: { field: "archived_at", operator: "is null", value: false } as never,
      },
    }),
    trash: true,
  };
}
