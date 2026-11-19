"use client";

import {
  allMatching,
  isChosen,
  NOTHING_CHOSEN,
  type Selection,
  sizeOf,
  toggled,
} from "@sincpro/client-framework";
import type { AnyRecord } from "@sincpro/criteria";
import type { Listing } from "@sincpro/web-framework/react/useListing";
import { useCallback, useMemo, useState } from "react";

/**
 * What is chosen in a list, and how a screen changes it — one state, reachable from outside the
 * list: a bulk action reads it, a screen sets it, a chooser answers it.
 */
export type ListSelection<T extends AnyRecord = AnyRecord> = {
  /** The value (@sincpro/client-framework's `Selection`): these keys, or every record the
   *  list's question matches but some. */
  selection: Selection<T>;
  /** How many are chosen; `null` when «all that match» has no exact count. */
  size: number | null;
  isChosen: (key: string) => boolean;
  toggle: (key: string) => void;
  /** Every record the list's question matches, as the server counted them. */
  chooseAllMatching: () => void;
  clear: () => void;
  set: (selection: Selection<T>) => void;
};

/**
 * The selection of a list: ticking chooses keys, «Elegir los 187 que coinciden» chooses the
 * list's question — its scope, search and filter — with the total the server counted.
 *
 *     const listing = useListing(invoices);
 *     const chosen = useSelection(listing);
 *     <EntityList listing={listing} selectable selection={chosen} />
 *     <ConfirmAll selection={chosen.selection} />
 *
 * Context: `EntityList` kept what was ticked in its own state — the page's keys, reachable by
 * nothing outside it. The value is client-framework's, the same a phone or a script holds; this
 * is only where a screen keeps it.
 *
 * Another question is another set: a selection made under one filter is forgotten when the
 * list's question changes — what was chosen is not among what is on screen anymore.
 */
export function useSelection<T extends AnyRecord>(listing: Listing<T>): ListSelection<T> {
  const asked = listing.question.selection;
  const question = useMemo(() => JSON.stringify(asked ?? null), [asked]);
  const [held, setHeld] = useState<{ question: string; selection: Selection<T> }>({
    question,
    selection: NOTHING_CHOSEN,
  });
  // Held under the question it was made for: under another one, nothing is chosen.
  const selection = held.question === question ? held.selection : NOTHING_CHOSEN;
  const set = useCallback(
    (next: Selection<T>) => setHeld({ question, selection: next }),
    [question],
  );
  const total = listing.count?.exact === true ? listing.count.value : null;

  return {
    selection,
    size: sizeOf(selection),
    isChosen: (key) => isChosen(selection, key),
    toggle: (key) => set(toggled(selection, key)),
    chooseAllMatching: () => set(allMatching(asked, total)),
    clear: () => set(NOTHING_CHOSEN),
    set,
  };
}
