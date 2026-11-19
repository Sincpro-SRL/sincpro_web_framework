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
  type ButtonAction,
  useActionGesture,
} from "@sincpro/web-framework/web/record/ActionButton";
import {
  type AskField,
  type AskForm,
  askFormOf,
} from "@sincpro/web-framework/web/record/ask";
import {
  type ActionLook,
  type DockedAction,
  dockedOf,
} from "@sincpro/web-framework/web/record/dock";

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
/** What a Command's button and dock action are given. */
export type CommandActionProps<
  T extends AnyRecord,
  R,
  C extends CommandBodies,
  N extends keyof C & string,
  A extends CommandAnswers,
> = {
  entity: Entity<T, C, A>;
  /** One the entity declares; a typed entity takes only its own names. */
  command: N;
  id?: string;
  /** What it is sent with — checked against a typed entity's `C[command]`. */
  body?: C[N];
  label: string;
  /** Asks the server what it would do before doing it. */
  destructive?: boolean;
  /** Not offered right now — «Mover» with no other tenant chosen. The server still decides. */
  disabled?: boolean;
  /** The fields it asks for before it runs, sent in its body: `["areas"]`. */
  ask?: readonly AskField[];
  /** The record it acts on: what the asked fields start with. */
  record?: AnyRecord;
  /** What its window says — its title (the label without «…» by default), a sentence under it. */
  dialog?: ActionDialog;
  onDone?: (answer: AnswerOf<R, A, N>) => void;
};

export function CommandButton<
  T extends AnyRecord,
  R = unknown,
  C extends CommandBodies = CommandBodies,
  N extends keyof C & string = keyof C & string,
  A extends CommandAnswers = CommandAnswers,
>({
  role = "secondary",
  ...props
}: CommandActionProps<T, R, C, N, A> & { role?: "primary" | "secondary" | "ghost" }) {
  const { action, form } = useCommandBehind(props);
  return (
    <ActionButton
      {...(form === undefined ? {} : { ask: form })}
      {...(props.dialog === undefined ? {} : { dialog: props.dialog })}
      action={action}
      label={props.label}
      role={role}
      disabled={props.disabled ?? false}
      {...(props.onDone === undefined ? {} : { onDone: props.onDone })}
    />
  );
}

/**
 * An entity's Command as an action of a dock — what `CommandButton` is as a button, for web-ui's
 * `Record.Dock`: the view style draws it, and its window is put on the screen by whoever uses
 * it. One that destroys (`destructive`: asked first what it would do) is drawn as such — apart,
 * in red — unless `danger` says otherwise.
 *
 *     const anular = useCommandAction({
 *       entity: invoices, command: "cancel", id: invoice.id, label: "Anular", destructive: true,
 *     });
 *     <Record.Dock actions={[confirmar.action, anular.action]} />
 *     {anular.dialog}
 */
export function useCommandAction<
  T extends AnyRecord,
  R = unknown,
  C extends CommandBodies = CommandBodies,
  N extends keyof C & string = keyof C & string,
  A extends CommandAnswers = CommandAnswers,
>({
  icon,
  primary,
  danger,
  tucked,
  shortcut,
  hint,
  actionId,
  ...props
}: CommandActionProps<T, R, C, N, A> &
  Omit<ActionLook, "id"> & {
    /** The dock's id for it — the record's is `id`. Defaults to the label. */
    actionId?: string;
  }): DockedAction {
  const { action, form } = useCommandBehind(props);
  const gesture = useActionGesture(action, {
    label: props.label,
    ...(form === undefined ? {} : { ask: form }),
    ...(props.dialog === undefined ? {} : { dialog: props.dialog }),
    ...(props.onDone === undefined ? {} : { onDone: props.onDone }),
  });
  const look = {
    icon,
    primary,
    danger: danger ?? props.destructive,
    tucked,
    shortcut,
    hint,
    id: actionId,
  };
  return dockedOf(gesture, props.label, look, props.disabled);
}

/** What runs behind a Command's button or dock action: sending it, its dry run, what it asks. */
function useCommandBehind<
  T extends AnyRecord,
  R,
  C extends CommandBodies,
  N extends keyof C & string,
  A extends CommandAnswers,
>({
  entity,
  command,
  id,
  body,
  destructive = false,
  ask,
  record,
}: CommandActionProps<T, R, C, N, A>): {
  action: ButtonAction<AnswerOf<R, A, N>>;
  form: AskForm | undefined;
} {
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
  return {
    action: {
      run: (asked) => sending.run(id, bodyWith(asked)),
      ...(destructive ? { rehearse: (asked) => sending.rehearse(id, bodyWith(asked)) } : {}),
      busy: sending.busy,
      error: sending.error,
      rehearsal: sending.rehearsal,
      reset: sending.reset,
    },
    form,
  };
}
