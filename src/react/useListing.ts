"use client";

import { type CommandBodies, type Entity, listRoute } from "@sincpro/client-framework";
import {
  type AnyRecord,
  type Count,
  type Criteria,
  type Dropped,
  type Expression,
  merge,
  type Meta,
  type ReadingStatus,
  resource,
  resumingFrom,
  searchOver,
  type Sort,
} from "@sincpro/criteria";
import { useReading } from "@sincpro/criteria-react";
import { isList, type ListDefinition, scopeOf } from "@sincpro/web-framework/core/list";
import { useFramework } from "@sincpro/web-framework/react/context";
import { useListScope } from "@sincpro/web-framework/react/scope";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * N records of an entity, live: what a list draws and the gestures that drive it.
 *
 * Context: `useReading` from `@sincpro/criteria-react` already owns the hard rules — the
 * definition asked for once, the stale answer dropped, the cursor never seen. What a screen
 * still wrote by hand around it (forge's `listState`, `More`, the search box, the order) is
 * the same on every list, so it lives here. Three things narrow the reading, and they AND:
 *
 *     search(text)   the entity's own search template (`meta.search`), as the server fills it
 *     filter(where)  what a search bar or a criteria builder put — any depth of all/any/negate
 *     orderBy(sort)  the order — one field or several —, asked of the SERVER: a page sorted
 *                    locally lies about page two
 *
 * All three refine the same reading instead of starting another. It holds state and draws
 * nothing: `EntityList` draws it, and a screen that needs another shape draws it itself.
 */
export type Listing<T, C extends CommandBodies = CommandBodies> = {
  /** Its entity, with the Commands it types (`entity<T, C>`): what `useRowCommands` checks. */
  entity: Entity<T & AnyRecord, C>;
  /** The named list it reads, when it was handed one (`defineList`): what `EntityList` draws
   *  by default — its columns, filters, faces, title — and how `useGroups` starts. */
  definition?: ListDefinition<T & AnyRecord>;
  /** The route this list reads, with its own parameters (`/projects?tenant_id=acme`). */
  route: string;
  /**
   * The question on screen — scope, search, filter and order — without a page: what a grouping
   * of the same set asks with (`useGroups`), so groups and rows never disagree.
   */
  question: Criteria<T>;
  rows: T[];
  meta: Meta | null;
  count: Count | null;
  dropped: Dropped[];
  status: ReadingStatus;
  error: unknown;
  hasMore: boolean;
  locale: string | undefined;
  more: () => void;
  reload: () => void;
  /** What was typed in the search box. */
  text: string;
  /** Debounced: a request per pause, not per keystroke. `now` asks at once — an explicit
   *  Enter does not wait for a pause. */
  search: (text: string, options?: { now?: boolean }) => void;
  /** What the search bar put, as criteria's `selection`; `undefined` is nothing. */
  selection: Expression<T> | undefined;
  filter: (selection: Expression<T> | undefined) => void;
  /** The order the server was asked for, by one field then the next; empty is the entity's own
   *  default. */
  order: readonly Sort[];
  /** One field, several (`[{ field: "state" }, { field: "amount_total", descending: true }]`),
   *  or `null` / `[]` for the entity's default — always a question to the server. */
  orderBy: (order: Sort | readonly Sort[] | null) => void;
  /** How the set is walked: a page at a time, or «load more» up to a ceiling. */
  paging: Paging;
  /** Where the page on screen is — `pages` mode. `from`/`to` count from 1. */
  page: {
    index: number;
    size: number;
    from: number;
    to: number;
    hasPrev: boolean;
    hasNext: boolean;
    /** The server's cursors that start each page up to this one (`null` is the first) — and
     *  the one that starts the next: what a record opened from here walks on (`trailOf`). */
    cursors: readonly (string | null)[];
    after: string | null;
  };
  next: () => void;
  prev: () => void;
  /** `more` mode reached its ceiling: refine the search instead of loading on. */
  capped: boolean;
};

/**
 * - `pages`: one page on screen at a time, walked by the server's own cursor (keyset — no
 *   `offset`, so page 4 000 costs what page 1 costs). The DOM holds one page: a set of millions
 *   never freezes the screen. The default.
 * - `more`: «load more» appends — natural for short sets, a feed — up to `maxRows`; past it the
 *   list asks to narrow the search instead of growing the page until it freezes.
 */
export type Paging = "pages" | "more";

export type ListingOptions<T> = {
  /** The route's own parameters: `{ tenant_id: "acme" }` → `/projects?tenant_id=acme`. */
  params?: Readonly<Record<string, string>>;
  /** What this list always asks — a scope. Search, filter and order AND it. */
  criteria?: Criteria<T>;
  paging?: Paging;
  /** Rows per page (or per «load more»). 50 by default; the server's own default too. */
  pageSize?: number;
  /** `more` mode: the most rows ever on screen. 500 by default. */
  maxRows?: number;
};

/** How long typing has to pause before the search goes out. */
const TYPING_PAUSE = 200;

type Narrowing<T> = {
  text: string;
  selection: Expression<T> | undefined;
  order: readonly Sort[];
};

export function useListing<T extends AnyRecord, C extends CommandBodies = CommandBodies>(
  given: Entity<T, C> | ListDefinition<T>,
  own: ListingOptions<T> = {},
): Listing<T, C> {
  const { transport, locale, metas } = useFramework();
  // A named list is its entity under a fixed scope: the scope ANDs under the caller's own.
  const definition = isList(given) ? given : undefined;
  // A named list's entity has no typed Commands of its own: the default, as `C` then is.
  const entity = (definition?.entity ?? given) as Entity<T, C>;
  // The screen's cut for this entity (a chooser's, `ListScopeProvider`) ANDs like a scope.
  const cut = useListScope(entity.key);
  const scopes = [
    ...(definition === undefined ? [] : [scopeOf(definition)]),
    ...(cut === undefined ? [] : [{ selection: cut } as Criteria<T>]),
  ];
  const options: ListingOptions<T> =
    scopes.length === 0
      ? own
      : {
          ...own,
          criteria: [...scopes, ...(own.criteria === undefined ? [] : [own.criteria])].reduce(
            (all, one) => merge<T>(all, one),
          ),
        };
  const route = listRoute(entity.list, options.params);
  const source = useMemo(
    () => resource<T>((criteria, signal) => transport.list<T>(route, criteria, signal)),
    [transport, route],
  );

  // A definition already known draws the columns before the first page arrives; the one the
  // transport reads from the discovery document comes with it.
  const [preloaded] = useState(() => metas.get(entity.key));
  const paging = options.paging ?? "pages";
  const size = options.pageSize ?? options.criteria?.pagination?.limit ?? 50;
  const maxRows = options.maxRows ?? 500;
  const asked: Criteria<T> = {
    ...options.criteria,
    pagination: { ...options.criteria?.pagination, limit: size },
  };
  const base: Criteria<T> = asked;
  const reading = useReading(source, base);
  // `pages` mode: the cursor that opens each page walked so far — page 0 opens with none.
  const [cursors, setCursors] = useState<(string | null)[]>([null]);

  // The definition is kept across refinements: a refine in flight must not blank the columns.
  const known = useRef<Meta | null>(preloaded ?? null);
  if (reading.meta && reading.meta !== known.current) {
    known.current = reading.meta;
    metas.set(entity.key, reading.meta);
  }
  const meta = reading.meta ?? known.current;

  const [narrowing, setNarrowing] = useState<Narrowing<T>>({
    text: "",
    selection: undefined,
    order: [],
  });
  const typing = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (typing.current && clearTimeout(typing.current)), []);

  const narrowed = (next: Narrowing<T>): Criteria<T> => {
    let criteria: Criteria<T> = base;
    const found = searchOver<T>(meta, next.text);
    if (found !== undefined) criteria = merge<T>(criteria, { selection: found });
    if (next.selection !== undefined)
      criteria = merge<T>(criteria, { selection: next.selection });
    if (next.order.length > 0) criteria = merge<T>(criteria, { order: [...next.order] });
    return criteria;
  };

  const refine = useCallback(
    (next: Narrowing<T>) => {
      // Another question starts on its first page: a cursor belongs to one order and one filter.
      setCursors([null]);
      void reading.refine(narrowed(next));
    },
    // `base` is the caller's literal: its identity changes every render, its content does not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reading.refine, meta],
  );

  const latest = useRef(refine);
  latest.current = refine;

  // Typed before the definition arrived: the text had no template to fill, so it asked nothing.
  // The moment the definition is known, the question on screen is asked again — what a person
  // typed is never lost to a slow first answer.
  const typedBeforeModel = useRef(false);
  if (meta === null && narrowing.text !== "") typedBeforeModel.current = true;
  useEffect(() => {
    if (meta === null || !typedBeforeModel.current) return;
    typedBeforeModel.current = false;
    refine(narrowing);
    // Only the arrival of the definition re-asks; `narrowing` is read as it is then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta]);

  const index = cursors.length - 1;
  const turn = (to: (string | null)[]) => {
    setCursors(to);
    void reading.refine(resumingFrom(narrowed(narrowing), to[to.length - 1] ?? null));
  };
  const capped = paging === "more" && reading.rows.length >= maxRows;

  // Two changes in one gesture — the builder applies a filter AND an order — must both stand:
  // each starts from the latest, never from the render that made the callback (the second one
  // used to undo the first).
  const now = useRef(narrowing);
  now.current = narrowing;
  const narrow = (change: Partial<Narrowing<T>>, debounce: boolean) => {
    const next = { ...now.current, ...change };
    now.current = next;
    setNarrowing(next);
    if (typing.current) clearTimeout(typing.current);
    // The pause ends with the refine of THAT moment, not of the keystroke: a model that arrived
    // meanwhile fills the search, instead of a stale refine asking unfiltered (CI found it).
    if (debounce) typing.current = setTimeout(() => latest.current(next), TYPING_PAUSE);
    else refine(next);
  };

  return {
    entity,
    ...(definition === undefined ? {} : { definition }),
    route,
    question: narrowed(narrowing),
    rows: reading.rows,
    meta,
    count: reading.count,
    dropped: reading.dropped,
    status: reading.status,
    error: reading.error,
    hasMore: paging === "more" && reading.hasMore && !capped,
    locale,
    more: () => {
      if (paging === "more" && !capped) void reading.more();
    },
    reload: () => void reading.reload(),
    text: narrowing.text,
    search: (text, options) => narrow({ text }, options?.now !== true),
    selection: narrowing.selection,
    filter: (selection) => narrow({ selection }, false),
    order: narrowing.order,
    orderBy: (order) =>
      narrow(
        { order: order === null ? [] : Array.isArray(order) ? order : [order as Sort] },
        false,
      ),
    paging,
    page: {
      index,
      size,
      from: reading.rows.length === 0 ? 0 : index * size + 1,
      to: index * size + reading.rows.length,
      hasPrev: paging === "pages" && index > 0,
      hasNext: paging === "pages" && reading.cursor !== null,
      cursors,
      after: reading.cursor,
    },
    next: () => {
      if (paging === "pages" && reading.cursor !== null) turn([...cursors, reading.cursor]);
    },
    prev: () => {
      if (paging === "pages" && index > 0) turn(cursors.slice(0, -1));
    },
    capped,
  };
}
