"use client";

import type { Entity } from "@sincpro/client-framework";
import type { AnyRecord } from "@sincpro/criteria";
import { entityFor } from "@sincpro/web-framework/core/relation";
import { useFrameworkIfAny } from "@sincpro/web-framework/react/context";
import type { Rehearsal } from "@sincpro/web-framework/react/useCommand";
import { useService } from "@sincpro/web-framework/react/useService";
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

/** What the button runs when there is no dry run: nothing. */
const NO_REHEARSAL = async (_asked: Asked): Promise<Rehearsal | undefined> => undefined;

/** What a use case that asks nothing receives. */
const NOTHING_ASKED: Asked = {};

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
 *
 * A use case that needs input names the fields it asks for (`ask`), read as `entity`'s fields of
 * the same name and filled from `record`; `run` and `rehearse` receive what was filled.
 *
 *     <ServiceButton label="Delegar áreas" entity={cuentas} record={cuenta} ask={["areas"]}
 *       run={(asked) => cuentaBoundedContext.execute(new CommandDelegarAreas(cuenta.id, asked.areas))} />
 */
/** What a use case's button and dock action are given. */
export type ServiceActionProps<R> = {
  label: string;
  /** The use case, executed on its bounded context — with what was asked, when it asks. */
  run: (asked: Asked) => Promise<R>;
  /** The same use case run dry — what it would do, nothing touched —, asked before `run`. */
  rehearse?: (asked: Asked) => Promise<Rehearsal>;
  /** Not offered right now. The use case still decides. */
  disabled?: boolean;
  /** The fields it asks for before it runs: `["areas"]`. */
  ask?: readonly AskField[];
  /** Whose fields `ask` names: their labels, choices and controls. */
  entity?: Entity;
  /** The record it acts on: what the asked fields start with. */
  record?: AnyRecord;
  /** What its window says — its title (the label without «…» by default), a sentence under it. */
  dialog?: ActionDialog;
  onDone?: (answer: R) => void;
};

export function ServiceButton<R>({
  role = "secondary",
  ...props
}: ServiceActionProps<R> & { role?: "primary" | "secondary" | "ghost" }) {
  const { action, form } = useServiceBehind(props);
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
 * One of the application's use cases as an action of a dock — what `ServiceButton` is as a
 * button, for web-ui's `Record.Dock`: the view style draws it (a rail's button, or the modern
 * style's floating pill), and its window — what it asks, what it would do, a refusal — is put
 * on the screen by whoever uses it.
 *
 *     const aprobar = useServiceAction({
 *       label: "Aprobar", icon: Check, primary: true,
 *       run: () => pagosBoundedContext.execute(new CommandAprobarPago(pago.id)),
 *     });
 *     <Record.Dock actions={[aprobar.action]} />
 *     {aprobar.dialog}
 */
export function useServiceAction<R>({
  icon,
  primary,
  danger,
  tucked,
  shortcut,
  hint,
  id,
  ...props
}: ServiceActionProps<R> & ActionLook): DockedAction {
  const { action, form } = useServiceBehind(props);
  const gesture = useActionGesture(action, {
    label: props.label,
    ...(form === undefined ? {} : { ask: form }),
    ...(props.dialog === undefined ? {} : { dialog: props.dialog }),
    ...(props.onDone === undefined ? {} : { onDone: props.onDone }),
  });
  const look = { icon, primary, danger, tucked, shortcut, hint, id };
  return dockedOf(gesture, props.label, look, props.disabled);
}

/** What runs behind a use case's button or dock action: the run, its dry run, what it asks. */
function useServiceBehind<R>({ run, rehearse, ask, entity, record }: ServiceActionProps<R>): {
  action: ButtonAction<R>;
  form: AskForm | undefined;
} {
  const running = useService((asked?: Asked) => run(asked ?? NOTHING_ASKED));
  const rehearsing = useService((asked?: Asked) =>
    (rehearse ?? NO_REHEARSAL)(asked ?? NOTHING_ASKED),
  );
  // Outside a provider it still runs: the asked fields are then drawn by what `ask` says.
  const framework = useFrameworkIfAny();
  const form =
    ask === undefined
      ? undefined
      : askFormOf(ask, {
          meta: entity === undefined ? undefined : framework?.metas.get(entity.key),
          locale: framework?.locale,
          record,
          ...(framework === null
            ? {}
            : {
                entityFor: (target: string) =>
                  entityFor(framework.entities, target, framework.metas.get),
              }),
        });
  return {
    action: {
      run: running.run,
      ...(rehearse === undefined ? {} : { rehearse: rehearsing.run }),
      busy: running.busy || rehearsing.busy,
      error: running.error ?? rehearsing.error,
      rehearsal: rehearsing.answer ?? null,
      reset: () => {
        running.reset();
        rehearsing.reset();
      },
    },
    form,
  };
}
