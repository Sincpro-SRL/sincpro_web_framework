import { type AnyRecord, type Bucket, labelOf, type Meta } from "@sincpro/criteria";
import { frameworkCopy } from "@sincpro/web-framework/core/copy";
import type { GroupLevel } from "@sincpro/web-framework/core/list";
import { textOf } from "@sincpro/web-framework/core/present";
import {
  dateKey,
  dateKeyYear,
  type GroupGrain,
  type Pivot,
  type PivotCell,
  type PivotKey,
} from "@sincpro/web-ui";

/**
 * A grained level's key: the period as the engine writes it — «2026-11», «2026-Q4».
 *
 * Context: read through `textOf` a month bucket was an instant, «31/10/2026 20:00» in La Paz.
 * Keyed by its period, web-ui says it by its grain (`pileLabel` → «Noviembre de 2026»), fills
 * the empty periods between and writes short ticks («nov») — the same words a list's groups
 * use. A value that is not yet a key (an ISO date-time) is cut by its own date part: the day
 * the server wrote, never shifted into the browser's zone.
 */
function periodKeyOf(value: unknown, grain: GroupGrain): string {
  const text = String(value);
  if (dateKeyYear(text, grain) !== null) return text;
  const day = /^\d{4}-\d{2}-\d{2}/.exec(text)?.[0];
  return dateKey(day ?? text, grain) || text;
}

/**
 * web-ui's `Pivot` (`folded`), from what the SERVER counted (`usePivot`): the rows axis is the
 * outer groups, the columns axis every inner value that appeared, each crossing an inner group,
 * each row's total its outer group, each column's total the grouping by the columns alone.
 * Nothing is added up here — a margin is read from the base, never summed from cells.
 *
 * A key is how its value READS («Pagada», «Efectivo»): the grid draws keys, and the server's
 * value («paid») is not a word for a person. A level cut by a `grain` is the exception: its key
 * is the period (`periodKeyOf`) and web-ui reads it, because a period's words depend on the
 * levels around it and a chart needs the period itself to fill the gaps.
 */
export function pivotOf<T extends AnyRecord>({
  crossed,
  byColumn,
  rows,
  columns,
  measures,
  meta,
  locale,
}: {
  /** Grouped by rows, then columns (`usePivot().crossed`). */
  crossed: readonly Bucket<T>[];
  /** Grouped by the columns alone (`usePivot().columns`). */
  byColumn: readonly Bucket<T>[];
  rows: GroupLevel;
  columns: GroupLevel;
  measures: readonly string[];
  meta: Meta | null | undefined;
  locale: string | undefined;
}): Pivot {
  const none = frameworkCopy().list.noValue;
  const keyOf = (bucket: Bucket<T>, level: GroupLevel): string =>
    bucket.value === null || bucket.value === undefined || bucket.value === ""
      ? none
      : level.grain
        ? periodKeyOf(bucket.value, level.grain)
        : (textOf(meta, bucket.field, bucket.value, locale) ?? String(bucket.value));
  const rowKey = (bucket: Bucket<T>) => keyOf(bucket, rows);
  const columnKey = (bucket: Bucket<T>) => keyOf(bucket, columns);
  const cellOf = (bucket: Bucket<T>): PivotCell => ({
    count: bucket.count,
    values: Object.fromEntries(
      measures.map((name) => {
        const value = bucket.measures?.[name];
        return [name, value === null || value === undefined ? null : Number(value)];
      }),
    ),
  });

  const rowKeys: PivotKey[] = crossed.map((bucket) => [rowKey(bucket)]);
  // Columns in the server's order of the columns alone; any value only a crossing has, after.
  const seen = new Set<string>(byColumn.map(columnKey));
  const columnKeys: string[] = [...seen];
  for (const outer of crossed)
    for (const inner of outer.groups ?? []) {
      const key = columnKey(inner);
      if (!seen.has(key)) {
        seen.add(key);
        columnKeys.push(key);
      }
    }

  const at = new Map<string, PivotCell>();
  const rowTotals = new Map<string, PivotCell>();
  for (const outer of crossed) {
    const row = rowKey(outer);
    rowTotals.set(row, cellOf(outer));
    for (const inner of outer.groups ?? [])
      at.set(`${row}\u0000${columnKey(inner)}`, cellOf(inner));
  }
  const columnTotals = new Map(byColumn.map((bucket) => [columnKey(bucket), cellOf(bucket)]));

  return {
    rows: {
      levels: [{ ...rows, label: labelOf(meta, rows.field, locale) }] as never,
      keys: rowKeys,
    },
    columns: {
      levels: [{ ...columns, label: labelOf(meta, columns.field, locale) }] as never,
      keys: columnKeys.map((key) => [key]),
    },
    measures: measures.map((name) => ({
      id: name,
      header: labelOf(meta, name, locale),
      format: (value: number) => textOf(meta, name, value, locale) ?? String(value),
    })),
    cell: (row, column) => at.get(`${row[0] ?? ""}\u0000${column[0] ?? ""}`),
    rowTotal: (row) => rowTotals.get(row[0] ?? ""),
    columnTotal: (column) => columnTotals.get(column[0] ?? ""),
  };
}
