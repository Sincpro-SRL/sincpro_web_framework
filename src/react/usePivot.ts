"use client";

import type { AnyRecord, Bucket, Criteria } from "@sincpro/criteria";
import type { GroupLevel } from "@sincpro/web-framework/core/list";
import { measuresOf, sumsOf } from "@sincpro/web-framework/core/measure";
import { useFramework } from "@sincpro/web-framework/react/context";
import type { Listing } from "@sincpro/web-framework/react/useListing";
import { useWrites } from "@sincpro/web-framework/react/useWrites";
import { useEffect, useState } from "react";

/**
 * A list's set crossed by two fields — state by month, customer by payment — counted and added
 * up by the SERVER over every row that matches, never the page.
 *
 * Context: web-ui draws a pivot two ways: `spec` folds the rows IN HAND, `folded` draws one
 * already folded. Folding the page would answer «12 paid» for a set of 187 — the rule of
 * grouping (`AGENTS.md`). So the listing's question (scope, search, filter) goes to the server
 * twice: grouped by both axes (each crossing, and each row's total in the outer group), and by
 * the columns alone (each column's total). No cell is added up here.
 *
 *     const pivot = usePivot(listing, { rows: { field: "state" }, columns: { field: "payment" } });
 *     pivot.crossed   // [{ value: "paid", count: 187, measures, groups: [{ value: "cash", … }] }]
 *     pivot.columns   // [{ value: "cash", count: 340, measures }, …]
 */
export type PivotAxes = {
  rows: GroupLevel;
  columns: GroupLevel;
  /** The fields added up in each crossing. Without it, the figures the model computes. */
  measures?: readonly string[];
};

export type PivotReading<T> = {
  status: "idle" | "loading" | "ready" | "failed";
  /** Grouped by rows, then columns: a crossing is a row's group's group. */
  crossed: readonly Bucket<T>[];
  /** Grouped by the columns alone: each column's total. */
  columns: readonly Bucket<T>[];
  measures: readonly string[];
  error: unknown;
};

/** The most groups an axis answers: a pivot of ten thousand rows is a list. */
const MAX_KEYS = 100;

export function usePivot<T extends AnyRecord>(
  listing: Listing<T>,
  axes: PivotAxes | null,
): PivotReading<T> {
  const { transport, context } = useFramework();
  const [state, setState] = useState<Omit<PivotReading<T>, "measures">>({
    status: "idle",
    crossed: [],
    columns: [],
    error: null,
  });
  const { pagination: _page, ...asked } = listing.question;
  const question = JSON.stringify(asked);
  const measures = axes?.measures ?? sumsOf(listing.meta);
  const sums = measures.join(",");
  const shape = axes === null ? "" : JSON.stringify([axes.rows, axes.columns]);
  const waiting = axes !== null && axes.measures === undefined && listing.meta === null;
  // Written by anyone — a save, a use case, a panel beside: the crossing is counted again.
  const writes = useWrites(listing.route);

  useEffect(() => {
    if (shape === "") {
      setState({ status: "idle", crossed: [], columns: [], error: null });
      return;
    }
    const aborter = new AbortController();
    setState((now) => ({ ...now, status: "loading", error: null }));
    if (waiting) return () => aborter.abort();
    const [rows, columns] = JSON.parse(shape) as [GroupLevel, GroupLevel];
    const grouped = (levels: readonly GroupLevel[]): Criteria<Bucket<T>> =>
      ({
        ...(JSON.parse(question) as Criteria<T>),
        grouping: {
          group_by: levels.map((level) => ({ ...level })),
          ...(sums === "" ? {} : { measures: measuresOf(sums.split(",")) }),
          pagination: { limit: MAX_KEYS },
        },
        pagination: { limit: 1 },
      }) as never;
    Promise.all([
      transport.list<Bucket<T>>(listing.route, grouped([rows, columns]), aborter.signal),
      transport.list<Bucket<T>>(listing.route, grouped([columns]), aborter.signal),
    ]).then(
      ([crossed, byColumn]) => {
        if (!aborter.signal.aborted)
          setState({
            status: "ready",
            crossed: crossed.rows,
            columns: byColumn.rows,
            error: null,
          });
      },
      (error: unknown) => {
        if (!aborter.signal.aborted)
          setState({ status: "failed", crossed: [], columns: [], error });
      },
    );
    return () => aborter.abort();
  }, [transport, listing.route, question, shape, sums, waiting, context, writes]);

  return { ...state, measures };
}
