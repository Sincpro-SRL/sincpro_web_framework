"use client";

import type { AnyRecord, Meta } from "@sincpro/criteria";
import type { Entity } from "@sincpro/web-framework/core/entity";
import { type RecordSummary, summaryOf } from "@sincpro/web-framework/core/summary";
import { useFramework } from "@sincpro/web-framework/react/context";
import { useCallback } from "react";

/**
 * The summary of any record of an entity, read with the model this application already knows
 * for it (a list or a record of it was read, or `metas` preloaded it) and in its language.
 *
 * Context: a function, not a summary, so a list of N rows asks once and summarizes each row.
 * The model is looked up on every call: it may arrive after the first render (the first page
 * of a list brings it), and the next render of whoever holds the rows reads it.
 *
 *     const summarize = useSummaryOf(contactos);
 *     <RecordCard {...cardOf(summarize(row))} />
 */
export function useSummaryOf<T extends AnyRecord>(
  entity: Entity<T>,
): (record: AnyRecord, meta?: Meta | null) => RecordSummary {
  const { metas, locale } = useFramework();
  return useCallback(
    (record, meta) =>
      summaryOf(meta ?? metas.get(entity.key) ?? null, record, {
        fields: entity.summary,
        ...(locale === undefined ? {} : { locale }),
      }),
    [metas, entity, locale],
  );
}
