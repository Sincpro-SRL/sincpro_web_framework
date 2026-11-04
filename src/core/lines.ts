import type { AnyRecord, Meta } from "@sincpro/criteria";
import { BOOKKEEPING, defaultFields } from "@sincpro/web-framework/core/present";
import { relatedOf } from "@sincpro/web-framework/core/related";
import { relationFieldOf } from "@sincpro/web-framework/core/relation";

/**
 * The lines of an aggregate as a form edits them: the whole list, in order.
 *
 * Context: sincpro_framework writes the lines of an aggregate in the same command as the
 * aggregate — the list as the form holds it, whole and in order, with the version it was read
 * at (without it, a whole list would delete a line someone else added). A line that came from
 * the server carries its id; a new one goes WITHOUT one — the server refuses an id it does not
 * know and mints its own. So a new line's key on screen is kept APART from the line (a weak map
 * on the line object), carried to each edited copy, and matched by POSITION to what the server
 * answers about the list it was sent. Adding, removing, undoing and reordering are the screen's:
 * nothing about them travels but the resulting list — no per-line commands on the wire.
 */

const keys = new WeakMap<object, string>();
let minted = 0;

/** The key a line is drawn and found by: its identity, or a local one while it has none. */
export function lineKey(line: AnyRecord, identity: string): string {
  const own = line[identity];
  if (own !== undefined && own !== null && own !== "") return String(own);
  let key = keys.get(line);
  if (key === undefined) {
    key = `new-${++minted}`;
    keys.set(line, key);
  }
  return key;
}

/** `next` is `line` edited: it keeps the line's local key. */
export function sameLine<T extends AnyRecord>(line: AnyRecord, next: T): T {
  const key = keys.get(line);
  if (key !== undefined && !keys.has(next)) keys.set(next, key);
  return next;
}

/** What the server answered about the list it was sent, each line keeping its key by position. */
export function linesAnswered(
  sent: readonly AnyRecord[],
  answered: readonly AnyRecord[],
): AnyRecord[] {
  return answered.map((line, i) => (sent[i] === undefined ? line : sameLine(sent[i], line)));
}

/**
 * The lines a form can edit, or `null` when it holds only part of them: a list written back
 * whole from one page would delete every line the page did not bring.
 */
export function editableLines(value: unknown): AnyRecord[] | null {
  if (Array.isArray(value)) return value as AnyRecord[];
  const related = relatedOf<AnyRecord>(value);
  return related.partial ? null : [...related.items];
}

/** A blank line: the line model's defaults, never its identity — the server mints that. */
export function blankLine(defaults: AnyRecord, identity: string): AnyRecord {
  const { [identity]: _id, ...rest } = defaults;
  return { ...rest };
}

/** The list with the line `key` moved before `before` (`null`: to the end). */
export function moved<T extends AnyRecord>(
  lines: readonly T[],
  identity: string,
  key: string,
  before: string | null,
): T[] {
  const line = lines.find((one) => lineKey(one, identity) === key);
  if (line === undefined) return [...lines];
  const rest = lines.filter((one) => one !== line);
  const at =
    before === null
      ? rest.length
      : rest.findIndex((one) => lineKey(one, identity) === before);
  return [
    ...rest.slice(0, at < 0 ? rest.length : at),
    line,
    ...rest.slice(at < 0 ? rest.length : at),
  ];
}

/** Where «Agregar una línea» writes the new line: a row of the table, or the line's dialog. */
export type LineAdding = "inline" | "editor";

/** Whether an aggregate of the application answers for `target` («Producto»). */
export type Declared = (target: string) => boolean;

/** The value types a cell has a control for: each one fits the width of a column. */
const CELL_TYPES: ReadonlySet<string> = new Set([
  "text",
  "integer",
  "number",
  "date",
  "datetime",
  "boolean",
  "text[]",
]);

/**
 * The fields a line is drawn and written by: its scalars, as a form's — never its identity
 * (the server mints it) nor the bookkeeping. A many2one is its key (`product_code`), which the
 * screen names by its relation (`product`).
 */
export function lineFields(definition: Meta | null): string[] {
  if (definition === null) return [];
  return defaultFields(definition).filter(
    (field) => field !== definition.identity && !BOOKKEEPING.has(field),
  );
}

/**
 * Whether a field of a line can be written inside its cell.
 *
 * Context: a cell holds a control as wide as its column. A many2one is a picker only when the
 * application declared the entity it points at — otherwise its key is an id nobody types.
 * An embedded value or anything the table has no control for needs the dialog's room.
 */
export function writtenInCell(definition: Meta, field: string, declared: Declared): boolean {
  const relation = relationFieldOf(definition, field);
  if (relation !== undefined) return !relation.many && declared(relation.target);
  return CELL_TYPES.has(definition.fields[field]?.type ?? "");
}

/** What decides where a line is written, besides its model. */
export type AddingRule = {
  /** Whether the application declared the entity a relation points at. */
  declared: Declared;
  /** The screen's choice: «editor» always holds, «inline» only where it works. */
  asked?: LineAdding;
  /** The fields drawn as columns, when the screen chose them. Without it, every line field. */
  shown?: readonly string[];
  /** The fields the screen writes with a control of its own: they fit a cell whatever their
   *  type — the screen said how. */
  own?: ReadonlySet<string>;
};

/**
 * How «Agregar una línea» adds: in the table when every column a person may write fits a cell
 * and nothing required is left out of the columns; in the dialog otherwise — a row that cannot
 * be finished where it was opened is a trap.
 */
export function addingOf(definition: Meta | null, rule: AddingRule): LineAdding {
  if (rule.asked === "editor" || definition === null) return "editor";
  const fields = lineFields(definition);
  const shown = new Set(rule.shown ?? fields);
  const writable = (field: string) => definition.fields[field]?.readonly !== true;
  const fits = (field: string) =>
    rule.own?.has(field) === true || writtenInCell(definition, field, rule.declared);
  const ok = fields
    .filter(writable)
    .every((field) =>
      shown.has(field) ? fits(field) : definition.fields[field]?.required !== true,
    );
  return ok ? "inline" : "editor";
}
