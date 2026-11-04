"use client";

import { type AnyRecord, choicesOf, labelOf, type Meta } from "@sincpro/criteria";
import { adviceAt, defaultsOf, errorAt, pathOf } from "@sincpro/web-framework/core/edit";
import { blankLine, lineKey, moved, sameLine } from "@sincpro/web-framework/core/lines";
import { textOf, viewOf } from "@sincpro/web-framework/core/present";
import type { RecordReading } from "@sincpro/web-framework/react/useRecord";
import { controlFor } from "@sincpro/web-framework/web/record/control";
import { Field, type LineItemColumn, LineItems, ReadValue } from "@sincpro/web-ui";
import { useRef } from "react";

/**
 * The lines of an aggregate, edited inside its record: web-ui's `LineItems` over the record's
 * edit — what the screen holds is the whole list, and every change writes it back with
 * `edit.set(name, next)`, so it is dirty, previewed, saved and discarded like any field.
 *
 * Context: a one2many of no entity of its own (the lines of an invoice) used to be drawn read
 * only (`RecordLines`). sincpro_framework writes such lines in the aggregate's own command, as
 * the whole list in order; a new line goes without an id (`core/lines`). What `LineItems` does
 * — add, edit in its dialog, remove with «Deshacer», reorder — is the screen's: only the list
 * that results travels. Each cell is the line model's field (`meta.fields[name].definition`),
 * its control the one its type asks for (`controlFor`), its state the line model's hints over
 * the line refined by the server's `items[i]` (`edit.cell`). A server error or warning that
 * points into a cell (`#/values/lines/1/qty`, `["lines", 1, "price"]`) is said IN that cell
 * (web-ui 1.6 `cellState`); one about the line as a whole, on the line (`flag`).
 *
 * Only a WHOLE list is editable: a record that brought one page of 1 000 lines draws them read
 * only (`RecordLines`, «se muestran 50 de 1000»), because a page written back whole deletes
 * every line it did not bring.
 */
export function RecordLinesEditor<T extends AnyRecord>({
  record,
  name,
  lines,
}: {
  record: RecordReading<T>;
  name: string;
  /** The list as on screen (`editableLines(edit.values[name])`), never a page. */
  lines: readonly AnyRecord[];
}) {
  const { meta, locale, edit } = record;
  const definition: Meta | null = meta?.fields[name]?.definition ?? null;
  const identity = definition?.identity || "id";
  const fields = Object.keys(definition?.fields ?? {}).filter((one) => one !== identity);
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

  const drawn = new Set(fields);
  const columns: LineItemColumn<AnyRecord>[] = fields.map((field) => {
    const type = viewOf(definition, field, locale).type;
    return {
      id: field,
      header: labelOf(definition, field, locale),
      value: (line) => line[field] as never,
      text: (line) => textOf(definition, field, line[field], locale) ?? "",
      numeric: type === "number" || type === "integer",
    };
  });

  return (
    <LineItems<AnyRecord>
      lines={lines}
      columns={columns}
      getLineId={keyOf}
      mode={edit.state(name).readonly ? "read" : "edit"}
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
        const at = `${name}/${index}/${column}`;
        const state = edit.cell(name, index, column);
        const error = errorAt(edit.errors, at);
        const warned = adviceAt(edit.advice, at)[0];
        return {
          readonly: state.readonly,
          required: state.required,
          hidden: !state.visible,
          ...(error === undefined ? {} : { error }),
          ...(warned === undefined ? {} : { flag: { tone: "warn", label: warned.message } }),
        };
      }}
      // The line's own flag: what points at the line and at no cell drawn — the line as a
      // whole, or a field it has no column for (an id the server does not know).
      flag={(line) => {
        const at = `${name}/${indexOf(line)}`;
        const onLine = (key: string) =>
          key === at ||
          (key.startsWith(`${at}/`) && !drawn.has(key.slice(at.length + 1).split("/")[0]!));
        const error = Object.entries(edit.errors).find(([key]) => onLine(key))?.[1];
        if (error !== undefined) return { tone: "bad", label: error };
        const warned = edit.advice.find((one) =>
          onLine(pathOf(one.path ?? [one.field ?? ""])),
        );
        return warned === undefined ? null : { tone: "warn", label: warned.message };
      }}
      editor={(draft, set) => {
        const index = indexOf(draft);
        return (
          <div className="grid gap-3">
            {fields.map((field) => {
              const state = edit.cell(name, index, field);
              if (!state.visible) return null;
              const view = viewOf(definition, field, locale);
              const error = edit.errors[`${name}/${index}/${field}`];
              const value = draft[field];
              return (
                <Field
                  key={field}
                  label={view.label}
                  required={state.required && !state.readonly}
                  {...(error === undefined ? {} : { error })}
                >
                  {state.readonly ? (
                    <ReadValue value={textOf(definition, field, value, locale) ?? "—"} />
                  ) : (
                    controlFor(
                      {
                        value,
                        set: (next) => set(sameLine(draft, { ...draft, [field]: next })),
                        readonly: false,
                        invalid: error !== undefined,
                        label: view.label,
                      },
                      view.type,
                      definition?.fields[field]?.exact === true,
                      choicesOf(definition, field, locale),
                    )
                  )}
                </Field>
              );
            })}
          </div>
        );
      }}
    />
  );
}
