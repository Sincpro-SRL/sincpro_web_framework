"use client";

import { type AnyRecord, choicesOf, type Meta } from "@sincpro/criteria";
import {
  adviceAt,
  defaultsOf,
  errorAt,
  linePlacesOf,
  pathOf,
} from "@sincpro/web-framework/core/edit";
import {
  addingOf,
  blankLine,
  type Declared,
  type LineAdding,
  lineFields,
  lineKey,
  moved,
  sameLine,
  writtenInCell,
} from "@sincpro/web-framework/core/lines";
import { textOf, viewOf } from "@sincpro/web-framework/core/present";
import {
  entityFor,
  type RelationField,
  relationFieldOf,
} from "@sincpro/web-framework/core/relation";
import { useEntityFor, useFramework } from "@sincpro/web-framework/react/context";
import type { RecordReading } from "@sincpro/web-framework/react/useRecord";
import {
  controlFor,
  type FieldControl,
  RelationPicker,
} from "@sincpro/web-framework/web/record/control";
import {
  RecordOpeningProvider,
  useRecordOpening,
} from "@sincpro/web-framework/web/record/opening";
import {
  Field,
  type LineEditorState,
  type LineItemColumn,
  LineItems,
  ReadValue,
} from "@sincpro/web-ui";
import { type ReactNode, useRef } from "react";

/** What a control of the screen's own receives for a field of a line: the field's value and
 *  how to change it, as any field control, plus the whole line — a widget may write several
 *  fields at once (a product and its price). */
export type LineControl = FieldControl & {
  line: AnyRecord;
  setLine: (next: AnyRecord) => void;
};

/** A column that is not a field of the line — its delivery, its buttons: read only. */
export type LineColumn = {
  /** Must not be the name of a field of the line. */
  id: string;
  header: string;
  cell: (line: AnyRecord) => ReactNode;
  /** What the lines' search reads in it. */
  text?: (line: AnyRecord) => string;
  numeric?: boolean;
};

/**
 * How the lines look and are written, when the screen wants it its way — every piece optional,
 * every one falling back to the model's.
 *
 * Context: «defaults, never cages». The model decides the columns and their controls; a screen
 * can choose and order the columns, draw a cell its way, write a field with a widget of its
 * own (in the cell and in the dialog), add columns that are not fields (a line's picking with a
 * button that opens it), or write the whole dialog. What it does not get to do is break where
 * a line is written: a field with its own control fits a cell, and a required field left out of
 * the columns sends the line to the dialog (`addingOf`).
 */
export type LinesLook = {
  /** Where a line is written: the table when it can be (the default), or the dialog. */
  adding?: LineAdding;
  /** The fields drawn as columns, in order. The dialog still holds every field. */
  columns?: readonly string[];
  /** A field's cell drawn the screen's way, while it reads. */
  cells?: Readonly<Partial<Record<string, (line: AnyRecord) => ReactNode>>>;
  /** A field written with the screen's own widget — in its cell and in the dialog. */
  controls?: Readonly<Partial<Record<string, (control: LineControl) => ReactNode>>>;
  /** Columns that are not fields, after the fields. */
  extra?: readonly LineColumn[];
  /** The whole line's dialog, the screen's way. */
  editor?: (
    draft: AnyRecord,
    set: (next: AnyRecord) => void,
    state: LineEditorState,
  ) => ReactNode;
};

/** How a field of a line reads: a many2one's key by the name of what it points at. */
function textIn(
  definition: Meta | null,
  field: string,
  relation: RelationField | undefined,
  line: AnyRecord,
  locale: string | undefined,
): string {
  const named =
    relation === undefined
      ? null
      : textOf(definition, relation.relation, line[relation.relation], locale);
  return named ?? textOf(definition, field, line[field], locale) ?? "";
}

