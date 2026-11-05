"use client";

import { type AnyRecord, type Bucket, type Criteria, resumingFrom } from "@sincpro/criteria";
import type { GroupLevel } from "@sincpro/web-framework/core/list";
import { measuresOf, sumsOf } from "@sincpro/web-framework/core/measure";
import { useFramework } from "@sincpro/web-framework/react/context";
import type { Listing } from "@sincpro/web-framework/react/useListing";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The set of a list, split into groups — counted by the SERVER over every row that matches.
 *
 * Context: grouping is the same question as filtering («which part of this am I looking at»),
 * and it obeys the same rule: never on the page. Twelve rows on screen cannot say «187 paid»;
 * whoever keeps the set can. So the listing's own question (scope, search, filter) goes to the
 * server with `group_by`, and what comes back is the groups: their value, their real count, the
 * level below, and the criteria that opens each one (sincpro_framework's aggregation; the
 * in-memory server answers the same with criteria's engine). A group's rows are read when it is
 * opened, with that criteria — nobody rebuilds a filter here.
 *
 *     const groups = useGroups(listing);
 *     groups.group([{ field: "state" }, { field: "invoice_date", grain: "month" }]);
 *     groups.buckets  // [{ field: "state", value: "paid", count: 187, groups: [...] }, ...]
 *     groups.open(bucket); groups.rowsOf(bucket)  // its first page of rows
 */
export type { GroupLevel };

export type Groups<T> = {
  levels: readonly GroupLevel[];
  /** Split by these levels, outermost first; none is no grouping. */
  group: (levels: readonly GroupLevel[]) => void;
  status: "idle" | "loading" | "ready" | "failed";
  buckets: readonly Bucket<T>[];
  error: unknown;
  /** More groups exist than the ceiling shows: narrow the set instead. */
  capped: boolean;
  /** Read the rows of a group — its first page. */
  open: (bucket: Bucket<T>) => void;
  /** The rows of a group once read; `undefined` while it was never opened or is loading. */
  rowsOf: (bucket: Bucket<T>) => readonly T[] | undefined;
  /** Read the group's next page and append it — on the server's cursor, like the list's «load
   *  more». Nothing when it has no more, is already reading, or reached the ceiling. */
  more: (bucket: Bucket<T>) => void;
  /** The group has rows past those read, under the ceiling: «Show N more» makes sense. */
  hasMore: (bucket: Bucket<T>) => boolean;
  /** What the next `more` brings: a number of rows, `false` when it brings none (the server
   *  has no next page, or the ceiling was reached), `undefined` while the group is unread.
   *  web-ui's `Pile.more`: «Show 50 more of 49,950», or «Showing 500 of 49,950». */
  brings: (bucket: Bucket<T>) => number | false | undefined;
};

/** The most groups a level answers: a split into ten thousand groups is a list, not a split. */
const MAX_GROUPS = 100;

/** What was read of a group: its rows, and the cursor of the page after them (`null`: none). */
type Read<T> = { rows: readonly T[]; after: string | null };

/** A group is known by its criteria: unique per group, and stable across renders. */
const keyOf = (bucket: Bucket<AnyRecord>) => JSON.stringify(bucket.criteria);

export function useGroups<T extends AnyRecord>(
  listing: Listing<T>,
  options: {
    pageSize?: number;
    /** The fields each group adds up, over every row of it (`detailOf` reads them). Without
     *  it, the figures the model computes (`sumsOf`); `[]` adds nothing up. */
    sums?: readonly string[];
    /** The most rows ONE group grows to with «more» — 500, the list's ceiling. Past it a group
     *  is narrowed with the search, as a list is. */
    maxRows?: number;
  } = {},
): Groups<T> {
  const { transport } = useFramework();
  // A named list may open grouped (`groupBy`); a person regroups from there.
  const [levels, setLevels] = useState<readonly GroupLevel[]>(
    () => listing.definition?.groupBy ?? [],
  );
  const [state, setState] = useState<{
    status: Groups<T>["status"];
    buckets: readonly Bucket<T>[];
    error: unknown;
  }>({ status: "idle", buckets: [], error: null });
  const [rows, setRows] = useState<ReadonlyMap<string, Read<T>>>(new Map());
  // A group being read: a second «more» before the first answer would ask for the same page.
  const reading = useRef(new Set<string>());
  const pageSize = options.pageSize ?? 50;
  const maxRows = options.maxRows ?? 500;

  // The question without what pages it: a cursor or a limit of rows has no meaning for groups.
  const { pagination: _page, ...asked } = listing.question;
  const question = JSON.stringify(asked);
  const route = listing.route;
  const sums = (options.sums ?? sumsOf(listing.meta)).join(",");
  // What adds up by default is read from the model: without it yet, asking now and again when
  // it arrives would be two questions — and the groups on screen replaced under the pointer.
  const waiting = options.sums === undefined && listing.meta === null;

  useEffect(() => {
    setRows(new Map());
    reading.current.clear();
    if (levels.length === 0) {
      setState({ status: "idle", buckets: [], error: null });
      return;
    }
    const aborter = new AbortController();
    setState((now) => ({ ...now, status: "loading", error: null }));
    if (waiting) return () => aborter.abort();
    const criteria: Criteria<T> = {
      ...(JSON.parse(question) as Criteria<T>),
      grouping: {
        group_by: levels.map((level) => ({ ...level })) as never,
        ...(sums === "" ? {} : { measures: measuresOf(sums.split(",")) }),
        pagination: { limit: MAX_GROUPS },
      } as never,
      // One id per group is the least a grouped answer carries; the rows come on opening.
      pagination: { limit: 1 },
    };
    transport.list<Bucket<T>>(route, criteria as never, aborter.signal).then(
      (page) => {
        if (!aborter.signal.aborted)
          setState({ status: "ready", buckets: page.rows, error: null });
      },
      (error: unknown) => {
        if (!aborter.signal.aborted) setState({ status: "failed", buckets: [], error });
      },
    );
    return () => aborter.abort();
  }, [transport, route, question, levels, sums, waiting]);

  /** One page of a group: the first (`after` null) or the one the cursor points at. */
  const read = useCallback(
    (bucket: Bucket<T>, after: string | null) => {
      const key = keyOf(bucket as Bucket<AnyRecord>);
      if (reading.current.has(key)) return;
      reading.current.add(key);
      const { grouping: _grouping, pagination: _pagination, ...own } = bucket.criteria;
      const first: Criteria<T> = { ...own, pagination: { limit: pageSize } };
      void transport.list<T>(route, after === null ? first : resumingFrom(first, after)).then(
        (page) => {
          reading.current.delete(key);
          setRows((now) => {
            const before = after === null ? [] : (now.get(key)?.rows ?? []);
            return new Map(now).set(key, {
              rows: [...before, ...page.rows],
              after: page.cursor,
            });
          });
        },
        (error: unknown) => {
          reading.current.delete(key);
          setState((now) => ({ ...now, error }));
        },
      );
    },
    [transport, route, pageSize],
  );
  const open = useCallback((bucket: Bucket<T>) => read(bucket, null), [read]);
  const readOf = (bucket: Bucket<T>) => rows.get(keyOf(bucket as Bucket<AnyRecord>));
  const hasMore = (bucket: Bucket<T>) => {
    const now = readOf(bucket);
    return now !== undefined && now.after !== null && now.rows.length < maxRows;
  };

  return {
    levels,
    group: setLevels,
    ...state,
    capped: state.buckets.length >= MAX_GROUPS,
    open,
    rowsOf: (bucket) => readOf(bucket)?.rows,
    more: (bucket) => {
      const now = readOf(bucket);
      if (now !== undefined && hasMore(bucket)) read(bucket, now.after);
    },
    hasMore,
    brings: (bucket) => {
      const now = readOf(bucket);
      if (now === undefined) return undefined;
      if (!hasMore(bucket)) return false;
      const left = Math.min(maxRows, bucket.count) - now.rows.length;
      return Math.max(0, Math.min(pageSize, left));
    },
  };
}
