import type { AnyRecord, Meta } from "@sincpro/criteria";
import {
  BOOKKEEPING,
  defaultFields,
  sortKeyOf,
  textOf,
  viewOf,
} from "@sincpro/web-framework/core/present";
import type { DataColumn } from "@sincpro/web-ui";
import type { ReactNode } from "react";

/**
 * The columns of a table, from the model: name the fields, the rest follows.
 *
 * Context: forge's lists wrote every column by hand — `header: "nombre"`, `value: (p) =>
 * p.display_name`, a date formatter per screen — while the server already said what each field
 * is called and what type it holds. Here a column is a NAME: its header is the model's label,
 * its cell the text the value reads as (`textOf`), its sort key the raw value, and whether it
 * can be ordered is what the server said (`sortable`). A cell that needs more than text — a
 * link, a tag — is the one thing a screen writes (`cells`).
 *
 * The fields NOT named still exist: they come after, `optional` and hidden, so the columns
 * menu offers them and nobody edits the screen to see a field the server already sends.
 */
export type ColumnOptions<T> = {
  locale?: string | undefined;
  /** The cells that are not plain text, by field name. */
  cells?: Readonly<Partial<Record<string, (row: T) => ReactNode>>>;
};

function columnOf<T extends AnyRecord>(
  meta: Meta | null | undefined,
  name: string,
  options: ColumnOptions<T>,
  hidden: boolean,
): DataColumn<T> {
  const view = viewOf(meta, name, options.locale);
  const text = (row: T) => textOf(meta, name, row[name], options.locale) ?? "";
  const own = options.cells?.[name];
  return {
    id: name,
    header: view.label,
    field: name,
    value: (row) => sortKeyOf(meta, name, row[name]),
    cell: own ?? text,
    text,
    numeric: view.numeric,
    sortable: view.sortable,
    ...(view.name === meta?.identity ? { mono: true } : {}),
    ...(hidden ? { optional: true, defaultHidden: true } : {}),
  };
}

export function columnsOf<T extends AnyRecord>(
  meta: Meta | null | undefined,
  names?: readonly string[],
  options: ColumnOptions<T> = {},
): DataColumn<T>[] {
  const all = defaultFields(meta);
  const shown = names ?? all.filter((name) => !BOOKKEEPING.has(name));
  const rest = all.filter((name) => !shown.includes(name));
  return [
    ...shown.map((name) => columnOf(meta, name, options, false)),
    ...rest.map((name) => columnOf(meta, name, options, true)),
  ];
}
