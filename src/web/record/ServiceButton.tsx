"use client";

import type { Rehearsal } from "@sincpro/web-framework/react/useCommand";
import { useService } from "@sincpro/web-framework/react/useService";
import { ActionButton } from "@sincpro/web-framework/web/record/ActionButton";

/** What the button runs when there is no dry run: nothing. */
const NO_REHEARSAL = async (): Promise<Rehearsal | undefined> => undefined;

/**
 * One of the application's use cases as a button — its Feature or ApplicationService, run on its
 * bounded context.
 *
 *     <ServiceButton
 *       label="Cancelar"
 *       run={() => projectBoundedContext.execute(new CommandCancelIssue(issue.id))}
 *       rehearse={() => projectBoundedContext.execute(new CommandCancelIssue(issue.id, true))}
 *     />
 *
 * Context: an action of an application is a use case — its logic, its composition, its span
 * `<context>/<Service>`, its request carrying the run's trace to the server —, never a request a
 * screen sends; what the screen adds is the state of running it (`useService`). The gesture is
 * `CommandButton`'s, drawn once by `ActionButton`: run on the click, off while it runs, a refusal
 * where it happened; and an action that destroys asks first (`rehearse`, the use case run dry)
 * and shows what it would do. What it changed, every screen hears by itself: the use case's
 * client announces its write (`processChanges`), so `onDone` is for what only this screen does
 * next — a toast, closing a window —, never to read again.
 */
export function ServiceButton<R>({
  label,
  run,
  rehearse,
  role = "secondary",
  disabled = false,
  onDone,
}: {
  label: string;
  /** The use case, executed on its bounded context. */
  run: () => Promise<R>;
  /** The same use case run dry — what it would do, nothing touched —, asked before `run`. */
  rehearse?: () => Promise<Rehearsal>;
  role?: "primary" | "secondary" | "ghost";
  /** Not offered right now. The use case still decides. */
  disabled?: boolean;
  onDone?: (answer: R) => void;
}) {
  const running = useService(run);
  const rehearsing = useService(rehearse ?? NO_REHEARSAL);
  return (
    <ActionButton
      action={{
        run: running.run,
        ...(rehearse === undefined ? {} : { rehearse: rehearsing.run }),
        busy: running.busy || rehearsing.busy,
        error: running.error ?? rehearsing.error,
        rehearsal: rehearsing.answer ?? null,
        reset: () => {
          running.reset();
          rehearsing.reset();
        },
      }}
      label={label}
      role={role}
      disabled={disabled}
      {...(onDone === undefined ? {} : { onDone })}
    />
  );
}
