"use client";

import { type Entity } from "@sincpro/client-framework";
import type { AnyRecord } from "@sincpro/criteria";
import { frameworkCopy } from "@sincpro/web-framework/core/copy";
import { defaultFields } from "@sincpro/web-framework/core/present";
import { backReference } from "@sincpro/web-framework/core/relation";
import type { RecordReading } from "@sincpro/web-framework/react/useRecord";
import { useRelated } from "@sincpro/web-framework/react/useRelated";
import { EntityList, type EntityListProps } from "@sincpro/web-framework/web/list/EntityList";
import { useRecordOpening } from "@sincpro/web-framework/web/record/opening";
import { Button } from "@sincpro/web-ui";
import { useMemo } from "react";

/**
 * A relation of a record as a list inside it — searched, ordered and paged by the server.
 *
 * Context: the same `EntityList` a screen uses, `embedded` so it reads as a field of the record
 * (a one-line bar that does not stick), over `useRelated`. Its search box fills the RELATED
 * entity's own search template: the lines of an order are searched by product, the invoices of
 * a customer by number. The column that points back to this record is left out — it is the
 * same on every row. Use `RecordLines` when the page the record brought is all there is.
 *
 * «Agregar» opens the form of a new related record already pointing back here, where the view
 * says (`RecordOpening.create`: a modal that answers, in a workspace), and the list is read
 * again once it exists. Never a row of the table: each one is an aggregate with its own create,
 * rules and preview. There is none while this record does not exist yet — there is nothing to
 * point back to — nor when the relation is read only or the entity cannot be created.
 */
export function RelatedList<P extends AnyRecord, T extends AnyRecord>({
  record,
  name,
  entity,
  pageSize,
  ...list
}: {
  record: RecordReading<P>;
  name: string;
  entity: Entity<T>;
  pageSize?: number;
} & Omit<EntityListProps<T>, "listing" | "embedded">) {
  const listing = useRelated(
    record,
    name,
    entity,
    pageSize === undefined ? {} : { pageSize },
  );
  const opening = useRecordOpening();
  // Every row points back to THIS record: the column that says so is the same on all of them —
  // the same key `useRelated` scopes the list by, by identity or by a business key.
  const identity = record.meta?.get_id || record.meta?.identity || "id";
  const pointing = backReference(
    record.record as AnyRecord | null,
    record.meta?.fields[name],
    identity,
  );
  const back = pointing?.field;
  const own = list.columns;
  const columns = useMemo(
    () =>
      own ??
      (listing.meta === null || !back
        ? undefined
        : defaultFields(listing.meta).filter((field) => field !== back)),
    [own, listing.meta, back],
  );
  const create = opening?.create;
  // The value the rows point back with.
  const here = pointing?.value;
  const adding =
    create === undefined ||
    entity.create === undefined ||
    !back ||
    record.isNew ||
    here === undefined ||
    record.edit.state(name).readonly ? null : (
      <Button
        size="sm"
        role="secondary"
        onClick={() => create(entity, { [back]: here }, listing.reload)}
      >
        {frameworkCopy().record.add}
      </Button>
    );
  return (
    <EntityList
      listing={listing}
      embedded
      // The bar, not a box: a relation of records is searched like any list of records —
      // named filters, the criteria builder, grouping. A screen that wants a box passes one.
      {...list}
      {...(columns === undefined ? {} : { columns })}
      {...(adding === null && list.actions === undefined
        ? {}
        : {
            actions: (
              <>
                {list.actions}
                {adding}
              </>
            ),
          })}
    />
  );
}
