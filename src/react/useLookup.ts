"use client";

import type { AnyRecord } from "@sincpro/criteria";
import type { Entity } from "@sincpro/web-framework/core/entity";
import { lookupOf, type LookupOption } from "@sincpro/web-framework/core/lookup";
import { useListing } from "@sincpro/web-framework/react/useListing";

/**
 * The records of an entity as choices — the literal search of a many2one.
 *
 * Context: it is a listing like any other — the entity's own search template fills with what
 * is typed, debounced, asked of the server — whose rows are read as choices (`lookupOf`). One
 * page at a time: a select over ten thousand customers loads the first page and the next on
 * demand, never the table.
 */
export type Lookup = {
  options: LookupOption[];
  text: string;
  search: (text: string) => void;
  loading: boolean;
  hasMore: boolean;
  more: () => void;
};

export function useLookup<T extends AnyRecord>(
  entity: Entity<T>,
  options: { pageSize?: number } = {},
): Lookup {
  // «More», not pages: a choice list grows downwards, and its ceiling keeps it light.
  const listing = useListing(entity, { paging: "more", pageSize: options.pageSize ?? 50 });
  return {
    options: lookupOf(listing.meta, listing.rows),
    text: listing.text,
    search: listing.search,
    loading: listing.status === "loading",
    hasMore: listing.hasMore,
    more: listing.more,
  };
}
