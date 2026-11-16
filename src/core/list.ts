import { type Entity, type EntityRef, SCOPE_PARAM } from "@sincpro/client-framework";
import type { AnyRecord, Criteria, Expression, Grain, Sort } from "@sincpro/criteria";

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
  ref: () => EntityRef;
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
  /** The faces it offers, the first one shown. */
  views?: readonly ("table" | "rows" | "board" | "sheet" | "pivot")[];
  /** Grouped from the start — the server counts the groups. */
  groupBy?: readonly GroupLevel[];
  /** The fields «Group by» offers, in this order — among those the model lets split the set. */
  groupable?: readonly string[];
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

/**
 * An entity's list as a workspace reference, opened under a cut: «this member's payments»,
 * what a smart button opens.
 *
 *     api.open(scopedRef(payments, { field: "member_id", value: member.id }))
 *
 * Context: the cut travels in the reference — client-framework's `SCOPE_PARAM`, the param a
 * chooser carries its cut in (`chooserRef(query, scope)`) — so it survives a reload and a link,
 * and the list opened from it, the application's own too, reads under it ANDed with everything
 * a person searches (`entityView` gives it to `useListing`). An application built this reference
 * by hand. It narrows what is shown; the server still decides what may be read.
 */
export function scopedRef<T extends AnyRecord>(
  entity: Entity<T>,
  selection: Expression<T>,
): EntityRef {
  const list = entity.ref();
  return { ...list, params: { ...list.params, [SCOPE_PARAM]: JSON.stringify(selection) } };
}