/**
 * One field of a line, written — in its cell or in its dialog: a many2one of a declared entity
 * is its picker, anything else the control its type asks for.
 *
 * Context: every change is a COPY of the line that keeps its local key (`sameLine`): a new
 * line has no id, and a row whose key changed is another row to the table — it would lose the
 * focus mid-word. A chosen record is kept beside its key so the cell names it at once.
 */
function LineValue({
  definition,
  field,
  line,
  set,
  label,
  invalid,
  locale,
  inCell,
  own,
}: {
  definition: Meta | null;
  field: string;
  line: AnyRecord;
  set: (next: AnyRecord) => void;
  label: string;
  invalid: boolean;
  locale: string | undefined;
  /** In a cell, where no `Field` names the control. */
  inCell: boolean;
  /** The screen's own widget for this field, if it gave one. */
  own?: ((control: LineControl) => ReactNode) | undefined;
}) {
  const relation = relationFieldOf(definition, field);
  const target = useEntityFor(relation?.target);
  const write = (changes: AnyRecord) => set(sameLine(line, { ...line, ...changes }));
  if (own !== undefined)
    return own({
      value: line[field],
      set: (next) => write({ [field]: next }),
      readonly: false,
      invalid,
      label,
      standalone: inCell,
      line,
      setLine: (next) => set(sameLine(line, next)),
    });
  if (relation !== undefined && !relation.many && target !== undefined) {
    const key = line[relation.key];
    return (
      <RelationPicker
        target={target}
        value={key === null || key === undefined ? "" : String(key)}
        label={label}
        standalone={inCell}
        onChange={(id, chosen) =>
          // A relation held beside its key keeps the chosen record, so the cell names it at
          // once; a key alone (`EntityID`) is only its key — writing the record there too
          // would put the record IN the key.
          write(
            relation.held
              ? { [relation.key]: id, [relation.relation]: chosen ?? null }
              : { [relation.key]: id },
          )
        }
      />
    );
  }
  return controlFor(
    {
      value: line[field],
      set: (next) => write({ [field]: next }),
      readonly: false,
      invalid,
      label,
      standalone: inCell,
    },
    viewOf(definition, field, locale).type,
    definition?.fields[field]?.exact === true,
    choicesOf(definition, field, locale),
  );
}

/**
 * The lines of an aggregate, edited inside its record: web-ui's `LineItems` over the record's
 * edit — what the screen holds is the whole list, and every change writes it back with
 * `edit.set(name, next)`, so it is dirty, previewed, saved and discarded like any field.
 *
 * Context: a one2many of no entity of its own (the lines of an invoice) used to be drawn read
 * only (`RecordLines`). sincpro_framework writes such lines in the aggregate's own command, as
 * the whole list in order; a new line goes without an id (`core/lines`). What `LineItems` does
 * — add, edit, remove with «Deshacer», reorder — is the screen's: only the list that results
 * travels. Each column is a field of the line model (`meta.fields[name].definition`, its
 * scalars: `lineFields`), its control the one its type asks for — a many2one, the picker of its
 * entity (`LineValue`) — its state the line model's hints over the line refined by the server's
 * `items[i]` (`edit.cell`). A server error or warning that points into a cell
 * (`#/values/lines/1/qty`, `["lines", 1, "price"]`) is said IN that cell (web-ui 1.6
 * `cellState`); one about the line as a whole, on the line (`flag`).
 *
 * WHERE a line is written is one decision (`addingOf`): in the TABLE — «Agregar una línea» is
 * its last row, a row is written where it is, the pencil opens the whole line in its dialog —
 * whenever every column a person writes fits a cell; in the DIALOG otherwise, or when the
 * screen asks (`look.adding="editor"`), and then the cells only read. The screen may draw it
 * its way (`LinesLook`) without breaking that rule. A row that cannot be finished where
 * it was opened is a trap, so «inline» is never forced. On a narrow box web-ui draws the lines
 * as cards that open the dialog.
 *
 * Only a WHOLE list is editable: a record that brought one page of 1 000 lines draws them read
 * only (`RecordLines`, «se muestran 50 de 1000»), because a page written back whole deletes
 * every line it did not bring.
 */
