"use client";

import { type Entity, listRoute } from "@sincpro/client-framework";
import type { AnyRecord, Criteria } from "@sincpro/criteria";
import { type HistoryEntry, historyOf } from "@sincpro/web-framework/core/history";
import { useFramework } from "@sincpro/web-framework/react/context";
import { useWrites } from "@sincpro/web-framework/react/useWrites";
import { type DependencyList, useEffect, useState } from "react";

/**
 * A record's business events, newest first — what `Record.Activity` draws.
 *
 * Context: the backend answers a record's events itself — sincpro_framework's `DomainEvents`,
 * the entity's `history` route (`/issues/{id}/events`), which the generator writes from the
 * contract — so it is read like any list, with the same transport, newest first. `undefined`
 * while it is not read, for a record not saved yet, or when it cannot be read: an empty history
 * says «nothing happened», which is a different claim from «you may not see it». Pass the
 * record among `deps` so a write that reloads it reads its new facts too.
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
  const { transport, locale, context } = useFramework();
  const [entries, setEntries] = useState<HistoryEntry[] | undefined>(undefined);
  const history = entity.history;
  // A write under the record — anyone's — adds a fact to its history: read it again.
  const writes = useWrites(
    history === undefined || id === "" ? undefined : listRoute(history, { id }),
  );

  useEffect(() => {
    if (history === undefined || id === "") {
      setEntries(undefined);
      return;
    }
    const aborter = new AbortController();
    const criteria: Criteria = {
      order: [{ field: "created_at", descending: true }],
      pagination: { limit: SHOWN },
    };
    transport.list<AnyRecord>(listRoute(history, { id }), criteria, aborter.signal).then(
      (page) => aborter.signal.aborted || setEntries(historyOf(page.rows, page.meta, locale)),
      () => aborter.signal.aborted || setEntries(undefined),
    );
    return () => aborter.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the caller names what reloads it
  }, [transport, history, id, locale, context, writes, ...deps]);

  return entries;
}
