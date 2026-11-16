import { type AnyRecord, labelOf, type Meta } from "@sincpro/criteria";
import { frameworkCopy } from "@sincpro/web-framework/core/copy";

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
 * who did it (`actor`, the context's user) and who the record was then (`entity_display`), and
 * the contract labels a subclass's own fields (`reason` → «Motivo»). Who did it is the entry's
 * `by` — web-ui's activity draws it —; the rest of the envelope never repeats in its detail.
 */
export type HistoryEntry = {
  id: string;
  label: string;
  at: string;
  /** Who did it, as the fact says (`actor`); absent: the system, or a backend before 3.37. */
  by?: string;
  detail?: string;
};

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
]);

function said(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (Array.isArray(value)) return value.length === 0 ? null : value.map(String).join(", ");
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

export function historyOf(
  rows: readonly AnyRecord[],
  meta: Meta | null | undefined,
  locale?: string,
): HistoryEntry[] {
  return rows.map((row) => {
    const label = row["label"] as Record<string, string> | string | undefined;
    const word =
      typeof label === "string"
        ? label
        : // A fact without a label is still a change; its id is not a word anyone reads.
          ((locale ? label?.[locale] : undefined) ??
          label?.["default"] ??
          frameworkCopy().summary.recorded);
    const parts = Object.entries(row)
      .filter(([key]) => !ENVELOPE.has(key))
      .map(([key, value]) => [key, said(value)] as const)
      .filter(([, value]) => value !== null && value !== row["entity_id"])
      .map(([key, value]) => `${labelOf(meta, key, locale)}: ${value}`);
    const actor = said(row["actor"]);
    return {
      id: String(row["id"]),
      label: word,
      at: String(row["created_at"] ?? ""),
      ...(actor === null ? {} : { by: actor }),
      ...(parts.length === 0 ? {} : { detail: parts.join(" · ") }),
    };
  });
}
