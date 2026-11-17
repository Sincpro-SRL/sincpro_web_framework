"use client";

import { type Entity, listRoute } from "@sincpro/client-framework";
import type { AnyRecord, Criteria } from "@sincpro/criteria";
import {
  type FactTone,
  type HistoryEntry,
  historyOf,
} from "@sincpro/web-framework/core/history";
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
 * Each side of an edit is written by the record's own model when it is known (`metas`), and
 * each kind of fact takes the tone `tones` gives its `name` (`presented(entity, { facts })`).
 *
 * Named after sincpro_framework's `history_of`; web-ui's `useActivity` is something else (the
 * panel's open state).
 */
const SHOWN = 100;

export function useHistory<T extends AnyRecord>(
  entity: Entity<T>,
  id: string,
  deps: DependencyList = [],
  options: { tones?: Readonly<Record<string, FactTone>> | undefined } = {},
): HistoryEntry[] | undefined {
  const { transport, locale, context, metas, events, dateStyle, currency } = useFramework();
  const tones = options.tones;
  // By content: a screen passes its tones as a literal, a new object on every render.
  const toned = tones === undefined ? "" : JSON.stringify(tones);
  // By the events it names: an application that builds them inline must not read it again.
  const named = Object.keys(events).join("|");
  // How its texts are written: another tone, event, date style or currency writes them again.
  const written = `${toned}\u0000${named}\u0000${dateStyle}\u0000${currency ?? ""}`;
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
      (page) =>
        aborter.signal.aborted ||
        setEntries(
          historyOf(page.rows, page.meta, locale, {
            record: metas.get(entity.key),
            events,
            tones,
          }),
        ),
      () => aborter.signal.aborted || setEntries(undefined),
    );
    return () => aborter.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the caller names what reloads it
  }, [transport, history, id, locale, context, writes, written, ...deps]);

  return entries;
}
