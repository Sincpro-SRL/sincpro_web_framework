import { type AnyRecord, labelOf, type Meta } from "@sincpro/criteria";
import { frameworkCopy } from "@sincpro/web-framework/core/copy";
import { textOf } from "@sincpro/web-framework/core/present";

/**
 * A record's history as people read it — its business events, newest first.
 *
 * Context: sincpro_framework keeps every context's facts in one event table, and answers a
 * record's own with `DomainEvents` (`GET /issues/{id}/events`, the entity's `history`), each
 * fact naming the record it is about (`entity_type`, `entity_id`) and carrying a `label` in
 * every language.
 * forge's console read it with a dictionary of field names written by hand; here the words for
 * the rest of a fact come from the events' own model definition, like any other field.
 *
 * These are business facts («Factura confirmada»), never technical logs: those belong to the
 * observability stack, not to a record's screen.
 *
 * Since sincpro_framework 3.37 every fact also says which one it is (`name`, `billing.v1.deleted`),
 * who did it (`actor`, the context's user — from the caller's identity since 3.37.1) and who the
 * record was then (`entity_display`). Who did it is the entry's `by` — web-ui's activity draws
 * it —; the rest of the envelope never repeats in its detail. What a fact's own fields are
 * called is its event's definition in the contract (3.37.1): `eventMetasOf(contract)`
 * (client-framework), by the fact's `name` — «reason» reads «Motivo» —, given to the provider as
 * `events`; without it, the history route's own definition.
 *
 * An edit (`EntityUpdated`) carries each field it moved as `changes: {field: [before, after]}`
 * and the word it was called then (`field_labels`, kept because an audit says what a person saw
 * at the time). It is handed to web-ui's activity as `changes` — «Título», «Bienvenidos» struck
 * → «Bienvenidos al CAUOR» —, in sight under the event and scanned field by field, each side as
 * the record's own model writes it (a state by its word, an amount as money, a date in the
 * installed style). It used to be one line in `detail` («Título: Bienvenidos → …»), which could
 * be read but not scanned, and an empty side was a «—» that read as a dash somebody typed.
 */
export type HistoryEntry = {
  id: string;
  label: string;
  at: string;
  /** Who did it, as the fact says (`actor`); absent: the system, or a backend before 3.37. */
  by?: string;
  detail?: string;
  /** The fields an edit moved, as web-ui's `ActivityEvent.changes` draws them. */
  changes?: readonly HistoryChange[];
  /** The colour of this kind of fact (`FACT_TONES`, or the application's by `name`). */
  tone?: FactTone;
};

/** One field an edit moved: its word then, and each side as the record's model writes it —
 *  `null` is empty, which web-ui writes «vacío». */
export type HistoryChange = { field: string; from: string | null; to: string | null };

/** The tones a fact may take — web-ui's `Tone`, named here because `core/` imports no UI. */
export type FactTone = "neutral" | "info" | "good" | "warn" | "bad" | "accent";

/**
 * The colour of a kind of fact, by its `name` — whole (`quipu.pagos.v1.pago_aprobado`) or its
 * last part (`pago_aprobado`), so a version bump keeps it. These are the framework's own facts
 * of a record's life; an application names its own (`presented(entity, { facts })`), over these.
 * An edit and a creation carry no tone: they are the ordinary life of a record.
 */
export const FACT_TONES: Readonly<Record<string, FactTone>> = {
  deleted: "bad",
  archived: "warn",
  restored: "info",
};

/** The tone of a fact by its name, among `tones`; none when nothing names it. */
export function toneOfFact(
  name: unknown,
  tones: Readonly<Record<string, FactTone>> = FACT_TONES,
): FactTone | undefined {
  if (typeof name !== "string" || name === "") return undefined;
  return tones[name] ?? tones[name.slice(name.lastIndexOf(".") + 1)];
}

/** What every fact carries: what remains is what this fact says. */
const ENVELOPE = new Set([
  "id",
  "name",
  "created_at",
  "updated_at",
  "version",
  "label",
  "entity_type",
  "entity_id",
  "entity_display",
  "entity_version",
  "actor",
  "correlation_id",
  "causation_id",
  // An edit's own: its `changes`, field by field, never as JSON.
  "changes",
  "field_labels",
]);

