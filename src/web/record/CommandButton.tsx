"use client";

import type { AnyRecord } from "@sincpro/criteria";
import { frameworkCopy } from "@sincpro/web-framework/core/copy";
import type { Entity } from "@sincpro/web-framework/core/entity";
import { useCommand } from "@sincpro/web-framework/react/useCommand";
import { Refused } from "@sincpro/web-framework/web/Refused";
import { Button, Dialog } from "@sincpro/web-ui";
import { useState } from "react";

/**
 * An entity's Command as a button.
 *
 * Context: two kinds of action, two gestures. One that can be undone runs on the click — asking
 * «are you sure?» before every confirm teaches people to click «yes» without reading. One that
 * destroys (`destructive`) asks the server FIRST what it would do — the Command's dry run — and
 * shows THAT in the window: the confirmation is the consequence, in the server's words, not a
 * question. A refusal is shown where it happened, with what to do.
 */
export function CommandButton<T extends AnyRecord, R = unknown>({
  entity,
  command,
  id,
  body,
  label,
  destructive = false,
  role = "secondary",
  onDone,
}: {
  entity: Entity<T>;
  command: string;
  id?: string;
  body?: AnyRecord;
  label: string;
  /** Asks the server what it would do before doing it. */
  destructive?: boolean;
  role?: "primary" | "secondary" | "ghost";
  onDone?: (answer: R) => void;
}) {
  const copy = frameworkCopy().command;
  const action = useCommand<T, R>(entity, command);
  const [open, setOpen] = useState(false);

  const run = async () => {
    const answer = await action.run(id, body);
    if (answer !== undefined) {
      setOpen(false);
      action.reset();
      onDone?.(answer);
    } else setOpen(true);
  };

  const ask = async () => {
    setOpen(true);
    await action.rehearse(id, body);
  };

  const close = () => {
    setOpen(false);
    action.reset();
  };

  return (
    <>
      <Button
        size="sm"
        role={destructive ? "secondary" : role}
        disabled={action.busy}
        onClick={() => void (destructive ? ask() : run())}
      >
        {label}
      </Button>
      {open ? (
        <Dialog
          open
          title={label}
          onClose={close}
          footer={
            destructive && action.error === null ? (
              <div className="flex justify-end gap-2">
                <Button size="sm" role="secondary" onClick={close}>
                  {copy.cancel}
                </Button>
                <Button
                  size="sm"
                  role="primary"
                  disabled={action.busy || action.rehearsal === null}
                  onClick={() => void run()}
                >
                  {copy.confirm}
                </Button>
              </div>
            ) : undefined
          }
        >
          {action.error !== null ? (
            <Refused error={action.error} />
          ) : action.rehearsal === null ? (
            <p className="text-meta text-muted">{copy.rehearsing}</p>
          ) : (
            <p className="text-ink">{action.rehearsal.text}</p>
          )}
        </Dialog>
      ) : null}
    </>
  );
}
