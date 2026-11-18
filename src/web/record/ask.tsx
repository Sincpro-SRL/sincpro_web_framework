"use client";

import type { Entity } from "@sincpro/client-framework";
import { type AnyRecord, choicesOf, type Meta } from "@sincpro/criteria";
import { fieldMetaOf, viewOf } from "@sincpro/web-framework/core/present";
import { relationFieldOf } from "@sincpro/web-framework/core/relation";
import {
  controlFor,
  type FieldControl,
  RelationPicker,
} from "@sincpro/web-framework/web/record/control";
import type { ReactNode } from "react";

/**
 * A field an action asks for before it runs: a field of the entity by its name — `"areas"` —,
 * or an object that says more about it — its starting value, a hint, its own control —, or
 * describes one the entity does not have.
 *
 *     <CommandButton entity={cuentas} command="delegar_areas" id={cuenta.id} record={cuenta}
 *       label="Delegar áreas…" ask={["areas"]} />
 *     ask={[{ name: "motivo", label: "Motivo", widget: "textarea" }]}
 *     ask={[{ name: "role", label: "Rol", choices: ROLES, initial: "member", hint: "Lo que podrá hacer" }]}
 *
 * Context: a Command that needs input could not live among a record's actions, so a screen drew
 * its fields in the record's body with a button of their own. What the dialog shows is the
 * screen's: the backend adds nothing for it. A field is read as the entity's field of that name
 * when it has one — its label, its choices in their words, its control, its help — and what the
 * object says goes OVER that, key by key: `{ name: "areas", hint }` is the entity's field with a
 * hint, `{ name: "motivo", label, widget }` a field the entity lacks. A control of the
 * application's goes in with `as`, never a widget named in a string (`widget` takes only the
 * framework's own).
 */
export type AskField =
  | string
  | {
      name: string;
      /** Its word on screen — the entity's label for a field of that name when not given. */
      label?: string;
      /** The type of its value as the model writes it — `text` (the default), `number`, `date`,
       *  `boolean`, `text[]`. */
      type?: string;
      /** The values it takes, each with its word: a select, or checks for a `text[]`. */
      choices?: readonly { value: unknown; label: string }[];
      /** One of the framework's own widgets: `textarea`, several lines of prose. */
      widget?: "textarea";
      /** The application's own control. */
      as?: (control: FieldControl) => ReactNode;
      /** What it starts with when the record holds nothing under its name: a role that starts at
       *  «Miembro». What the record holds still wins — the action starts from the record. */
      initial?: unknown;
      /** What is expected, said by the field — over the backend's own help for it. */
      hint?: string;
    };

/** A field ready to draw: its name, its label, its control. */
export type AskedField = {
  name: string;
  label: string;
  /** What is expected — the action's hint, or the model's help for the field. */
  hint?: string | undefined;
  /** It draws its own label — a yes/no, a list of checks —: not wrapped in a `Field`. */
  labelled: boolean;
  draw: (control: FieldControl) => ReactNode;
};

/** What a form of asked fields needs to be drawn and filled. */
export type AskForm = {
  fields: readonly AskedField[];
  initial: Readonly<Record<string, unknown>>;
};

/** Whether a field's control names itself: a checkbox and a list of checks carry their label. */
function labels(type: string, choices: readonly unknown[]): boolean {
  return type === "boolean" || (type.endsWith("[]") && choices.length > 0);
}

/**
 * The asked fields, drawn from the entity's model with what each says over it, and what they
 * start with: the record's own values, else the field's `initial`. Its key is never asked by
 * name — the action already knows whose record it is.
 */
export function askFormOf(
  fields: readonly AskField[],
  options: {
    meta: Meta | null | undefined;
    locale?: string | undefined;
    record?: AnyRecord | undefined;
    /** The declared entity a relation points at, to choose it with its picker. */
    entityFor?: (target: string) => Entity | undefined;
  },
): AskForm {
  const { meta, locale, record } = options;
  const key = meta?.get_id || meta?.identity || "id";
  const asked: AskedField[] = [];
  const initial: Record<string, unknown> = {};
  for (const one of fields) {
    if (typeof one === "string" && (one === key || one === "id")) continue;
    const said = typeof one === "string" ? { name: one } : one;
    const field = fieldMetaOf(meta, said.name);
    // A field of the entity is read from the model; one it lacks only as the action says.
    const view = field === undefined ? undefined : viewOf(meta, said.name, locale);
    const relation = field === undefined ? undefined : relationFieldOf(meta, said.name);
    // A many2one is chosen by its key, with the picker of the entity it points at — unless the
    // action says how it is written: then it writes the name it gave.
    const target =
      relation === undefined ||
      relation.many ||
      said.as !== undefined ||
      said.type !== undefined ||
      said.choices !== undefined
        ? undefined
        : options.entityFor?.(relation.target);
    const name = target === undefined || relation === undefined ? said.name : relation.key;
    const type = said.type ?? view?.type ?? "text";
    const choices =
      said.choices ?? (field === undefined ? [] : choicesOf(meta, said.name, locale));
    const widget = said.widget ?? field?.widget;
    const label = said.label ?? view?.label ?? said.name;
    const hint = said.hint ?? view?.help;
    asked.push({
      name,
      label,
      hint,
      labelled: said.as === undefined && target === undefined && labels(type, [...choices]),
      draw:
        said.as ??
        (target === undefined
          ? (control) =>
              controlFor(control, type, field?.exact === true, [...choices], widget)
          : (control) => (
              <RelationPicker
                target={target}
                value={
                  control.value === null || control.value === undefined
                    ? ""
                    : String(control.value)
                }
                onChange={(id) => control.set(id)}
                label={control.label}
                onClear={() => control.set(null)}
              />
            )),
    });
    // What the record holds wins; a field it leaves empty starts at what the action says.
    const held = record?.[name];
    const start = held === undefined || held === null ? (said.initial ?? held) : held;
    if (start !== undefined) initial[name] = start;
  }
  return { fields: asked, initial };
}
