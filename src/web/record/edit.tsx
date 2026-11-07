"use client";

import { type Entity } from "@sincpro/client-framework";
import { type AnyRecord, choicesOf } from "@sincpro/criteria";
import { frameworkCopy } from "@sincpro/web-framework/core/copy";
import { errorAt } from "@sincpro/web-framework/core/edit";
import { editableLines } from "@sincpro/web-framework/core/lines";
import { textOf, viewOf } from "@sincpro/web-framework/core/present";
import { relationFieldOf } from "@sincpro/web-framework/core/relation";
import { useEntityFor, useFramework } from "@sincpro/web-framework/react/context";
import { useNameOf } from "@sincpro/web-framework/react/useNameOf";
import type { RecordReading } from "@sincpro/web-framework/react/useRecord";
import type { EntityListProps } from "@sincpro/web-framework/web/list/EntityList";
import {
  controlFor,
  type FieldControl,
  RelationPicker,
} from "@sincpro/web-framework/web/record/control";
import { type LinesLook, RecordLinesEditor } from "@sincpro/web-framework/web/record/lines";
import { useRecordOpening } from "@sincpro/web-framework/web/record/opening";
import { RecordLines } from "@sincpro/web-framework/web/record/record";
import { RelatedList } from "@sincpro/web-framework/web/record/RelatedList";
export type { FieldControl } from "@sincpro/web-framework/web/record/control";
import {
  Checkbox,
  type DirtyState,
  Field,
  FormSection,
  type OpenTarget,
  ReadValue,
  RelationValue,
  type RelationValueProps,
} from "@sincpro/web-ui";
import type { ReactNode } from "react";

/** A key alone, read: the name of the record it points at, asked once by key — the key until
 *  then, and when nothing answers. */
function KeyValue({
  target,
  id,
  ...rest
}: { target: Entity; id: string } & Omit<RelationValueProps, "name">) {
  const name = useNameOf(target, id);
  return <RelationValue name={name ?? id} {...rest} />;
}

/**
 * One field of a record being edited, from the model: its word, whether it is required or
 * read-only now (the hints, evaluated over what is on screen), the server's error for it, and a
 * control chosen by its type.
 *
 * Context: forge's forms wrote `<Field label="Nombre" required><TextInput … /></Field>` once per
 * field, with the label, the «required» and the value plumbing by hand, while the server already
 * said all three. Here a field is a NAME. The control by type is a default, never the only way:
 * `as` draws any control — a rich text, a domain widget — and still receives the value, the
 * setter and the state.
 *
 * A many2one needs no `as`: the model says what it points at (`relation: "Cliente"`, the key
 * `customer_id` it is written by), the application declared that entity
 * (`SincproApp entities`), so the field is an `EntityPicker` of it — the server's literal
 * search, the ten first, «Buscar más…» — and, read-only, the record's name as a link. Where it
 * opens is the view's (`RecordOpening`: a modal in a workspace, nothing outside one).
 *
 * A one2many is a block: its lines (`lines`) or its related list (`list`), each with every piece
 * replaceable the screen's way.
 *
 *     <RecordField record={invoice} name="due_date" />
 *     <RecordField record={invoice} name="customer_id" />
 *     <RecordField record={invoice} name="lines" lines={{ controls: { qty: Stepper } }} />
 */

