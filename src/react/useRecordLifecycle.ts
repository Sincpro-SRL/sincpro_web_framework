"use client";

import type { AnyRecord } from "@sincpro/criteria";
import {
  type CommandState,
  type Rehearsal,
  useRouteCommand,
} from "@sincpro/web-framework/react/useCommand";
import type { RecordReading } from "@sincpro/web-framework/react/useRecord";

/** An action on the record itself — what `RecordLifecycle` draws with `ActionButton`'s gesture:
 *  one that destroys can `rehearse` first; one that can be undone runs on the click. It answers
 *  `null` when done, `undefined` when refused. */
export type LifecycleAction = {
  run: () => Promise<null | undefined>;
  rehearse?: () => Promise<Rehearsal | undefined>;
  busy: boolean;
  error: unknown;
  rehearsal: Rehearsal | null;
  reset: () => void;
};

/** What the record's entity lets be done to the record itself, each only when declared. */
export type RecordLifecycleActions = {
  /** sincpro_framework's `Delete`: gone, its fact kept in the history. Rehearsed first. */
  delete?: LifecycleAction;
  /** `Archive`: into the trash — out of every reading, nothing lost. On a record not archived. */
  archive?: LifecycleAction;
  /** `Restore`: out of the trash. On an archived record (`archived_at` set). */
  restore?: LifecycleAction;
};

/**
 * The record's own lifecycle, as actions of ONE stored record: what its entity declares of
 * sincpro_framework's `Delete` (`entity.delete`) and its trash (`entity.archive`,
 * `entity.restore`, client-framework 2.0) — `archive` on a record outside the trash, `restore` on
 * one in it (`archived_at` set).
 *
 *     const lifecycle = useRecordLifecycle(member);
 *     lifecycle.delete?.rehearse()   // «Se eliminará Ana Pérez»: nothing touched
 *     lifecycle.delete?.run()        // null: gone
 *
 * Context: an application wrote a Command and a Feature per aggregate to delete one, and a
 * confirm of its own. The backend publishes the generic `Delete` (3.37): a `DryRunnable` whose
 * dry run answers what would go, refused when the record moved past the version read
 * (`origin_version`), answering nothing. So each action sends the version this screen read and
 * a deletion rehearses with the same body: the confirmation is the server's word on THIS version.
 * Putting a record in the trash, or taking it out, can be undone: it runs on the click. A new
 * record, or one not read yet, has none. Over REST a `DELETE`'s fields travel in its query string
 * (client-framework 1.12): sent in a body, a dry run would run the real delete.
 */
export function useRecordLifecycle<T extends AnyRecord>(
  record: RecordReading<T>,
): RecordLifecycleActions {
  const { entity } = record;
  const deletion = useRouteCommand<null>(entity.delete, entity.key);
  const archival = useRouteCommand<null>(entity.archive, entity.key);
  const restoral = useRouteCommand<null>(entity.restore, entity.key);
  const stored = !record.isNew && record.status === "ready";
  if (!stored) return {};
  const held = record.record as AnyRecord;
  const version = held["version"];
  const checked: AnyRecord = typeof version === "number" ? { origin_version: version } : {};
  const archived = held["archived_at"] !== null && held["archived_at"] !== undefined;
  const action = (command: CommandState<null>, rehearsed: boolean): LifecycleAction => ({
    run: () => command.run(record.id, checked),
    ...(rehearsed ? { rehearse: () => command.rehearse(record.id, checked) } : {}),
    busy: command.busy,
    error: command.error,
    rehearsal: command.rehearsal,
    reset: command.reset,
  });
  return {
    ...(entity.delete === undefined ? {} : { delete: action(deletion, true) }),
    ...(entity.archive === undefined || archived ? {} : { archive: action(archival, false) }),
    ...(entity.restore === undefined || !archived
      ? {}
      : { restore: action(restoral, false) }),
  };
}
