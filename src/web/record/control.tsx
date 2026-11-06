"use client";

import { type Entity } from "@sincpro/client-framework";
import type { AnyRecord } from "@sincpro/criteria";
import { instantOf, timeZoneNow, wallTimeOf } from "@sincpro/web-framework/core/zone";
import { EntityPicker } from "@sincpro/web-framework/web/record/EntityPicker";
import {
  Checkbox,
  DatePicker,
  DateTimePicker,
  NumberInput,
  Select,
  TagsField,
  TextInput,
} from "@sincpro/web-ui";
import type { ReactNode } from "react";

/** What a control of a field receives: its value, how to change it, and its state now. */
export type FieldControl = {
  value: unknown;
  set: (value: unknown) => void;
  readonly: boolean;
  invalid: boolean;
  label: string;
  /** No `Field` names it — a cell of a table: the control carries its label itself. Inside a
   *  `Field` it must not, or React Aria reads both and names it «Precio Precio». */
  standalone?: boolean;
};

/**
 * The control a field's TYPE asks for — a choice, a number, a date, a date and time, a yes/no, a
 * list of words,
 * a text.
 * Shared by a record's field (`RecordField`) and a line's cell and dialog (`RecordLinesEditor`):
 * one rule for what a value is edited with.
 */
export function controlFor(
  control: FieldControl,
  type: string,
  exact: boolean,
  choices: { value: unknown; label: string }[],
): ReactNode {
  const { value, set } = control;
  const named = control.standalone === true ? { "aria-label": control.label } : {};
  if (choices.length > 0)
    return (
      <Select
        value={value === null || value === undefined ? "" : String(value)}
        options={choices.map((one) => ({ value: String(one.value), label: one.label }))}
        onChange={set}
        {...named}
      />
    );
  switch (type) {
    case "boolean":
      return <Checkbox checked={value === true} onChange={set} label={control.label} />;
    case "integer":
    case "number":
      return (
        <NumberInput
          value={value === null || value === undefined || value === "" ? "" : Number(value)}
          // A decimal travels as text so no digit is lost; the server reads it that way back.
          onChange={(next) => set(next === "" ? null : exact ? String(next) : next)}
          {...named}
        />
      );
    case "datetime": {
      // An instant from the server, typed on the wall clock of the installed zone.
      const zone = timeZoneNow();
      return (
        <DateTimePicker
          value={typeof value === "string" && value !== "" ? wallTimeOf(value, zone) : null}
          onChange={(wall) => set(wall === null ? null : instantOf(wall, zone))}
          {...named}
        />
      );
    }
    case "date":
      return (
        <DatePicker
          value={typeof value === "string" && value !== "" ? value : null}
          onChange={set}
          {...named}
        />
      );
    case "text[]": {
      // A list of words is chips: each word is its own key, and typing a new one adds it.
      const words = Array.isArray(value) ? value.map(String) : [];
      return (
        <TagsField
          value={words}
          options={words.map((word) => ({ value: word, label: word }))}
          onChange={set}
          onCreate={(word) => word}
          {...named}
        />
      );
    }
    default:
      return (
        <TextInput
          value={value === null || value === undefined ? "" : String(value)}
          onChange={set}
          {...named}
        />
      );
  }
}

/**
 * A many2one's control: the picker of the entity it points at — the server's literal search,
 * the first ten, «Buscar más…» — opening the chosen one where the view says.
 *
 * Context: shared by a record's field and a line. Where it opens is `EntityPicker`'s — the
 * workspace's when there is one. Inside a line the lines editor gives an opening without the
 * workspace's chooser (`RecordLinesEditor`), so «Buscar más…» is the picker's own there;
 * `ownChooser` asks for it anywhere else.
 */
export function RelationPicker({
  target,
  value,
  onChange,
  label,
  ownChooser = false,
  standalone = false,
}: {
  target: Entity;
  value: string;
  onChange: (id: string, chosen?: AnyRecord) => void;
  label: string;
  ownChooser?: boolean;
  /** No `Field` names it (a cell): it carries `label` itself — as `FieldControl.standalone`. */
  standalone?: boolean;
}) {
  // Opening the chosen record and «Buscar más…» are the workspace's when there is one: the
  // picker reads it (`RecordOpening`); a line keeps its own chooser.
  return (
    <EntityPicker
      entity={target}
      value={value}
      onChange={onChange}
      // «Buscar más…» is an option of the picker already: no second button beside it.
      browse={false}
      ownChooser={ownChooser}
      {...(standalone ? { "aria-label": label } : {})}
    />
  );
}
