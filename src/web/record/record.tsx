"use client";

import { type AnyRecord, describeRows, type Meta } from "@sincpro/criteria";
import { frameworkCopy } from "@sincpro/web-framework/core/copy";
import { textOf, viewOf } from "@sincpro/web-framework/core/present";
import { relatedOf } from "@sincpro/web-framework/core/related";
import { columnsOf } from "@sincpro/web-framework/web/list/columns";
import { List, type SheetField } from "@sincpro/web-ui";
import type { ReactNode } from "react";

/**
 * The parts of ONE record, from the model.
 *
 * Context: `Record.*` in web-ui is a tree of slots — `Record.Facts` must be written as a child
 * of `Record.Paper`, not hidden inside a component of ours, or the record does not find it.
 * So these are not components that wrap `Record`: they are the PROPS of its slots, built from
 * the model, and the screen keeps writing the tree:
 *
 *     <Record.Paper>
 *       <Record.Facts fields={factsOf(record, meta, ["number", "customer", "due"])} />
 *       <Record.Pages>
 *         <Record.Page id="lines" label={labelOf(meta, "lines")} count={countOf(record, "lines")}>
 *           <RecordLines record={record} meta={meta} name="lines" />
 *         </Record.Page>
 *       </Record.Pages>
 *     </Record.Paper>
 */

const EMPTY = "—";

export function factsOf<T extends AnyRecord>(
  record: T,
  meta: Meta | null | undefined,
  names: readonly string[],
  options: {
    locale?: string | undefined;
    cells?: Readonly<Partial<Record<string, (record: T) => ReactNode>>>;
  } = {},
): SheetField[] {
  return names.map((name) => {
    const view = viewOf(meta, name, options.locale);
    const own = options.cells?.[name];
    return {
      label: view.label,
      value: own ? own(record) : (textOf(meta, name, record[name], options.locale) ?? EMPTY),
      ...(view.help === undefined ? {} : { hint: view.help }),
      ...(name === meta?.identity ? { mono: true } : {}),
    };
  });
}

/** How many records a relation of this record holds — the TOTAL, not the page it brought. */
export function countOf(record: AnyRecord, name: string): number {
  return relatedOf(record[name]).count.value;
}

/**
 * A one2many / many2many of the record, as an embedded list.
 *
 * Its columns come from the relation's own definition when the server expanded it, and are
 * read off the rows otherwise. When the record brought only one page of them, it says so —
 * «se muestran 50 de 1000» — instead of drawing 50 as if they were all.
 */
export function RecordLines<T extends AnyRecord>({
  record,
  meta,
  name,
  columns,
  cells,
  locale,
  onOpen,
}: {
  record: AnyRecord;
  meta: Meta | null | undefined;
  name: string;
  columns?: readonly string[];
  cells?: Readonly<Partial<Record<string, (row: T) => ReactNode>>>;
  locale?: string | undefined;
  onOpen?: (row: T) => void;
}) {
  const related = relatedOf<T>(record[name]);
  const definition = meta?.fields[name]?.definition ?? describeRows(related.items);
  const identity = definition.identity || "id";
  const copy = frameworkCopy();

  return (
    <div className="flex flex-col gap-2">
      <List<T>
        embedded
        items={related.items}
        keyOf={(row) => String(row[identity])}
        present="table"
        empty={{ sentence: copy.list.empty }}
        {...(onOpen === undefined ? {} : { onOpen })}
      >
        <List.Table<T>
          columns={columnsOf<T>(definition, columns, { locale, ...(cells ? { cells } : {}) })}
        />
      </List>
      {related.partial ? (
        <p className="text-meta text-muted">
          {copy.record.partial(related.items.length, related.count.value)}
        </p>
      ) : null}
    </div>
  );
}
