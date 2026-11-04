"use client";

import { type AnyRecord, type Criteria, type Expression, merge } from "@sincpro/criteria";
import type { Entity, EntityRef } from "@sincpro/web-framework/core/entity";
import { isList, type ListDefinition, scopeOf } from "@sincpro/web-framework/core/list";
import type { OpenTarget } from "@sincpro/web-ui";
import { createContext, type ReactNode, useContext } from "react";

/**
 * How a record shown in a form opens from here — given by whoever holds the form, used by the
 * fields inside it.
 *
 * Context: a form must work outside a workspace (`web/record/` imports no composer), yet a
 * many2one inside one opens its record in a modal, with «Abrir en…» for the rest. So the form
 * does not decide: the view that holds it says how to open (`entityView` fills it with the
 * composer's `openIn` and the places allowed from where the view is), and a field asks. Without
 * it a related record is a value, not a door.
 *
 * Every picker of an entity reads it by itself — `RecordField`, and an `EntityPicker` or
 * `EntityTags` a screen writes by hand — so inside a workspace a record and a chooser always
 * open in the workspace; what a screen passes (`onOpen`, `onBrowseAll`) still wins. Where the
 * workspace's chooser must not be used — a line being written, whose answer would land on a line
 * that already committed — the holder gives an opening without `choose`.
 */
export type RecordOpening = {
  open: (ref: EntityRef, to: OpenTarget) => void;
  /** Where it may open from here, the default first. */
  targets: readonly OpenTarget[];
  /** The form is not on a page — a panel, a peek, a modal: a list inside it starts as rows
   *  (a table of seven columns in 760 px breaks every number and date into three lines). */
  narrow?: boolean;
  /** «Buscar más…»: the entity's own list opened to choose (in composer, a modal that answers),
   *  on what was typed, offering only what `scope` lets the picker choose (`chooserScopeOf`).
   *  Without it the picker brings its own chooser. */
  choose?: (
    entity: Entity,
    answer: (id: string) => void,
    query: string,
    scope?: Expression,
  ) => void;
  /** «Agregar» on a one2many: the form of a new record of `entity`, starting with `values`
   *  (the key that points back here), opened where it answers; `created` once it exists.
   *  Without it a record's one2many only reads. */
  create?: (entity: Entity, values: AnyRecord, created: () => void) => void;
};

const Opening = createContext<RecordOpening | null>(null);

export function RecordOpeningProvider({
  value,
  children,
}: {
  value: RecordOpening;
  children: ReactNode;
}) {
  return <Opening.Provider value={value}>{children}</Opening.Provider>;
}

export function useRecordOpening(): RecordOpening | null {
  return useContext(Opening);
}

/**
 * What a picker's chooser may offer: its named list's scope and its own cut (criteria, the keys
 * it excludes) as ONE expression — what `chooserRef(query, scope)` carries to the workspace,
 * whose list knows nothing of the picker that opened it.
 */
export function chooserScopeOf<T extends AnyRecord>(
  entity: Entity<T> | ListDefinition<T>,
  cut: Criteria<T> | undefined,
): Expression | undefined {
  const named = isList(entity) ? scopeOf(entity) : undefined;
  const all = named === undefined ? cut : cut === undefined ? named : merge<T>(named, cut);
  return all?.where as Expression | undefined;
}
