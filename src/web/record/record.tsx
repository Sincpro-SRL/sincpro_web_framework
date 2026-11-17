"use client";

import { type AnyRecord, describeRows, type Meta } from "@sincpro/criteria";
import { frameworkCopy } from "@sincpro/web-framework/core/copy";
import { textOf, valueAt, viewOf } from "@sincpro/web-framework/core/present";
import { relatedOf } from "@sincpro/web-framework/core/related";
import { type RelationField, relationFieldOf } from "@sincpro/web-framework/core/relation";
import { useEntityFor } from "@sincpro/web-framework/react/context";
import { useNameOf } from "@sincpro/web-framework/react/useNameOf";
import { columnsOf } from "@sincpro/web-framework/web/list/columns";
import { useRecordOpening } from "@sincpro/web-framework/web/record/opening";
import {
  List,
  type OpenTarget,
  RelationValue,
  type RowAction,
  type SheetField,
} from "@sincpro/web-ui";
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
 *       <Record.Facts fields={factsOf(pago, meta, ["recibo.numero", "recibo.concepto"])} />
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
    const relation = relationFieldOf(meta, name);
    return {
      label: view.label,
      value: own ? (
        own(record)
      ) : relation !== undefined && !relation.many ? (
        <RelationFact
          record={record}
          meta={meta}
          name={name}
          relation={relation}
          locale={options.locale}
        />
      ) : (
        // A field of an embedded value is named by its path: `recibo.numero`.
        (textOf(meta, name, valueAt(meta, record, name), options.locale) ?? EMPTY)
      ),
      ...(view.help === undefined ? {} : { hint: view.help }),
      ...(name === meta?.identity ? { mono: true } : {}),
    };
  });
}

/**
 * A many2one read as a fact: the name of the record it points at, as a link that opens it where
 * the view says (`RecordOpening`: the workspace's places, «Abrir en…») — when the application
 * declared its entity. A key alone (`EntityID[Tenant]`) is named by key (`useNameOf`). Of an
 * entity nobody declared, it is the text it always was.
 *
 * Context: a fact a person read as «Globex Bolivia» led nowhere, so an application wrote its own
 * link for «this payment's member», or misused a smart button for it. A component inside the
 * fact's VALUE is fine: what web-ui finds by type are the slots, never their content.
 */
function RelationFact({
  record,
  meta,
  name,
  relation,
  locale,
}: {
  record: AnyRecord;
  meta: Meta | null | undefined;
  name: string;
  relation: RelationField;
  locale: string | undefined;
}) {
  const target = useEntityFor(relation.target);
  const opening = useRecordOpening();
  const raw = record[relation.key];
  const key = raw === null || raw === undefined ? "" : String(raw);
  const asked = useNameOf(relation.held ? undefined : target, key);
  if (target === undefined || key === "")
    return <>{textOf(meta, name, record[name], locale) ?? EMPTY}</>;
  const held = relation.held
    ? textOf(meta, relation.relation, record[relation.relation], locale)
    : null;
  return (
    <RelationValue
      name={held ?? asked ?? key}
      {...(opening === null
        ? {}
        : {
            onOpenIn: (to: OpenTarget) => opening.open(target.ref(key), to),
            openTargets: opening.targets,
          })}
    />
  );
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
 *
 * `rowActions` acts on a part from its row — a group's member, a project's share — with a
 * Command of the record (`useCommand(projects, "unshareProject")`): the parts have no route of
 * their own, so what removes one is the record's, and the screen names it.
 *
 *     <RecordLines record={project} meta={meta} name="shares"
 *       rowActions={(share) => [{ id: "unshare", label: "Quitar", icon: X, tone: "danger",
 *         onSelect: () => unshare.run(project.id, { tenant_id: share.tenant_id }) }]} />
 */
export function RecordLines<T extends AnyRecord>({
  record,
  meta,
  name,
  columns,
  cells,
  locale,
  onOpen,
  rowActions,
}: {
  record: AnyRecord;
  meta: Meta | null | undefined;
  name: string;
  columns?: readonly string[];
  cells?: Readonly<Partial<Record<string, (row: T) => ReactNode>>>;
  locale?: string | undefined;
  onOpen?: (row: T) => void;
  /** What a row's part can be acted on with — a Command of the record. */
  rowActions?: (row: T) => readonly RowAction[];
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
        {/* web-ui takes a row's actions on the table, not on the list: on the root a spread
            drops them silently (no excess-property check through a spread). */}
        <List.Table<T>
          columns={columnsOf<T>(definition, columns, { locale, ...(cells ? { cells } : {}) })}
          {...(rowActions === undefined ? {} : { rowActions })}
        />
      </List>
      {related.partial ? (
        <p className="text-meta text-muted">
          {copy.record.partial(
            related.items.length,
            related.count.value,
            related.count.exact,
          )}
        </p>
      ) : null}
    </div>
  );
}
