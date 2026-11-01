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

/** The fields the model says may split a set (`groupable`), in its words. The identity splits
 *  into groups of one, and the version means nothing to a person: neither is offered. */
export function groupableOf(meta: Meta | null, locale?: string): GroupableField[] {
  if (meta === null) return [];
  return Object.entries(meta.fields)
    .filter(
      ([name, field]) =>
        field.groupable === true &&
        field.kind === "scalar" &&
        name !== meta.identity &&
        name !== "version",
    )
    .map(([name, field]) => ({
      field: name,
      label: labelOf(meta, name, locale),
      ...(field.type === "date" || field.type === "datetime" ? { grains: DATE_GRAINS } : {}),
    }));
}

/**
 * The server's groups as piles, with the words a person reads, and each pile's group so that
 * opening one reads its rows. Rows sit only on the deepest level, once read.
 */
export function pilesOf<T extends AnyRecord>(
  buckets: readonly Bucket<T>[],
  levels: readonly GroupLevel[],
  meta: Meta | null,
  locale: string | undefined,
  rowsOf: (bucket: Bucket<T>) => readonly T[] | undefined,
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

  const detailed = (bucket: Bucket<T>) => {
    const detail = detailOf(meta, bucket.measures, locale);
    return detail === undefined ? {} : { detail };
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
        ...detailed(bucket),
        items: below.length === 0 ? [...(rowsOf(bucket) ?? [])] : [],
        piles: walk(below, path, depth + 1),
      };
    });

  return { piles: walk(buckets, [], 0), bucketAt, deepest: levels.length - 1 };
}
