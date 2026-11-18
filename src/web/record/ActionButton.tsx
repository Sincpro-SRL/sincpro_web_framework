"use client";
import { frameworkCopy } from "@sincpro/web-framework/core/copy";
import type { Rehearsal } from "@sincpro/web-framework/react/useCommand";
import type { AskForm } from "@sincpro/web-framework/web/record/ask";
import { Refused } from "@sincpro/web-framework/web/Refused";
import { Button, Dialog, Field, FormSection } from "@sincpro/web-ui";
import { useState } from "react";

/** What a person filled in before the action runs, by field name. */
export type Asked = Readonly<Record<string, unknown>>;

/** What an action's window says, when the screen says it its way. */
export type ActionDialog = {
  /** Its title — the button's label without the «…» that said a window would open. */
  title?: string;
  /** One sentence under the title: what the action does, or what it takes. */
  subtitle?: string;
};

/**
 * The words of an action's window. A button that opens one says so with «…» — «Agregar a un
 * tenant…» —; the window is already open, so its title says it once, without them.
 */
function wordsOf(
  label: string,
  dialog: ActionDialog | undefined,
): { title: string; subtitle?: string } {
  return {
    title: dialog?.title ?? label.replace(/\s*(?:…|\.\.\.)$/u, ""),
    ...(dialog?.subtitle === undefined ? {} : { subtitle: dialog.subtitle }),
  };
}

/**
 * What a button needs of an action to draw it — whatever runs behind: an entity's Command
 * (`useCommand`) or one of the application's use cases (`useService`).
 */
export type ButtonAction<R> = {
  /** Does it — with what was asked, when it asks —; `undefined` when it failed: the failure is
   *  in `error`. */
  run: (asked?: Asked) => Promise<R | undefined>;
  /** Asks first what it would do — a dry run: the action destroys something. */
  rehearse?: (asked?: Asked) => Promise<Rehearsal | undefined>;
  busy: boolean;
  error: unknown;
  /** What the last dry run said it would do. */
  rehearsal: Rehearsal | null;
  reset: () => void;
};

/** The fields of an action that asks, its refusal over them and what its dry run said. */
function AskDialog<R>({
  action,
  form,
  words,
  onClose,
  onDone,
}: {
  action: ButtonAction<R>;
  form: AskForm;
  words: { title: string; subtitle?: string };
  onClose: () => void;
  onDone: (answer: R) => void;
}) {
  const copy = frameworkCopy().command;
  const [values, setValues] = useState<Record<string, unknown>>(() => ({ ...form.initial }));
  const rehearsing = action.rehearse !== undefined;
  const confirm = async () => {
    if (rehearsing && action.rehearsal === null) {
      await action.rehearse?.(values);
      return;
    }
    const answer = await action.run(values);
    if (answer !== undefined) onDone(answer);
  };
  return (
    <Dialog
      open
      {...words}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button size="sm" role="secondary" onClick={onClose}>
            {copy.cancel}
          </Button>
          <Button
            size="sm"
            role="primary"
            disabled={action.busy}
            onClick={() => void confirm()}
          >
            {rehearsing && action.rehearsal !== null ? copy.confirm : copy.send}
          </Button>
        </div>
      }
    >
      {action.error === null ? null : <Refused error={action.error} />}
      <FormSection>
        {form.fields.map((field) => {
          const control = {
            value: values[field.name],
            set: (next: unknown) => {
              setValues((now) => ({ ...now, [field.name]: next }));
              // What the dry run said was about the values before this one.
              if (action.rehearsal !== null || action.error !== null) action.reset();
            },
            readonly: false,
            invalid: false,
            label: field.label,
          };
          // A control that names itself is not wrapped in a `Field` (its name would double):
          // what is expected goes under it.
          return field.labelled ? (
            <div key={field.name} className="flex flex-col gap-1">
              {field.draw(control)}
              {field.hint === undefined ? null : (
                <p className="text-meta text-muted">{field.hint}</p>
              )}
            </div>
          ) : (
            <Field
              key={field.name}
              label={field.label}
              {...(field.hint === undefined ? {} : { hint: field.hint })}
            >
              {field.draw(control)}
            </Field>
          );
        })}
      </FormSection>
      {action.rehearsal === null ? null : <p className="text-ink">{action.rehearsal.text}</p>}
    </Dialog>
  );
}

/**
 * An action as a button — the gesture `CommandButton` and `ServiceButton` share.
 *
 * Context: two kinds of action, two gestures. One that can be undone runs on the click — asking
 * «are you sure?» before every confirm teaches people to click «yes» without reading. One that
 * destroys (it can `rehearse`) asks FIRST what it would do and shows THAT in the window: the
 * confirmation is the consequence, in the server's words, not a question. A refusal is shown
 * where it happened, with what to do. Off while it runs: a click twice is one action.
 *
 * One that needs input (`ask`) opens its fields first, filled from the record, and sends them on
 * «Confirmar»; when it can rehearse, the first «Confirmar» asks what it would do with them and
 * the second does it. A refusal stays in the dialog over the fields, so they can be put right.
 *
 * Its window is titled by the label without its «…», and says more only when the screen does
 * (`dialog`: its own title, a sentence under it).
 *
 * Internal: the gesture is drawn here once; what runs behind is each button's own.
 */
export function ActionButton<R>({
  action,
  label,
  role = "secondary",
  disabled = false,
  ask: form,
  dialog,
  onDone,
}: {
  action: ButtonAction<R>;
  label: string;
  role?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  /** What it asks for before it runs — `askFormOf`. */
  ask?: AskForm;
  /** What its window says, over the default. */
  dialog?: ActionDialog;
  onDone?: (answer: R) => void;
}) {
  const copy = frameworkCopy().command;
  const [open, setOpen] = useState(false);
  const words = wordsOf(label, dialog);
  if (form !== undefined)
    return (
      <>
        <Button
          size="sm"
          role={role}
          disabled={disabled || action.busy}
          onClick={() => setOpen(true)}
        >
          {label}
        </Button>
        {open ? (
          <AskDialog
            action={action}
            form={form}
            words={words}
            onClose={() => {
              setOpen(false);
              action.reset();
            }}
            onDone={(answer) => {
              setOpen(false);
              action.reset();
              onDone?.(answer);
            }}
          />
        ) : null}
      </>
    );
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
          {...words}
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