export function RecordLinesEditor<T extends AnyRecord>({
  record,
  name,
  lines,
  look = {},
}: {
  record: RecordReading<T>;
  name: string;
  /** The list as on screen (`editableLines(edit.values[name])`), never a page. */
  lines: readonly AnyRecord[];
  /** The screen's way, piece by piece. */
  look?: LinesLook;
}) {
  const { meta, locale, edit } = record;
  const { entities, metas } = useFramework();
  const opening = useRecordOpening();
  const definition: Meta | null = meta?.fields[name]?.definition ?? null;
  const identity = definition?.identity || "id";
  const fields = lineFields(definition);
  const shown =
    look.columns === undefined ? fields : look.columns.filter((one) => fields.includes(one));
  const controls = look.controls ?? {};
  const own = new Set(Object.keys(controls));
  const declared: Declared = (target) => entityFor(entities, target, metas.get) !== undefined;
  const adding = addingOf(definition, {
    declared,
    shown,
    own,
    ...(look.adding === undefined ? {} : { asked: look.adding }),
  });
  const writing = !edit.state(name).readonly;
  // Once per render, not per cell: 2 000 lines × 8 fields asked the model 16 000 times.
  const relations = new Map(
    fields.map((field) => [field, relationFieldOf(definition, field)]),
  );
  const keyOf = (line: AnyRecord) => lineKey(line, identity);
  // Where each line is, by its key — once per render: a `findIndex` per line drawn made the
  // flags of 2 000 lines cost 50 ms (quadratic); with the map, a fraction of one.
  const positions = new Map(lines.map((one, i) => [keyOf(one), i]));
  const indexOf = (line: AnyRecord) => positions.get(keyOf(line)) ?? lines.length;
  // A callback of `LineItems` can run long after its render — «Deshacer» in a toast, seconds
  // after the line went — so every change starts from the list on screen NOW, never the one of
  // the render that made the callback.
  const now = useRef(lines);
  now.current = lines;
  const write = (change: (lines: readonly AnyRecord[]) => readonly AnyRecord[]) =>
    edit.set(name, change(now.current));

  const drawn = new Set(shown);
  const fieldColumns: LineItemColumn<AnyRecord>[] = shown.map((field) => {
    const view = viewOf(definition, field, locale);
    const relation = relations.get(field);
    const inCell =
      writing &&
      adding === "inline" &&
      definition !== null &&
      definition.fields[field]?.readonly !== true &&
      (own.has(field) || writtenInCell(definition, field, declared));
    const ownCell = look.cells?.[field];
    return {
      id: field,
      header: view.label,
      value: (line) => line[field] as never,
      // Drawn as read: «Cemento 50 kg», not «CEM-50»; «1.552,00», not «1552.00».
      cell: ownCell ?? ((line) => textIn(definition, field, relation, line, locale)),
      text: (line) => textIn(definition, field, relation, line, locale),
      numeric: view.type === "number" || view.type === "integer",
      ...(inCell
        ? {
            edit: (line: AnyRecord, set: (next: AnyRecord) => void) => (
              <LineValue
                definition={definition}
                field={field}
                line={line}
                set={set}
                label={view.label}
                invalid={false}
                locale={locale}
                inCell
                own={controls[field]}
              />
            ),
          }
        : {}),
    };
  });
  const columns: LineItemColumn<AnyRecord>[] = [
    ...fieldColumns,
    ...(look.extra ?? []).map((one) => ({
      id: one.id,
      header: one.header,
      value: () => null as never,
      cell: one.cell,
      ...(one.text === undefined ? {} : { text: one.text }),
      ...(one.numeric === undefined ? {} : { numeric: one.numeric }),
    })),
  ];

  const table = (
    <LineItems<AnyRecord>
      lines={lines}
      columns={columns}
      getLineId={keyOf}
      mode={writing ? "edit" : "read"}
      adding={adding}
      onChange={(key, next) =>
        write((all) => all.map((one) => (keyOf(one) === key ? sameLine(one, next) : one)))
      }
      newLine={() => blankLine(defaultsOf(definition), identity)}
      onAdd={(line) => write((all) => [...all, line])}
      onRemove={(key) => write((all) => all.filter((one) => keyOf(one) !== key))}
      onRestore={(line, index) =>
        write((all) => [...all.slice(0, index), line, ...all.slice(index)])
      }
      onReorder={(key, before) => write((all) => moved(all, identity, key, before))}
      // A cell says its own (web-ui 1.6 `cellState`): the line model's hints refined by the
      // server's `items[i]`, the error pointing at it (under its value) and its warning.
      cellState={(line, column) => {
        const index = indexOf(line);
        const places = linePlacesOf(name, line, index, identity).map(
          (one) => `${one}/${column}`,
        );
        const state = edit.cell(name, index, column);
        const error = places
          .map((at) => errorAt(edit.errors, at))
          .find((one) => one !== undefined);
        const warned = places.flatMap((at) => adviceAt(edit.advice, at))[0];
        return {
          readonly: state.readonly,
          required: state.required,
          hidden: !state.visible,
          ...(error === undefined ? {} : { error }),
          ...(warned === undefined
            ? {}
            : { flag: { tone: warned.blocks_save ? "bad" : "warn", label: warned.message } }),
        };
      }}
      // The line's own flag: what points at the line and at no cell drawn — the line as a
      // whole, or a field it has no column for (an id the server does not know).
      flag={(line) => {
        const places = linePlacesOf(name, line, indexOf(line), identity);
        const onLine = (key: string) =>
          places.some(
            (at) =>
              key === at ||
              (key.startsWith(`${at}/`) &&
                !drawn.has(key.slice(at.length + 1).split("/")[0]!)),
          );
        const error = Object.entries(edit.errors).find(([key]) => onLine(key))?.[1];
        if (error !== undefined) return { tone: "bad", label: error };
        const warned = edit.advice.find((one) =>
          onLine(pathOf(one.path ?? [one.field ?? ""])),
        );
        return warned === undefined
          ? null
          : { tone: warned.blocks_save ? "bad" : "warn", label: warned.message };
      }}
      editor={(draft, set, state) => {
        if (look.editor !== undefined) return look.editor(draft, set, state);
        const index = indexOf(draft);
        return (
          <div className="grid gap-3">
            {fields.map((field) => {
              const state = edit.cell(name, index, field);
              if (!state.visible) return null;
              const view = viewOf(definition, field, locale);
              const error = edit.errors[`${name}/${index}/${field}`];
              return (
                <Field
                  key={field}
                  label={view.label}
                  required={state.required && !state.readonly}
                  {...(error === undefined ? {} : { error })}
                >
                  {state.readonly ? (
                    <ReadValue
                      value={
                        textIn(definition, field, relations.get(field), draft, locale) || "—"
                      }
                    />
                  ) : (
                    <LineValue
                      definition={definition}
                      field={field}
                      line={draft}
                      set={set}
                      label={view.label}
                      invalid={error !== undefined}
                      locale={locale}
                      inCell={false}
                      own={controls[field]}
                    />
                  )}
                </Field>
              );
            })}
          </div>
        );
      }}
    />
  );
  // Inside a line «Buscar más…» is the picker's own chooser, never the workspace's — the
  // screen's own controls included: the workspace opens it outside the line, a row commits when
  // the focus leaves it, and the answer would land on a line no longer being written (over the
  // line's dialog, a modal over a modal). Opening a chosen record is still the workspace's.
  if (opening === null || opening.choose === undefined) return table;
  const { choose: _, ...inLine } = opening;
  return <RecordOpeningProvider value={inLine}>{table}</RecordOpeningProvider>;
}
