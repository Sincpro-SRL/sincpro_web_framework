import { type AnyRecord, type Bucket, labelOf, type Meta } from "@sincpro/criteria";
import { frameworkCopy } from "@sincpro/web-framework/core/copy";
import type { GroupLevel } from "@sincpro/web-framework/core/list";
import { textOf } from "@sincpro/web-framework/core/present";
import type { Pivot, PivotCell, PivotKey } from "@sincpro/web-ui";

/**
 * web-ui's `Pivot` (`folded`), from what the SERVER counted (`usePivot`): the rows axis is the
 * outer groups, the columns axis every inner value that appeared, each crossing an inner group,
 * each row's total its outer group, each column's total the grouping by the columns alone.
 * Nothing is added up here — a margin is read from the base, never summed from cells.
 *
 * A key is how its value READS («Pagada», «Efectivo»): the grid draws keys, and the server's
 * value («paid») is not a word for a person.
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
  const keyOf = (bucket: Bucket<T>): string =>
    bucket.value === null || bucket.value === undefined || bucket.value === ""
      ? none
      : (textOf(meta, bucket.field, bucket.value, locale) ?? String(bucket.value));
  const cellOf = (bucket: Bucket<T>): PivotCell => ({
    count: bucket.count,
    values: Object.fromEntries(
      measures.map((name) => {
        const value = bucket.measures?.[name];
        return [name, value === null || value === undefined ? null : Number(value)];
      }),
    ),
  });

  const rowKeys: PivotKey[] = crossed.map((bucket) => [keyOf(bucket)]);
  // Columns in the server's order of the columns alone; any value only a crossing has, after.
  const seen = new Set<string>(byColumn.map(keyOf));
  const columnKeys: string[] = [...seen];
  for (const outer of crossed)
    for (const inner of outer.groups ?? []) {
      const key = keyOf(inner);
      if (!seen.has(key)) {
        seen.add(key);
        columnKeys.push(key);
      }
    }

  const at = new Map<string, PivotCell>();
  const rowTotals = new Map<string, PivotCell>();
  for (const outer of crossed) {
    const row = keyOf(outer);
    rowTotals.set(row, cellOf(outer));
    for (const inner of outer.groups ?? [])
      at.set(`${row}\u0000${keyOf(inner)}`, cellOf(inner));
  }
  const columnTotals = new Map(byColumn.map((bucket) => [keyOf(bucket), cellOf(bucket)]));

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
