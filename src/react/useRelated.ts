"use client";

import { type Entity } from "@sincpro/client-framework";
import type { AnyRecord, Criteria } from "@sincpro/criteria";
import { relatedScope } from "@sincpro/web-framework/core/relation";
import type { Listing, ListingOptions } from "@sincpro/web-framework/react/useListing";
import { useListing } from "@sincpro/web-framework/react/useListing";
import type { RecordReading } from "@sincpro/web-framework/react/useRecord";

/**
 * The records a relation of ONE record points to, as a live listing of the related entity.
 *
 * Context: sincpro_framework sends a one2many inside its record as ONE page (`RecordLines` draws
 * it). A customer with forty thousand invoices, a tenant with a thousand members, the lines of a
 * big order need more than that page: search in them, order them, walk them. The model says how
 * to ask — the related aggregate's key that points back (`identified_by`), or the two fields of a
 * relation by a business key (`parent_field`, `related_field`) — so the relation is a criteria
 * over the related entity (@sincpro/client-framework's `relatedCriteria`), answered by the server
 * like any list. The relation's scope is AND-ed with everything else, so no search, filter or
 * page can ever leave it.
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
  const own = record.meta?.get_id || record.meta?.identity || "id";
  const asked = relatedScope<T>(
    record.record as AnyRecord | null,
    field,
    own,
    options.criteria,
  );
  // No key to ask by yet — the record or its definition has not arrived, or the record is new: a
  // question that matches nothing (an empty `in`), never one that would list every orphan. It is
  // asked over the field that points back when the definition names it: the related entity has
  // that one, and it may have no `id`.
  const nothing = field?.related_field || field?.identified_by || "id";
  const scope: Criteria<T> = asked ?? {
    ...options.criteria,
    selection: { field: nothing, operator: "in", value: [] } as never,
  };
  return useListing(related, { pageSize: 10, ...options, criteria: scope });
}
