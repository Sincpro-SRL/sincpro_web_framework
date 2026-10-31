"use client";

import { choicesOf } from "@sincpro/criteria";
import { frameworkCopy } from "@sincpro/web-framework/core/copy";
import { textOf, viewOf } from "@sincpro/web-framework/core/present";
import type { RecordReading } from "@sincpro/web-framework/react/useRecord";
import {
  Checkbox,
  DatePicker,
  type DirtyState,
  Field,
  NumberInput,
  ReadValue,
  Select,
  TextArea,
  TextInput,
} from "@sincpro/web-ui";
import type { ReactNode } from "react";

/**
 * One field of a record being edited, from the model: its word, whether it is required or
 * read-only now (the hints, evaluated over what is on screen), the server's error for it, and a
 * control chosen by its type.
 *
 * Context: forge's forms wrote `<Field label="Nombre" required><TextInput … /></Field>` once per
 * field, with the label, the «required» and the value plumbing by hand, while the server already
 * said all three. Here a field is a NAME. The control by type is a default, never the only way:
 * `as` draws any control — a many2one with `EntityPicker`, a rich text, a domain widget — and
 * still receives the value, the setter and the state.
 *
 *     <RecordField record={invoice} name="due_date" />
 *     <RecordField record={invoice} name="customer_id"
 *       as={({ value, set }) => <EntityPicker entity={customers} value={String(value)} onChange={set} />} />
 */
export type FieldControl = {
  value: unknown;
  set: (value: unknown) => void;
  readonly: boolean;
  invalid: boolean;
  label: string;
};

export function RecordField<T extends Record<string, unknown>>({
  record,
  name,
  as,
}: {
  record: RecordReading<T>;
  name: string;
  as?: (control: FieldControl) => ReactNode;
}) {
  const { meta, locale, edit } = record;
  const view = viewOf(meta, name, locale);
  const state = edit.state(name);
  if (!state.visible) return null;
  const value = edit.values[name];
  const error = edit.errors[name];
  const control: FieldControl = {
    value,
    set: (next) => edit.set(name, next),
    readonly: state.readonly,
    invalid: error !== undefined,
    label: view.label,
  };
  const field = meta?.fields[name];

  if (view.type === "boolean" && as === undefined)
    return (
      <Checkbox
        checked={value === true}
        onChange={control.set}
        label={view.label}
        disabled={state.readonly}
      />
    );

  return (
    <Field
      label={view.label}
      required={state.required && !state.readonly}
      {...(view.help === undefined ? {} : { hint: view.help })}
      {...(error === undefined ? {} : { error })}
    >
      {as !== undefined ? (
        as(control)
      ) : state.readonly ? (
        <ReadValue value={textOf(meta, name, value, locale) ?? "—"} />
      ) : (
        controlFor(control, view.type, field?.exact === true, choicesOf(meta, name, locale))
      )}
    </Field>
  );
}

function controlFor(
  control: FieldControl,
  type: string,
  exact: boolean,
  choices: { value: unknown; label: string }[],
): ReactNode {
  const { value, set } = control;
  if (choices.length > 0)
    return (
      <Select
        value={value === null || value === undefined ? "" : String(value)}
        options={choices.map((one) => ({ value: String(one.value), label: one.label }))}
        onChange={set}
      />
    );
  switch (type) {
    case "integer":
    case "number":
      return (
        <NumberInput
          value={value === null || value === undefined || value === "" ? "" : Number(value)}
          // A decimal travels as text so no digit is lost; the server reads it that way back.
          onChange={(next) => set(next === "" ? null : exact ? String(next) : next)}
        />
      );
    case "date":
      return (
        <DatePicker
          value={typeof value === "string" && value !== "" ? value : null}
          onChange={set}
        />
      );
    case "text[]":
      return (
        <TextArea
          value={Array.isArray(value) ? value.join("\n") : ""}
          onChange={(next) =>
            set(
              next
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean),
            )
          }
        />
      );
    default:
      return (
        <TextInput
          value={value === null || value === undefined ? "" : String(value)}
          onChange={set}
        />
      );
  }
}

/**
 * The record's «save / discard», for `<Record dirty={…}>`: present only while something changed,
 * off while saving, and off with the reason while a required field is empty.
 */
export function dirtyOf<T extends Record<string, unknown>>(
  record: RecordReading<T>,
): DirtyState | undefined {
  const { edit, meta, locale } = record;
  if (!edit.dirty) return undefined;
  const missing = edit.missing.map((name) => viewOf(meta, name, locale).label);
  return {
    onSave: () => void edit.save(),
    onDiscard: edit.discard,
    saving: edit.saving,
    ...(missing.length === 0 ? {} : { blocked: frameworkCopy().record.missing(missing) }),
  };
}
