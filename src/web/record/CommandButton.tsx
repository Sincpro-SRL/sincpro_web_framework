"use client";

import {
  type CommandAnswers,
  type CommandBodies,
  type Entity,
} from "@sincpro/client-framework";
import type { AnyRecord } from "@sincpro/criteria";
import { type AnswerOf, useCommand } from "@sincpro/web-framework/react/useCommand";
import { ActionButton } from "@sincpro/web-framework/web/record/ActionButton";

/**
 * An entity's Command as a button: sent as it is, over the screens' transport.
 *
 * Context: the gesture is `ActionButton`'s — run on the click, or (`destructive`) ask the
 * server's dry run first and show what it would do; a refusal where it happened. An action that is
 * one of the application's own use cases — logic of its own, composed, traced as
 * `<context>/<Service>` — is a `ServiceButton`.
 */
export function CommandButton<
  T extends AnyRecord,
  R = unknown,
  C extends CommandBodies = CommandBodies,
  N extends keyof C & string = keyof C & string,
  A extends CommandAnswers = CommandAnswers,
>({
  entity,
  command,
  id,
  body,
  label,
  destructive = false,
  role = "secondary",
  disabled = false,
  onDone,
}: {
  entity: Entity<T, C, A>;
  /** One the entity declares; a typed entity takes only its own names. */
  command: N;
  id?: string;
  /** What it is sent with — checked against a typed entity's `C[command]`. */
  body?: C[N];
  label: string;
  /** Asks the server what it would do before doing it. */
  destructive?: boolean;
  role?: "primary" | "secondary" | "ghost";
  /** Not offered right now — «Mover» with no other tenant chosen. The server still decides. */
  disabled?: boolean;
  onDone?: (answer: AnswerOf<R, A, N>) => void;
}) {
  const sending = useCommand<T, R, C, N, A>(entity, command);
  return (
    <ActionButton
      action={{
        run: () => sending.run(id, body),
        ...(destructive ? { rehearse: () => sending.rehearse(id, body) } : {}),
        busy: sending.busy,
        error: sending.error,
        rehearsal: sending.rehearsal,
        reset: sending.reset,
      }}
      label={label}
      role={role}
      disabled={disabled}
      {...(onDone === undefined ? {} : { onDone })}
    />
  );
}
