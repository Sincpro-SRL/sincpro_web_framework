import type { AnyRecord, Meta } from "@sincpro/criteria";
import { textOf } from "@sincpro/web-framework/core/present";

/**
 * What is known about ANY record, the same for every entity: its name and, when it has them,
 * a description, a state, a type, a picture and who made and last changed it.
 *
 * Context: a link, a chip, a card, the summary that floats from a name and the header of a
 * record all say the same few things about a record — only how much of it changes. Read once
 * here, from the model, they cannot disagree, and a new entity looks right without a line
 * written for it. What a record does not have is `null`, and nothing is drawn for it.
 *
 * Which field plays each part: the one the entity declares (`entity(…, { summary })`), else
 * the first conventional name the model holds (`description`, `state`/`status`, `created_at`,
 * …). The name is the model's own `display`. When the backend publishes these parts in its
 * model definition, they are read from there and the convention steps aside.
 */
export type SummaryPart =
  | "description"
  | "state"
  | "type"
  | "image"
  | "createdAt"
  | "createdBy"
  | "updatedAt"
  | "updatedBy";

/** Which field of the entity plays each part, when it is not the conventional one.
 *  `person`: its records are people or companies — a round face, initials without a photo. */
export type SummaryFields = Partial<Record<SummaryPart, string>> & { person?: boolean };

export type RecordSummary = {
  id: string;
  name: string;
  description: string | null;
  state: string | null;
  type: string | null;
  /** The picture's address, as the server sent it. */
  image: string | null;
  person: boolean;
  created: { at: string | null; by: string | null };
  updated: { at: string | null; by: string | null };
};

const CONVENTION: Readonly<Record<SummaryPart, readonly string[]>> = {
  description: ["description", "summary"],
  state: ["state", "status"],
  type: ["type", "kind", "category"],
  image: ["image", "image_url", "avatar", "avatar_url", "photo", "picture", "logo"],
  createdAt: ["created_at"],
  createdBy: ["created_by"],
  updatedAt: ["updated_at"],
  updatedBy: ["updated_by"],
};

const PARTS = Object.keys(CONVENTION) as SummaryPart[];

/** The field that plays each part. With a model, only fields it declares; without one (a
 *  record that came alone), the record's own keys. */
export function summaryFieldsOf(
  meta: Meta | null | undefined,
  record: AnyRecord,
  declared: SummaryFields = {},
): Partial<Record<SummaryPart, string>> {
  const holds = (name: string) =>
    meta?.fields ? name in meta.fields : Object.hasOwn(record, name);
  const found: Partial<Record<SummaryPart, string>> = {};
  for (const part of PARTS) {
    const name = declared[part] ?? CONVENTION[part].find(holds);
    if (name !== undefined) found[part] = name;
  }
  return found;
}

/**
 *     summaryOf(meta, invoice, { locale: "es" })
 *       -> { name: "F-2026-0004", state: "Pagada", created: { at: "4 ene 2026, 14:13", … } }
 */
export function summaryOf(
  meta: Meta | null | undefined,
  record: AnyRecord,
  options: { fields?: SummaryFields; locale?: string } = {},
): RecordSummary {
  const { fields = {}, locale } = options;
  const parts = summaryFieldsOf(meta, record, fields);
  const text = (part: SummaryPart): string | null => {
    const name = parts[part];
    return name === undefined ? null : textOf(meta, name, record[name], locale);
  };
  const key = meta?.get_id || meta?.identity || "id";
  const id = String(record[key] ?? record["id"] ?? "");
  const display = meta?.display || undefined;
  const shown =
    display === undefined
      ? (record["display_name"] ?? record["name"])
      : textOf(meta, display, record[display], locale);
  const image = parts.image === undefined ? null : record[parts.image];
  return {
    id,
    name: shown === undefined || shown === null || shown === "" ? id : String(shown),
    description: text("description"),
    state: text("state"),
    type: text("type"),
    image: typeof image === "string" && image !== "" ? image : null,
    person: fields.person ?? false,
    created: { at: text("createdAt"), by: text("createdBy") },
    updated: { at: text("updatedAt"), by: text("updatedBy") },
  };
}
