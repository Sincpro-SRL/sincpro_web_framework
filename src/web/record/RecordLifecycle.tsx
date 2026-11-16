"use client";

import type { AnyRecord } from "@sincpro/criteria";
import { frameworkCopy } from "@sincpro/web-framework/core/copy";
import type { RecordReading } from "@sincpro/web-framework/react/useRecord";
import { useRecordLifecycle } from "@sincpro/web-framework/react/useRecordLifecycle";
import { ActionButton } from "@sincpro/web-framework/web/record/ActionButton";

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
 * Context: `EntityRecord` draws it; a screen of its own draws it the same, or drops to
 * `useRecordLifecycle` and draws its own. What happens after is the screen's (`onDone`): in a
 * workspace the surface closes — the record is gone —, and every list that showed it reads
 * again by itself (the write is announced).
 */
export function RecordLifecycle<T extends AnyRecord>({
  record,
  onDone,
}: {
  record: RecordReading<T>;
  /** Done: which action — after `delete` and `archive` the record is out of every reading. */
  onDone?: (action: "delete" | "archive" | "restore") => void;
}) {
  const lifecycle = useRecordLifecycle(record);
  const copy = frameworkCopy().record;
  const shown = (["archive", "restore", "delete"] as const).filter(
    (one) => lifecycle[one] !== undefined,
  );
  if (shown.length === 0) return null;
  return (
    <>
      {shown.map((one) => (
        <ActionButton
          key={one}
          action={lifecycle[one]!}
          label={copy[one]}
          onDone={() => onDone?.(one)}
        />
      ))}
    </>
  );
}
