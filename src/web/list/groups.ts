import { type AnyRecord, type Bucket, labelOf, type Meta } from "@sincpro/criteria";
import { frameworkCopy } from "@sincpro/web-framework/core/copy";
import { detailOf } from "@sincpro/web-framework/core/measure";
import { textOf } from "@sincpro/web-framework/core/present";
import type { GroupLevel } from "@sincpro/web-framework/react/useGroups";
import {
  dateLabel,
  type GroupableField,
  type GroupGrain,
  pathKey,
  type Pile,
} from "@sincpro/web-ui";

/**
 * Grouping, as web-ui draws it: which fields may split a set, and the server's groups as the
 * piles a `List` shows.
 *
 * Context: web-ui keeps «what was asked» (`GroupLevel`) apart from «what is drawn» (`Pile`)
 * precisely so that piles can come counted from whoever keeps the data. These are the two
 * translations from the model and from criteria's `Bucket`.
 */

/** The cuts a date offers, coarse to fine — web-ui orders the levels by them. */
const DATE_GRAINS: readonly GroupGrain[] = ["year", "quarter", "month", "week", "day"];

/**
 * The fields the model says may split a set (`groupable`), in its words. The identity splits
 * into groups of one, and the version means nothing to a person: neither is offered. With
 * `only`, the screen's own choice among them, in its order — a name the model does not let
 * split the set is still not offered.
 *
 * Context: sincpro_framework marks a field groupable by its TYPE, so a context's log offered
 * «group by» `correlation_id` and `causation_id`. Which of them mean something to a person is
 * the model's to say (ROADMAP); until it does, and wherever a screen knows better, the screen
 * names them (`EntityList groupable`, `defineList({ groupable })`). Never a list of technical
 * names kept here.
 */
export function groupableOf(
  meta: Meta | null,
  locale?: string,
  only?: readonly string[],
): GroupableField[] {
  if (meta === null) return [];
  const names = only ?? Object.keys(meta.fields);
  return names
    .map((name) => [name, meta.fields[name]] as const)
    .filter(
      (entry): entry is readonly [string, NonNullable<(typeof entry)[1]>] =>
        entry[1] !== undefined &&
        entry[1].groupable === true &&
        entry[1].kind === "scalar" &&
        entry[0] !== meta.identity &&
        entry[0] !== "version",
    )
    .map(([name, field]) => ({
      field: name,
      label: labelOf(meta, name, locale),
      ...(field.type === "date" || field.type === "datetime" ? { grains: DATE_GRAINS } : {}),
    }));
}

/** A summed figure as a number — the wire may carry an exact decimal as text («1204.50»). */
function figureOf(value: unknown): number | undefined {
  const figure =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return value === "" || !Number.isFinite(figure) ? undefined : figure;
}

/**
 * The server's groups as piles, with the words a person reads, and each pile's group so that
 * opening one reads its rows. Rows sit only on the deepest level, once read.
 *
 * What the server summed for a group is its `totals` — web-ui (2.9) says each figure under its
 * column in a grouped table and a sheet, as Odoo's grouped list — and, in words beside the
 * group's name (`detail`), what no column on screen says: a board's card has no columns.
 */
export function pilesOf<T extends AnyRecord>(
  buckets: readonly Bucket<T>[],
  levels: readonly GroupLevel[],
  meta: Meta | null,
  locale: string | undefined,
  rowsOf: (bucket: Bucket<T>) => readonly T[] | undefined,
  /** What a group's next «more» brings (`Pile.more`); omitted, web-ui says nothing about it. */
  brings?: (bucket: Bucket<T>) => number | false | undefined,
  /** The figures a column on screen already says under itself: not said again in words. */
  underColumns: ReadonlySet<string> = new Set(),
): { piles: Pile<T>[]; bucketAt: ReadonlyMap<string, Bucket<T>>; deepest: number } {
  const bucketAt = new Map<string, Bucket<T>>();
  const none = frameworkCopy().list.noValue;

  const labelFor = (bucket: Bucket<T>, depth: number, key: string): string => {
    const level = levels[depth];
    if (bucket.value === null || bucket.value === undefined || bucket.value === "")
      return none;
    if (level?.grain) {
      const within = levels
        .slice(0, depth)
        .flatMap((one) => (one.field === level.field && one.grain ? [one.grain] : []));
      return dateLabel(key, level.grain, within);
    }
    return textOf(meta, bucket.field, bucket.value, locale) || key;
  };

  const summed = (bucket: Bucket<T>) => {
    const measures = Object.entries(bucket.measures ?? {});
    const totals = Object.fromEntries(
      measures.flatMap(([field, value]) => {
        const figure = figureOf(value);
        return figure === undefined ? [] : [[field, figure] as const];
      }),
    );
    const inWords = measures.filter(([field]) => !underColumns.has(field));
    const detail = detailOf(meta, Object.fromEntries(inWords), locale);
    return {
      ...(Object.keys(totals).length === 0 ? {} : { totals }),
      ...(detail === undefined ? {} : { detail }),
    };
  };

  const more = (bucket: Bucket<T>, deepest: boolean): { more?: number | false } => {
    const next = deepest ? brings?.(bucket) : undefined;
    return next === undefined ? {} : { more: next };
  };

  const walk = (
    level: readonly Bucket<T>[],
    above: readonly string[],
    depth: number,
  ): Pile<T>[] =>
    level.map((bucket) => {
      const key =
        bucket.value === null || bucket.value === undefined ? "" : String(bucket.value);
      const path = [...above, key];
      bucketAt.set(pathKey(path), bucket);
      const below = bucket.groups ?? [];
      return {
        path,
        depth,
        field: bucket.field,
        key,
        label: labelFor(bucket, depth, key),
        count: bucket.count,
        ...summed(bucket),
        items: below.length === 0 ? [...(rowsOf(bucket) ?? [])] : [],
        piles: walk(below, path, depth + 1),
        ...more(bucket, below.length === 0),
      };
    });

  return { piles: walk(buckets, [], 0), bucketAt, deepest: levels.length - 1 };
}
