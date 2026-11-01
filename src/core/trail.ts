import type { AnyRecord, Criteria } from "@sincpro/criteria";
import { resumingFrom } from "@sincpro/criteria";
import type { Transport } from "@sincpro/web-framework/core/transport";

/**
 * Where a record was opened from: the page of the list it was a row of, so the record can go
 * to the previous and the next one — «3 / 64» and two arrows — without going back to the list.
 *
 * Context: Odoo keeps the ids of the whole search in the browser to page through records. That
 * caps at what was loaded. Here the trail keeps ONE page and the server's cursors around it: at
 * the edge of the page it asks the server for the neighbouring page, with the same question —
 * scope, search, filter, order — so the record after the last of page 4 000 is one request, as
 * cheap as the first. Over a list of millions the arrows never stop at the page.
 */
export type Trail = {
  route: string;
  /** The list's question, without a page: what the neighbouring pages are asked with. */
  question: Criteria;
  /** The field the ids are read from. */
  key: string;
  /** The ids of the page on screen, in order. */
  ids: readonly string[];
  /** Where that page starts in the whole set, counting from 0. */
  offset: number;
  /** Rows per page: the cursors belong to pages of this size, and only to them. */
  size: number;
  /** The cursors that start each page up to this one (`null`: the first page). */
  cursors: readonly (string | null)[];
  /** The cursor that starts the next page; `null` when this is the last. */
  after: string | null;
  /** How many there are in all, when the server counted them. */
  total: number | null;
};

/** Where a record stands in its trail: «3 of 64», 1-based. */
export function placeOf(trail: Trail, id: string): { index: number; total: number } | null {
  const at = trail.ids.indexOf(id);
  if (at < 0) return null;
  const index = trail.offset + at + 1;
  return { index, total: Math.max(trail.total ?? 0, trail.offset + trail.ids.length, index) };
}

async function page(
  transport: Transport,
  trail: Trail,
  cursor: string | null,
): Promise<{ ids: string[]; after: string | null }> {
  const sized: Criteria = {
    ...trail.question,
    pagination: { ...trail.question.pagination, limit: trail.size },
  };
  const answer = await transport.list<AnyRecord>(trail.route, {
    ...resumingFrom(sized, cursor),
    meta: false,
  });
  return {
    ids: answer.rows.map((row) => String(row[trail.key] ?? "")),
    after: answer.cursor,
  };
}

/**
 * The record next to `id` (`step` 1) or before it (`step` -1), with the trail moved to its page
 * when it lies on the neighbouring one. `null` at either end of the set.
 */
export async function stepIn(
  transport: Transport,
  trail: Trail,
  id: string,
  step: 1 | -1,
): Promise<{ id: string; trail: Trail } | null> {
  const at = trail.ids.indexOf(id);
  if (at < 0) return null;
  const there = trail.ids[at + step];
  if (there !== undefined) return { id: there, trail };
  if (step === 1) {
    if (trail.after === null) return null;
    const next = await page(transport, trail, trail.after);
    const [first] = next.ids;
    if (first === undefined) return null;
    return {
      id: first,
      trail: {
        ...trail,
        ids: next.ids,
        offset: trail.offset + trail.ids.length,
        cursors: [...trail.cursors, trail.after],
        after: next.after,
      },
    };
  }
  if (trail.cursors.length < 2) return null;
  const cursors = trail.cursors.slice(0, -1);
  const before = await page(transport, trail, cursors[cursors.length - 1] ?? null);
  const last = before.ids[before.ids.length - 1];
  if (last === undefined) return null;
  return {
    id: last,
    trail: {
      ...trail,
      ids: before.ids,
      offset: Math.max(0, trail.offset - before.ids.length),
      cursors,
      after: trail.cursors[trail.cursors.length - 1] ?? null,
    },
  };
}
