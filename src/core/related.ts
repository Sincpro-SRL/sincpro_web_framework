import type { Count } from "@sincpro/criteria";

/**
 * The records a relation holds inside its parent, however the server sent them.
 *
 * Context: sincpro_framework answers a one2many of a record as a PAGE of its own —
 * `{items, count, cursor}` — so a tenant with a thousand members does not answer all of them;
 * an older answer, or a domain declared by hand, sends a bare array. A screen that reads only
 * `items` and counts them shows the first page and calls it the total (forge's console did:
 * `count={repositories.length}`). This reads both shapes and keeps the real count.
 *
 *     relatedOf({ items: [a, b], count: { value: 1000, exact: true }, cursor: "x" })
 *       -> { items: [a, b], count: { value: 1000, exact: true }, cursor: "x", partial: true }
 *     relatedOf([a, b])  -> { items: [a, b], count: { value: 2, exact: true }, cursor: null, partial: false }
 */
export type Related<T> = {
  items: T[];
  count: Count;
  cursor: string | null;
  /** There are more than `items` holds: the record brought one page of them. */
  partial: boolean;
};

type Page<T> = { items?: T[]; count?: Count | null; cursor?: string | null };

export function relatedOf<T>(value: unknown): Related<T> {
  if (Array.isArray(value))
    return {
      items: value as T[],
      count: { value: value.length, exact: true },
      cursor: null,
      partial: false,
    };
  if (typeof value === "object" && value !== null && "items" in value) {
    const page = value as Page<T>;
    const items = page.items ?? [];
    const count = page.count ?? { value: items.length, exact: page.cursor == null };
    return {
      items,
      count,
      cursor: page.cursor ?? null,
      partial: count.value > items.length || !count.exact || page.cursor != null,
    };
  }
  return { items: [], count: { value: 0, exact: true }, cursor: null, partial: false };
}
