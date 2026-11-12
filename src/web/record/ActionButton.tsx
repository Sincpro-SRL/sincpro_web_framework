"use client";
import { frameworkCopy } from "@sincpro/web-framework/core/copy";
import type { Rehearsal } from "@sincpro/web-framework/react/useCommand";
import { Refused } from "@sincpro/web-framework/web/Refused";
import { Button, Dialog } from "@sincpro/web-ui";
import { useState } from "react";

/**
 * What a button needs of an action to draw it — whatever runs behind: an entity's Command
 * (`useCommand`) or one of the application's use cases (`useService`).
 */
export type ButtonAction<R> = {
  /** Does it; `undefined` when it failed — the failure is in `error`. */
  run: () => Promise<R | undefined>;
  /** Asks first what it would do — a dry run: the action destroys something. */
  rehearse?: () => Promise<Rehearsal | undefined>;
  busy: boolean;
  error: unknown;
  /** What the last dry run said it would do. */
  rehearsal: Rehearsal | null;
  reset: () => void;
};

/**
 * An action as a button — the gesture `CommandButton` and `ServiceButton` share.
 *
 * Context: two kinds of action, two gestures. One that can be undone runs on the click — asking
 * «are you sure?» before every confirm teaches people to click «yes» without reading. One that
 * destroys (it can `rehearse`) asks FIRST what it would do and shows THAT in the window: the
 * confirmation is the consequence, in the server's words, not a question. A refusal is shown
 * where it happened, with what to do. Off while it runs: a click twice is one action.
 *
 * Internal: the gesture is drawn here once; what runs behind is each button's own.
 */
export function ActionButton<R>({
  action,
  label,
  role = "secondary",
  disabled = false,
  onDone,
}: {
  action: ButtonAction<R>;
  label: string;
  role?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  onDone?: (answer: R) => void;
}) {
  const copy = frameworkCopy().command;
  const [open, setOpen] = useState(false);
  const destructive = action.rehearse !== undefined;
  const run = async () => {
    const answer = await action.run();
    if (answer !== undefined) {
      setOpen(false);
      action.reset();
      onDone?.(answer);
    } else setOpen(true);
  };
  const ask = async () => {
    setOpen(true);
    await action.rehearse?.();
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
        disabled={disabled || action.busy}
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
