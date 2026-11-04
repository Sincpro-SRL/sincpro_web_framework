"use client";

import { DatePicker, NumberInput, Select, TagsField, TextInput } from "@sincpro/web-ui";
import type { ReactNode } from "react";

/** What a control of a field receives: its value, how to change it, and its state now. */
export type FieldControl = {
  value: unknown;
  set: (value: unknown) => void;
  readonly: boolean;
  invalid: boolean;
  label: string;
};

/**
 * The control a field's TYPE asks for — a choice, a number, a date, a list of words, a text.
 * Shared by a record's field (`RecordField`) and a line's cell (`RecordLinesEditor`): one rule
 * for what a value is edited with.
 */
export function controlFor(
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
    case "text[]": {
      // A list of words is chips: each word is its own key, and typing a new one adds it.
      const words = Array.isArray(value) ? value.map(String) : [];
      return (
        <TagsField
          value={words}
          options={words.map((word) => ({ value: word, label: word }))}
          onChange={set}
          onCreate={(word) => word}
        />
      );
    }
    default:
      return (
        <TextInput
          value={value === null || value === undefined ? "" : String(value)}
          onChange={set}
        />
      );
  }
}
