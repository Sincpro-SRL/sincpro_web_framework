import {
  type AnyRecord,
  choiceLabelOf,
  type FieldMeta,
  labelOf,
  type Meta,
} from "@sincpro/criteria";
import { frameworkCopy } from "@sincpro/web-framework/core/copy";
import { relatedOf } from "@sincpro/web-framework/core/related";

/**
 * How a field is SHOWN, decided once from the model and nowhere else.
 *
 * Context: this is the part of "render from the metadata" that is the same in every
 * piece. A table column, a fact of a record and a search chip all need the word for the field, whether it is a
 * number, whether it orders, and the text a value reads as («Pagada», «12/03/2026», «sí»,
 * «3 elementos»). What they draw it WITH is theirs; what it SAYS is decided here, so they
 * cannot disagree.
 */
export type FieldView = {
  name: string;
  label: string;
  help: string | undefined;
  type: FieldMeta["type"];
  kind: FieldMeta["kind"];
  /** Right-aligned, tabular: integer and number. */
  numeric: boolean;
  /** The server can order by it — never a nullable column. */
  sortable: boolean;
  required: boolean;
  readonly: boolean;
};

/** Present when a field is named that the model does not declare: drawn plain, never thrown. */
const UNKNOWN: FieldMeta = {
  type: "unknown",
  kind: "scalar",
  nullable: true,
  sortable: false,
  ops: [],
};

function fieldOf(meta: Meta | null | undefined, name: string): FieldMeta {
  return meta?.fields[name] ?? UNKNOWN;
}

function helpOf(field: FieldMeta, locale: string | undefined): string | undefined {
  const help = field.help;
  if (help === undefined) return undefined;
  return (locale ? help[locale] : undefined) ?? help["default"];
}

export function viewOf(
  meta: Meta | null | undefined,
  name: string,
  locale?: string,
): FieldView {
  const field = fieldOf(meta, name);
  return {
    name,
    label: labelOf(meta, name, locale),
    help: helpOf(field, locale),
    type: field.type,
    kind: field.kind,
    numeric: field.type === "integer" || field.type === "number",
    sortable: field.sortable,
    required: field.required ?? false,
    readonly: field.readonly ?? false,
  };
}

/**
 * The fields a screen shows when it names none: every scalar the model holds, in the order it
 * declares them. Relations and value objects are left out — they are not a column, they are a
 * page of their own (`RecordLines`) or a section.
 */
export function defaultFields(meta: Meta | null | undefined): string[] {
  if (!meta) return [];
  return Object.entries(meta.fields)
    .filter(([, field]) => field.kind === "scalar")
    .map(([name]) => name);
}

/** The bookkeeping every framework entity carries; shown on demand, never by default. */
export const BOOKKEEPING: ReadonlySet<string> = new Set(["version", "updated_at"]);

/** `"2026-03-12"` as a LOCAL date: `new Date("2026-03-12")` is UTC midnight, the day before
 *  anywhere west of Greenwich. */
function localDate(text: string): Date {
  const [year, month, day] = text.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

function decimals(text: string): number {
  const dot = text.indexOf(".");
  return dot < 0 ? 0 : text.length - dot - 1;
}

/**
 * One formatter per locale and shape, kept. Building an `Intl` formatter costs far more than
 * using one: built per cell, 2 000 rows × 8 fields took ~150 ms — a list that stutters on
 * every page. The set of shapes is tiny (three date/number styles × decimals × locales).
 */
const formatters = new Map<string, Intl.DateTimeFormat | Intl.NumberFormat>();

function dateFormat(locale: string | undefined, withTime: boolean): Intl.DateTimeFormat {
  const key = `d|${locale ?? ""}|${withTime}`;
  let format = formatters.get(key) as Intl.DateTimeFormat | undefined;
  if (format === undefined) {
    format = new Intl.DateTimeFormat(
      locale,
      withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" },
    );
    formatters.set(key, format);
  }
  return format;
}

function numberFormat(
  locale: string | undefined,
  kept: number | undefined,
): Intl.NumberFormat {
  const key = `n|${locale ?? ""}|${kept ?? ""}`;
  let format = formatters.get(key) as Intl.NumberFormat | undefined;
  if (format === undefined) {
    format = new Intl.NumberFormat(
      locale,
      kept === undefined ? {} : { minimumFractionDigits: kept, maximumFractionDigits: kept },
    );
    formatters.set(key, format);
  }
  return format;
}

/** The record a many2one points at, read by the display its definition names. */
function displayOf(field: FieldMeta, value: AnyRecord): string {
  const definition = field.definition;
  const display = definition?.display || undefined;
  const key = display ?? definition?.identity ?? "id";
  const shown = value[key] ?? value["display_name"] ?? value["name"] ?? value["id"];
  return shown === undefined || shown === null ? "" : String(shown);
}

/**
 * The text a value reads as. `null` when there is nothing to read — the caller draws its own
 * «empty» (a dash in a fact, nothing in a cell).
 *
 *     textOf(meta, "state", "paid", "es")            -> "Pagada"     (choice_labels)
 *     textOf(meta, "active", true, "es")              -> "sí"
 *     textOf(meta, "due", "2026-03-12", "es")         -> "12 mar 2026"
 *     textOf(meta, "total", "1150.5", "es")           -> "1150,5"     (exact: digits kept)
 *     textOf(meta, "lines", {items, count: {value: 30}}) -> "30 elementos"
 */
export function textOf(
  meta: Meta | null | undefined,
  name: string,
  value: unknown,
  locale?: string,
): string | null {
  if (value === null || value === undefined || value === "") return null;
  const field = fieldOf(meta, name);
  const copy = frameworkCopy();

  if (field.choices && field.choices.length > 0)
    return choiceLabelOf(meta, name, value, locale);

  switch (field.type) {
    case "boolean":
      return value ? copy.value.yes : copy.value.no;
    case "date":
      return typeof value === "string"
        ? dateFormat(locale, false).format(localDate(value))
        : String(value);
    case "datetime": {
      const date = new Date(String(value));
      return Number.isNaN(date.getTime())
        ? String(value)
        : dateFormat(locale, true).format(date);
    }
    case "integer":
    case "number": {
      const number = Number(value);
      if (Number.isNaN(number)) return String(value);
      const kept = typeof value === "string" ? decimals(value) : undefined;
      return numberFormat(locale, kept).format(number);
    }
    case "text[]":
      return Array.isArray(value)
        ? value.length === 0
          ? null
          : value.join(", ")
        : String(value);
    case "one2many":
    case "many2many": {
      const related = relatedOf(value);
      return copy.value.items(related.count.value, related.count.exact);
    }
    case "many2one":
      return typeof value === "object" ? displayOf(field, value as AnyRecord) : String(value);
    case "embedded":
      return null;
    default:
      return typeof value === "object" ? JSON.stringify(value) : String(value);
  }
}

/**
 * The value a column orders and groups on: the raw scalar, never the text. ISO dates order
 * as text; a decimal that travels as text orders as a number.
 */
export function sortKeyOf(
  meta: Meta | null | undefined,
  name: string,
  value: unknown,
): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  const field = fieldOf(meta, name);
  if (field.type === "number" || field.type === "integer") {
    const number = Number(value);
    return Number.isNaN(number) ? null : number;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    return value;
  if (field.type === "one2many" || field.type === "many2many")
    return relatedOf(value).count.value;
  return textOf(meta, name, value);
}
