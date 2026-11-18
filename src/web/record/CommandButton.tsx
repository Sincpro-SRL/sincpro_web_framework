"use client";

import {
  type CommandAnswers,
  type CommandBodies,
  type Entity,
} from "@sincpro/client-framework";
import type { AnyRecord } from "@sincpro/criteria";
import { entityFor } from "@sincpro/web-framework/core/relation";
import { useFramework } from "@sincpro/web-framework/react/context";
import { type AnswerOf, useCommand } from "@sincpro/web-framework/react/useCommand";
import {
  ActionButton,
  type ActionDialog,
  type Asked,
} from "@sincpro/web-framework/web/record/ActionButton";
import { type AskField, askFormOf } from "@sincpro/web-framework/web/record/ask";

/**
 * An entity's Command as a button: sent as it is, over the screens' transport.
 *
 * Context: the gesture is `ActionButton`'s — run on the click, or (`destructive`) ask the
 * server's dry run first and show what it would do; a refusal where it happened. An action that is
 * one of the application's own use cases — logic of its own, composed, traced as
 * `<context>/<Service>` — is a `ServiceButton`.
 *
 * One that needs input names the fields it asks for (`ask`): a dialog draws them as the
 * record's fields of the same name, filled from `record`, and what is filled goes in the body
 * beside `body`.
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
  ask,
  record,
  dialog,
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
  /** The fields it asks for before it runs, sent in its body: `["areas"]`. */
  ask?: readonly AskField[];
  /** The record it acts on: what the asked fields start with. */
  record?: AnyRecord;
  /** What its window says — its title (the label without «…» by default), a sentence under it. */
  dialog?: ActionDialog;
  onDone?: (answer: AnswerOf<R, A, N>) => void;
}) {
  const sending = useCommand<T, R, C, N, A>(entity, command);
  const { metas, entities, locale } = useFramework();
  const form =
    ask === undefined
      ? undefined
      : askFormOf(ask, {
          meta: metas.get(entity.key),
          locale,
          record,
          entityFor: (target) => entityFor(entities, target, metas.get),
        });
  const bodyWith = (asked?: Asked) =>
    (asked === undefined ? body : { ...body, ...asked }) as C[N] | undefined;
  return (
    <ActionButton
      {...(form === undefined ? {} : { ask: form })}
      {...(dialog === undefined ? {} : { dialog })}
      action={{
        run: (asked) => sending.run(id, bodyWith(asked)),
        ...(destructive
          ? { rehearse: (asked) => sending.rehearse(id, bodyWith(asked)) }
          : {}),
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
