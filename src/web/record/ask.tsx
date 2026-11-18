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
 * A field an action asks for before it runs: a field of the entity by its name — `"areas"` —, or
 * one the entity does not have, described by the action.
 *
 *     <CommandButton entity={cuentas} command="delegar_areas" id={cuenta.id} record={cuenta}
 *       label="Delegar áreas" ask={["areas"]} />
 *     ask={[{ name: "motivo", label: "Motivo", widget: "textarea" }]}
 *
 * Context: a Command that needs input could not live among a record's actions, so a screen drew
 * its fields in the record's body with a button of their own. What the dialog shows is the
 * screen's: the backend adds nothing for it. A field named by the entity reads as the record's
 * field of that name — its label, its choices in their words, its control —; a control of the
 * application's goes in with `as`, never a widget named in a string (`widget` takes only the
 * framework's own).
 */
export type AskField =
  | string
  | {
      name: string;
      label: string;
      /** The type of its value as the model writes it — `text` (the default), `number`, `date`,
       *  `boolean`, `text[]`. */
      type?: string;
      /** The values it takes, each with its word: a select, or checks for a `text[]`. */
      choices?: readonly { value: unknown; label: string }[];
      /** One of the framework's own widgets: `textarea`, several lines of prose. */
      widget?: "textarea";
      /** The application's own control. */
      as?: (control: FieldControl) => ReactNode;
    };

/** A field ready to draw: its name, its label, its control. */
export type AskedField = {
  name: string;
  label: string;
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
 * The asked fields, drawn from the entity's model, and what they start with: the record's own
 * values. Its key is never asked — the action already knows whose record it is.
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
    if (typeof one !== "string") {
      const choices = [...(one.choices ?? [])];
      const type = one.type ?? "text";
      asked.push({
        name: one.name,
        label: one.label,
        labelled: one.as === undefined && labels(type, choices),
        draw: (control) =>
          one.as?.(control) ?? controlFor(control, type, false, choices, one.widget),
      });
      if (record !== undefined && record[one.name] !== undefined)
        initial[one.name] = record[one.name];
      continue;
    }
    if (one === key || one === "id") continue;
    const view = viewOf(meta, one, locale);
    const field = fieldMetaOf(meta, one);
    const relation = relationFieldOf(meta, one);
    const target =
      relation === undefined || relation.many
        ? undefined
        : options.entityFor?.(relation.target);
    // A many2one is chosen by its key, with the picker of the entity it points at.
    const name = target === undefined || relation === undefined ? one : relation.key;
    const choices = choicesOf(meta, one, locale);
    asked.push({
      name,
      label: view.label,
      labelled: target === undefined && labels(view.type, choices),
      draw:
        target === undefined
          ? (control) =>
              controlFor(control, view.type, field?.exact === true, choices, field?.widget)
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
            ),
    });
    if (record !== undefined && record[name] !== undefined) initial[name] = record[name];
  }
  return { fields: asked, initial };
}
