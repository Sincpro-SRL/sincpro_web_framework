"use client";

import type { AnyRecord } from "@sincpro/criteria";
import { type Rehearsal, useRouteCommand } from "@sincpro/web-framework/react/useCommand";
import type { RecordReading } from "@sincpro/web-framework/react/useRecord";

/** An action on the record itself: done, or rehearsed first — what a destructive button draws
 *  (`RecordLifecycle`, `ActionButton`). It answers `null` when done, `undefined` when refused. */
export type LifecycleAction = {
  run: () => Promise<null | undefined>;
  rehearse: () => Promise<Rehearsal | undefined>;
  busy: boolean;
  error: unknown;
  rehearsal: Rehearsal | null;
  reset: () => void;
};

/** What the record's entity lets be done to the record itself, each only when declared. */
export type RecordLifecycleActions = {
  /** sincpro_framework's `Delete`: gone, its fact kept in the history. */
  delete?: LifecycleAction;
};

/**
 * The record's own lifecycle, as actions of ONE stored record: what its entity declares of
 * sincpro_framework's `Delete` (`entity.delete`, client-framework 1.12).
 *
 *     const lifecycle = useRecordLifecycle(member);
 *     lifecycle.delete?.rehearse()   // «Se eliminará Ana Pérez»: nothing touched
 *     lifecycle.delete?.run()        // null: gone
 *
 * Context: an application wrote a Command and a Feature per aggregate to delete one, and a
 * confirm of its own. The backend publishes the generic `Delete` (3.37): a `DryRunnable` whose
 * dry run answers what would go, refused when the record moved past the version read
 * (`origin_version`), answering nothing. So each action sends the version this screen read and
 * rehearses with the same body: the confirmation is the server's word on THIS version. A new
 * record, or one not read yet, has none. Over REST a `DELETE`'s fields travel in its query string
 * (client-framework 1.12): sent in a body, a dry run would run the real delete.
 */
export function useRecordLifecycle<T extends AnyRecord>(
  record: RecordReading<T>,
): RecordLifecycleActions {
  const { entity } = record;
  const deletion = useRouteCommand<null>(entity.delete, entity.key);
  const stored = !record.isNew && record.status === "ready";
  if (!stored || entity.delete === undefined) return {};
  const version = (record.record as AnyRecord)["version"];
  const checked: AnyRecord = typeof version === "number" ? { origin_version: version } : {};
  return {
    delete: {
      run: () => deletion.run(record.id, checked),
      rehearse: () => deletion.rehearse(record.id, checked),
      busy: deletion.busy,
      error: deletion.error,
      rehearsal: deletion.rehearsal,
      reset: deletion.reset,
    },
  };
}