export function RecordField<T extends Record<string, unknown>>({
  record,
  name,
  as,
  bare = false,
  lines: look,
  list: listed,
}: {
  record: RecordReading<T>;
  name: string;
  as?: (control: FieldControl) => ReactNode;
  /** The control without its label — inside a page or a section that already names it. */
  bare?: boolean;
  /** Lines (a one2many of no entity of its own), the screen's way: where a line is written,
   *  which columns, a cell or a control of its own, columns that are not fields, the dialog. */
  lines?: LinesLook;
  /** A one2many of a declared entity, the screen's way: anything `EntityList` takes — its
   *  cells, row actions, commands, faces of its own. What it passes wins over the defaults. */
  list?: Omit<EntityListProps<AnyRecord>, "listing" | "embedded">;
}) {
  const { meta, locale, edit } = record;
  const view = viewOf(meta, name, locale);
  const state = edit.state(name);
  const relation = relationFieldOf(meta, name);
  const target = useEntityFor(relation?.target);
  const opening = useRecordOpening();
  const { metas } = useFramework();
  if (!state.visible) return null;
  // A one2many is a BLOCK, named by a section — never a `Field`: web-ui's controls read the
  // id and the label of the `Field` around them, and every cell and the list's search bar
  // took the same id and the relation's name.
  // A one2many of a declared entity is that entity's own list, filtered to this record by
  // the server — never the page the record happened to bring — and a row opens its record.
  // A one2many of no declared entity (the lines of an invoice): edited inside the record as a
  // whole list (`RecordLinesEditor`) — or, when the record brought only a page, that page read
  // only with its real total.
  // A list of values inside the record (`field.embedded(definition, { many: true })`: a
  // project's channels, an inventory's components) — no model of its own, no id — is edited the
  // same way as lines: a whole list, local keys, through the record's own save.
  const own = meta?.fields[name];
  if (as === undefined && own?.type === "embedded" && own.many === true && own.definition) {
    // A page of them stays read only, as a one2many's: written back whole it would drop what
    // it did not bring.
    const whole = editableLines(edit.values[name]);
    const lines =
      whole === null ? (
        <RecordLines record={record.record ?? {}} meta={meta} name={name} locale={locale} />
      ) : (
        <RecordLinesEditor
          record={record}
          name={name}
          lines={whole}
          {...(look === undefined ? {} : { look })}
        />
      );
    return bare ? lines : <FormSection title={view.label}>{lines}</FormSection>;
  }
  if (as === undefined && relation?.field.type === "one2many" && target === undefined) {
    // Editable when the record holds ALL its lines; a page of them stays read only, and so do
    // the records it only references — nothing it saves writes them.
    const whole = editableLines(edit.values[name], relation.field);
    const lines =
      whole === null ? (
        <RecordLines record={record.record ?? {}} meta={meta} name={name} locale={locale} />
      ) : (
        <RecordLinesEditor
          record={record}
          name={name}
          lines={whole}
          {...(look === undefined ? {} : { look })}
        />
      );
    return bare ? lines : <FormSection title={view.label}>{lines}</FormSection>;
  }
  if (as === undefined && relation?.field.type === "one2many" && target !== undefined) {
    const list = (
      <RelatedList
        record={record}
        name={name}
        entity={target}
        {...(opening === null
          ? {}
          : (() => {
              const refOf = (row: AnyRecord) => {
                const known = metas.get(target.key);
                const key = known?.get_id || known?.identity || "id";
                return target.ref(String(row[key]));
              };
              // A press opens where the view says first; «Abrir en…» offers every other place.
              return {
                onOpen: (row: AnyRecord) =>
                  opening.open(refOf(row), opening.targets[0] ?? "page"),
                onOpenIn: (row: AnyRecord, to: OpenTarget) => opening.open(refOf(row), to),
                openTargets: opening.targets,
                // Not on a page, a list inside the form starts as rows; the table stays a click
                // away.
                ...(opening.narrow === true ? { views: ["rows", "table"] as const } : {}),
              };
            })())}
        {...listed}
      />
    );
    return bare ? list : <FormSection title={view.label}>{list}</FormSection>;
  }
  const value = edit.values[name];
  const error = errorAt(edit.errors, name);
  const control: FieldControl = {
    value,
    set: (next) => edit.set(name, next),
    readonly: state.readonly,
    invalid: error !== undefined,
    label: view.label,
  };
  const field = meta?.fields[name];

  /** A many2one of a declared entity: chosen by the server's literal search, opened where the
   *  view says. Written by its key; read by the record it points at. */
  function manyToOne(): ReactNode {
    if (relation === undefined || target === undefined) return null;
    const key = edit.values[relation.key];
    const id = key === null || key === undefined ? "" : String(key);
    if (state.readonly) {
      const opens =
        opening === null || id === ""
          ? {}
          : {
              onOpenIn: (to: OpenTarget) => opening.open(target.ref(id), to),
              openTargets: opening.targets,
            };
      // A relation held beside its key names itself; a key alone (`EntityID`) asks its name.
      if (!relation.held) return <KeyValue target={target} id={id} {...opens} />;
      return (
        <RelationValue
          name={textOf(meta, relation.relation, edit.values[relation.relation], locale) ?? id}
          {...opens}
        />
      );
    }
    return (
      <RelationPicker
        target={target}
        value={id}
        onChange={(next) => edit.set(relation.key, next)}
        label={view.label}
        // Not required, it can be emptied: the key — and the record held beside it — go null.
        // The relation's own state, and its key's: a screen may name either.
        {...(state.required || edit.state(relation.key).required
          ? {}
          : {
              onClear: () => {
                edit.set(relation.key, null);
                if (relation.held) edit.set(relation.relation, null);
              },
            })}
      />
    );
  }

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
      ) : relation !== undefined && !relation.many && target !== undefined ? (
        manyToOne()
      ) : state.readonly ? (
        <ReadValue value={textOf(meta, name, value, locale) ?? "—"} />
      ) : (
        controlFor(control, view.type, field?.exact === true, choicesOf(meta, name, locale))
      )}
    </Field>
  );
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
