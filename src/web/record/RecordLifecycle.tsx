"use client";

import type { AnyRecord } from "@sincpro/criteria";
import { frameworkCopy } from "@sincpro/web-framework/core/copy";
import type { RecordReading } from "@sincpro/web-framework/react/useRecord";
import { useRecordLifecycle } from "@sincpro/web-framework/react/useRecordLifecycle";
import {
  type ButtonAction,
  useActionGesture,
} from "@sincpro/web-framework/web/record/ActionButton";
import { dockedOf } from "@sincpro/web-framework/web/record/dock";
import { Button, type DockAction } from "@sincpro/web-ui";
import { Archive, RotateCcw, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

/** What the record's lifecycle did: after `delete` and `archive` it is out of every reading. */
export type LifecycleDone = "delete" | "archive" | "restore";

/** In place of an action the entity does not declare: never offered, never started. */
const NOT_DECLARED: ButtonAction<null> = {
  run: async () => undefined,
  busy: false,
  error: null,
  rehearsal: null,
  reset: () => {},
};

/**
 * The record's own lifecycle as buttons — «Mover a la papelera» / «Restaurar» and «Eliminar»,
 * each when its entity declares sincpro_framework's `Archive`, `Restore`, `Delete` — a deletion
 * asking the server first what it would do (its dry run) and doing it on «Hacerlo», the trash's
 * two on the click (they can be undone). Nothing when the entity declares none, or the record is
 * new.
 *
 *     <Record.Actions>
 *       <RecordLifecycle record={member} onDone={() => api.close()} />
 *     </Record.Actions>
 *
 * Context: `EntityRecord` draws it; a screen of its own draws it the same, or takes them as a
 * dock's actions (`useRecordLifecycleActions`), or drops to `useRecordLifecycle` and draws its
 * own. What happens after is the screen's (`onDone`): in a workspace the surface closes — the
 * record is gone —, and every list that showed it reads again by itself (the write is announced).
 */
export function RecordLifecycle<T extends AnyRecord>({
  record,
  onDone,
}: {
  record: RecordReading<T>;
  onDone?: (done: LifecycleDone) => void;
}) {
  const lifecycle = useRecordLifecycleActions(record, onDone);
  return (
    <>
      <LifecycleButtons actions={lifecycle.actions} />
      {lifecycle.dialog}
    </>
  );
}

/** The lifecycle's actions as the rail's buttons — beside actions a screen drew by hand. */
export function LifecycleButtons({ actions }: { actions: readonly DockAction[] }) {
  return (
    <>
      {actions.map((one) => (
        <Button
          key={one.id}
          size="sm"
          role="secondary"
          disabled={one.disabled ?? false}
          onClick={() => one.onSelect?.()}
        >
          {one.label}
        </Button>
      ))}
    </>
  );
}

/**
 * The record's own lifecycle as actions of a dock (web-ui's `Record.Dock`) — what
 * `RecordLifecycle` draws as buttons: the view style draws them (the rail's buttons, or the
 * modern style's floating pill, «Eliminar» apart and in red), and their window — what a deletion
 * would do, a refusal — is put on the screen by whoever uses them.
 *
 *     const lifecycle = useRecordLifecycleActions(member, () => api.close());
 *     <Record.Dock actions={[...own, ...lifecycle.actions]} />
 *     {lifecycle.dialog}
 */
export function useRecordLifecycleActions<T extends AnyRecord>(
  record: RecordReading<T>,
  onDone?: (done: LifecycleDone) => void,
): { actions: readonly DockAction[]; dialog: ReactNode } {
  const lifecycle = useRecordLifecycle(record);
  const copy = frameworkCopy().record;
  // Always the three, in this order: a hook is not skipped. One not declared is not offered.
  const archive = useActionGesture(lifecycle.archive ?? NOT_DECLARED, {
    label: copy.archive,
    onDone: () => onDone?.("archive"),
  });
  const restore = useActionGesture(lifecycle.restore ?? NOT_DECLARED, {
    label: copy.restore,
    onDone: () => onDone?.("restore"),
  });
  const remove = useActionGesture(lifecycle.delete ?? NOT_DECLARED, {
    label: copy.delete,
    onDone: () => onDone?.("delete"),
  });
  const offered = [
    lifecycle.archive === undefined
      ? null
      : dockedOf(archive, copy.archive, { id: "archive", icon: Archive }),
    lifecycle.restore === undefined
      ? null
      : dockedOf(restore, copy.restore, { id: "restore", icon: RotateCcw }),
    lifecycle.delete === undefined
      ? null
      : dockedOf(remove, copy.delete, { id: "delete", icon: Trash2, danger: true }),
  ].filter((one) => one !== null);
  return {
    actions: offered.map((one) => one.action),
    dialog: offered.map((one) => one.dialog),
  };
}
