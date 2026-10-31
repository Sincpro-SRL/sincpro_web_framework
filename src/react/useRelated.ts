"use client";

import type { AnyRecord, Criteria } from "@sincpro/criteria";
import type { Entity } from "@sincpro/web-framework/core/entity";
import type { Listing, ListingOptions } from "@sincpro/web-framework/react/useListing";
import { useListing } from "@sincpro/web-framework/react/useListing";
import type { RecordReading } from "@sincpro/web-framework/react/useRecord";

/**
 * The records a relation of ONE record points to, as a live listing of the related entity.
 *
 * Context: sincpro_framework sends a one2many inside its record as ONE page (`RecordLines` draws
 * it). A customer with forty thousand invoices, a tenant with a thousand members, the lines of a
 * big order need more than that page: search in them, order them, walk them. The model says how
 * to ask — the related aggregate's key that points back (`identified_by`) — so the relation is
 * a criteria over the related entity, `where <that key> = <this record's key>`, answered by the
 * server like any list. The relation's scope is AND-ed with everything else, so no search, filter
 * or page can ever leave it.
 *
 *     const facturas = useRelated(cliente, "invoices", invoicesEntity);
 *     <EntityList listing={facturas} embedded />
 */
export function useRelated<P extends AnyRecord, T extends AnyRecord>(
  record: RecordReading<P>,
  name: string,
  related: Entity<T>,
  options: Omit<ListingOptions<T>, "criteria"> & { criteria?: Criteria<T> } = {},
): Listing<T> {
  const field = record.meta?.fields[name];
  const key = field?.identified_by ?? "";
  const own = record.meta?.get_id || record.meta?.identity || "id";
  const value = record.record === null ? null : (record.record as AnyRecord)[own];
  const scope: Criteria<T> = {
    ...options.criteria,
    where: {
      all: [
        ...(options.criteria?.where ? [options.criteria.where] : []),
        { field: key, operator: "=", value: value as never },
      ],
    } as never,
  };
  return useListing(related, { pageSize: 10, ...options, criteria: scope });
}
