"use client";

import type { AnyRecord } from "@sincpro/criteria";
import type { Entity } from "@sincpro/web-framework/core/entity";
import type { RecordReading } from "@sincpro/web-framework/react/useRecord";
import { useRelated } from "@sincpro/web-framework/react/useRelated";
import { EntityList, type EntityListProps } from "@sincpro/web-framework/web/list/EntityList";

/**
 * A relation of a record as a list inside it — searched, ordered and paged by the server.
 *
 * Context: the same `EntityList` a screen uses, `embedded` so it reads as a field of the record
 * (a one-line bar that does not stick), over `useRelated`. Its search box fills the RELATED
 * entity's own search template: the lines of an order are searched by product, the invoices of
 * a customer by number. Use `RecordLines` when the page the record brought is all there is.
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
  return <EntityList listing={listing} embedded search="box" {...list} />;
}
