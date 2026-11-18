"use client";

import type { AnyRecord, Meta } from "@sincpro/criteria";
import { frameworkCopy } from "@sincpro/web-framework/core/copy";
import { type Total, totalOf } from "@sincpro/web-framework/core/measure";
import {
  BOOKKEEPING,
  defaultFields,
  fieldMetaOf,
  sortKeyOf,
  textOf,
  valueAt,
  viewOf,
} from "@sincpro/web-framework/core/present";
import { relationFieldOf } from "@sincpro/web-framework/core/relation";
import { useEntityFor } from "@sincpro/web-framework/react/context";
import { useNameOf } from "@sincpro/web-framework/react/useNameOf";
import type { ChoiceTones } from "@sincpro/web-framework/web/list/presentation";
import { type Aggregate, type DataColumn, Tag } from "@sincpro/web-ui";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

/**
 * The columns of a table, from the model: name the fields, the rest follows.
 *
 * Context: forge's lists wrote every column by hand — `header: "nombre"`, `value: (p) =>
 * p.display_name`, a date formatter per screen — while the server already said what each field
 * is called and what type it holds. Here a column is a NAME: its header is the model's label,
 * its cell the text the value reads as (`textOf`), its sort key the raw value, and whether it
 * can be ordered is what the server said (`sortable`). A cell is drawn by its TYPE: a choice is a
 * tag in the tone the application declared for its value (`presented(entity, { tones })`), a
 * yes/no a check, an amount the model draws as money is money. A cell that needs more — a link,
 * a figure of its own — is the one thing a screen writes (`cells`). A column that holds a key of
 * another record (`organo_id`, an `EntityID`) reads the record's name, as its picker does: every
 * key of the page asked in ONE request per entity (`useNameOf`), the key until it answers.
 *
 * A column the model adds up at a list's foot (`total`: `sum`, `avg`, `min`, `max`) declares it
 * (`aggregate`), with its own format: the foot reads «Bs 1.204,50» like the cells above it.
 *
 * The fields NOT named still exist: they come after, `optional` and hidden, so the columns
 * menu offers them and nobody edits the screen to see a field the server already sends.
 */
/** The types whose value is one short thing, read whole. */
const DATES = new Set(["date", "datetime", "time"]);

export type ColumnOptions<T> = {
  locale?: string | undefined;
  /** The cells that are not plain text, by field name. */
  cells?: Readonly<Partial<Record<string, (row: T) => ReactNode>>>;
  /** The colour of each value of a choice (`presented(entity, { tones })`). */
  tones?: ChoiceTones<T> | undefined;
};

/** The model's `total` as web-ui's aggregate. */
const AGGREGATES: Readonly<Record<Total, Aggregate>> = {
  sum: "sum",
  avg: "mean",
  min: "min",
  max: "max",
};

/** How the model adds a field up at a list's foot, as web-ui's `aggregate`. */
export function aggregateOf(
  meta: Meta | null | undefined,
  name: string,
): Aggregate | undefined {
  const total = totalOf(meta, name);
  return total === undefined ? undefined : AGGREGATES[total];
}

/** A key's cell: the name of the record it points at, the key until it answers or when the
 *  application declared no entity for it. */
function KeyName({ target, id }: { target: string; id: string }) {
  return <>{useNameOf(useEntityFor(target), id) ?? id}</>;
}

function columnOf<T extends AnyRecord>(
  meta: Meta | null | undefined,
  name: string,
  options: ColumnOptions<T>,
  hidden: boolean,
): DataColumn<T> {
  const view = viewOf(meta, name, options.locale);
  const field = fieldMetaOf(meta, name);
  const raw = (row: T) => valueAt(meta, row, name);
  const text = (row: T) => textOf(meta, name, raw(row), options.locale) ?? "";
  const own = options.cells?.[name];
  // A code, a date, an amount is read whole: «F-2026-0060» in three lines is three values.
  const money = field?.widget === "money";
  const whole = view.name === meta?.identity || view.numeric || money || DATES.has(view.type);
  const tones = options.tones?.[name as keyof T & string];
  const choice = (field?.choices?.length ?? 0) > 0;
  const aggregate = aggregateOf(meta, name);
  // The column IS a key of another record: `customer_id` beside its relation, or a key alone.
  const relation = relationFieldOf(meta, name);
  const pointing =
    relation !== undefined && !relation.many && relation.key === name ? relation : undefined;
  const named =
    pointing === undefined
      ? undefined
      : (row: T) => {
          const key = raw(row);
          if (key === null || key === undefined || key === "") return null;
          // Held beside its key, the record names itself; a key alone asks its name.
          const held =
            pointing.relation === name
              ? null
              : textOf(meta, pointing.relation, row[pointing.relation], options.locale);
          return held ?? <KeyName target={pointing.target} id={String(key)} />;
        };
  return {
    id: name,
    header: view.label,
    field: name,
    value: (row) => sortKeyOf(meta, name, raw(row)),
    cell:
      own ??
      named ??
      (choice
        ? // A state reads at a glance: its word in a tag, in the tone the application gave it.
          (row: T) => {
            const word = text(row);
            return word === "" ? null : (
              <Tag tone={tones?.[String(raw(row))] ?? "neutral"}>{word}</Tag>
            );
          }
        : view.type === "boolean"
          ? // A yes is a check and a no is nothing: a column of «sí/no» is noise to scan.
            (row: T) =>
              raw(row) === true ? (
                <Check
                  role="img"
                  aria-label={frameworkCopy().value.yes}
                  className="size-(--size-icon-sm)"
                />
              ) : null
          : whole
            ? (row: T) => <span className="whitespace-nowrap">{text(row)}</span>
            : text),
    text,
    numeric: view.numeric || money,
    sortable: view.sortable,
    ...(view.name === meta?.identity ? { mono: true } : {}),
    ...(hidden ? { optional: true, defaultHidden: true } : {}),
    ...(aggregate === undefined
      ? {}
      : {
          aggregate,
          // The foot reads as the cells above it: «Bs 1.204,50», not «1204.5».
          format: (value: number) =>
            textOf(meta, name, value, options.locale) ?? String(value),
        }),
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
