import {
  type EntityCollection,
  isCollection,
  isPartial,
  totalOf,
} from "@sincpro/client-framework";
import type { Count } from "@sincpro/criteria";

/**
 * The records a relation holds inside its parent, however the server sent them.
 *
 * Context: sincpro_framework answers a one2many of a record as a PAGE of its own —
 * `{items, count, cursor}` — so a tenant with a thousand members does not answer all of them;
 * an older answer, or a domain declared by hand, sends a bare array. A screen that reads only
 * `items` and counts them shows the first page and calls it the total (forge's console did:
 * `count={repositories.length}`). This reads both shapes and keeps the real count — a floor
 * («at least 1000») when the backend stopped counting at its cap.
 *
 * Built on @sincpro/client-framework's `EntityCollection` (`isCollection`, `isPartial`,
 * `totalOf`): a screen keeps this shape, with `count` always said.
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

export function relatedOf<T>(value: unknown): Related<T> {
  // The shapes, and what «partial» means, are @sincpro/client-framework's — the same rule as the
  // backend's `is_partial` on every platform. Read without copying: a table reads this for every
  // one2many cell of a page.
  if (Array.isArray(value))
    return {
      items: value as T[],
      count: { value: value.length, exact: true },
      cursor: null,
      partial: false,
    };
  if (!isCollection(value))
    return { items: [], count: { value: 0, exact: true }, cursor: null, partial: false };
  const page = value as EntityCollection<T>;
  return {
    items: (page.items ?? []) as T[],
    count: totalOf(page),
    cursor: page.cursor ?? null,
    partial: isPartial(page),
  };
}
