"use client";

import type { AnyRecord, Criteria } from "@sincpro/criteria";
import type { Entity } from "@sincpro/web-framework/core/entity";
import { type HistoryEntry, historyOf } from "@sincpro/web-framework/core/history";
import { useFramework } from "@sincpro/web-framework/react/context";
import { type DependencyList, useEffect, useState } from "react";

/**
 * A record's business events, newest first — what `Record.Activity` draws.
 *
 * Context: the history of a record is a criteria over its context's events — `entity_type`
 * and `entity_id` — so it is read like any list, with the same transport. `undefined` while it
 * is not read, or when it cannot be: an empty history says «nothing happened», which is a
 * different claim from «you may not see it». Pass the record among `deps` so a write that
 * reloads it reads its new facts too.
 *
 * Named after sincpro_framework's `history_of`; web-ui's `useActivity` is something else (the
 * panel's open state).
 */
const SHOWN = 100;

export function useHistory<T extends AnyRecord>(
  entity: Entity<T>,
  id: string,
  deps: DependencyList = [],
): HistoryEntry[] | undefined {
  const { transport, locale } = useFramework();
  const [entries, setEntries] = useState<HistoryEntry[] | undefined>(undefined);
  const history = entity.history;

  useEffect(() => {
    if (history === undefined) return;
    const aborter = new AbortController();
    const criteria: Criteria = {
      where: {
        all: [
          { field: "entity_type", operator: "=", value: history.type },
          { field: "entity_id", operator: "=", value: id },
        ],
      },
      order: [{ field: "created_at", descending: true }],
      pagination: { limit: SHOWN },
    };
    transport.list<AnyRecord>(history.route, criteria, aborter.signal).then(
      (page) => aborter.signal.aborted || setEntries(historyOf(page.rows, page.meta, locale)),
      () => aborter.signal.aborted || setEntries(undefined),
    );
    return () => aborter.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the caller names what reloads it
  }, [transport, history, id, locale, ...deps]);

  return entries;
}