function said(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (Array.isArray(value)) return value.length === 0 ? null : value.map(String).join(", ");
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

/** A word in every language (`{default, es}`), or a plain one, in `locale`. */
function wordOf(
  word: Readonly<Record<string, string>> | string | undefined,
  locale: string | undefined,
): string | undefined {
  if (typeof word === "string") return word === "" ? undefined : word;
  return (locale ? word?.[locale] : undefined) ?? word?.["default"];
}

/** One side of a change, as the record's model writes the field; nothing is `null`. */
function sideOf(
  record: Meta | null | undefined,
  field: string,
  value: unknown,
  locale: string | undefined,
): string | null {
  // A record's own model writes it (a choice by its word, money as money); without one, a
  // boolean is still the copy table's word and never «true».
  const text =
    typeof value === "boolean" && !record?.fields[field]
      ? value
        ? frameworkCopy().value.yes
        : frameworkCopy().value.no
      : (textOf(record, field, value, locale) ?? said(value));
  return text === null || text === undefined || text === "" ? null : text;
}

/** What an edit moved, one field each: its word then, as it was and as it is. */
function editOf(
  row: AnyRecord,
  record: Meta | null | undefined,
  locale: string | undefined,
): HistoryChange[] {
  const changes = row["changes"];
  if (typeof changes !== "object" || changes === null || Array.isArray(changes)) return [];
  const labels = (row["field_labels"] ?? {}) as Readonly<
    Record<string, Readonly<Record<string, string>> | string>
  >;
  return Object.entries(changes as Readonly<Record<string, unknown>>).map(([field, pair]) => {
    // `(before, after)` travels as a list; anything else is only what it is now.
    const [before, after] = Array.isArray(pair) ? pair : [undefined, pair];
    return {
      // The word it had THEN, else the record's model's, else its name.
      field: wordOf(labels[field], locale) ?? labelOf(record, field, locale),
      from: sideOf(record, field, before, locale),
      to: sideOf(record, field, after, locale),
    };
  });
}

/**
 * The facts of a record as entries of web-ui's activity.
 *
 *     historyOf(rows, eventsMeta, "es", { record: pagoMeta, tones: { pago_aprobado: "good" } })
 *       -> [{ label: "Se actualizó", changes: [{ field: "Estado", from: "En revisión",
 *             to: "Validado" }], by: "ana", … }]
 *
 * `meta` is the history route's definition; `events` each event's own, by its wire name
 * (`eventMetasOf(contract)`), which names a fact's own fields first; `record` is the record's,
 * which writes each side of an edit. `tones` colour each kind of fact by its `name`, over the
 * framework's own (`FACT_TONES`).
 */
export function historyOf(
  rows: readonly AnyRecord[],
  meta: Meta | null | undefined,
  locale?: string,
  options: {
    record?: Meta | null | undefined;
    events?: Readonly<Record<string, Meta>> | undefined;
    tones?: Readonly<Record<string, FactTone>> | undefined;
  } = {},
): HistoryEntry[] {
  const tones = { ...FACT_TONES, ...options.tones };
  return rows.map((row) => {
    const label = row["label"] as Record<string, string> | string | undefined;
    // A fact without a label is still a change; its id is not a word anyone reads.
    const word = wordOf(label, locale) ?? frameworkCopy().summary.recorded;
    // This kind of fact's own definition names its fields; the route's, when it is not known.
    const own = (typeof row["name"] === "string" && options.events?.[row["name"]]) || meta;
    const parts = Object.entries(row)
      .filter(([key]) => !ENVELOPE.has(key))
      .map(([key, value]) => [key, said(value)] as const)
      .filter(([, value]) => value !== null && value !== row["entity_id"])
      .map(([key, value]) => `${labelOf(own, key, locale)}: ${value}`);
    const changes = editOf(row, options.record, locale);
    const actor = said(row["actor"]);
    const tone = toneOfFact(row["name"], tones);
    return {
      id: String(row["id"]),
      label: word,
      at: String(row["created_at"] ?? ""),
      ...(actor === null ? {} : { by: actor }),
      ...(parts.length === 0 ? {} : { detail: parts.join(" · ") }),
      ...(changes.length === 0 ? {} : { changes }),
      ...(tone === undefined ? {} : { tone }),
    };
  });
}
