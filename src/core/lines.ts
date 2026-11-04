import type { AnyRecord } from "@sincpro/criteria";
import { relatedOf } from "@sincpro/web-framework/core/related";

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
