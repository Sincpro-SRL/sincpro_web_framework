import { Money, timeZoneNow } from "@sincpro/client-framework";
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

/**
 * Where a name lives: a field of the model, or — written `recibo.numero` — a field of the
 * definition of a value the record embeds. The model the field is described by, and its own
 * name there.
 *
 * Context: the Meta publishes an embedded value with its fields, their labels and types (a
 * payment's receipt: number, issued, concept, amount); an application wrote each of them by
 * hand because nothing here could name one. A path is the same name a screen writes in a form.
 */
export function fieldAt(
  meta: Meta | null | undefined,
  name: string,
): { meta: Meta | null | undefined; name: string } {
  const dot = name.indexOf(".");
  if (dot < 0 || meta?.fields[name] !== undefined) return { meta, name };
  const head = meta?.fields[name.slice(0, dot)];
  if (head?.kind !== "embedded" || head.many === true || !head.definition)
    return { meta, name };
  return fieldAt(head.definition, name.slice(dot + 1));
}

/** The value a name holds in a record: a field, or a field of an embedded value
 *  (`recibo.numero`). */
export function valueAt(
  meta: Meta | null | undefined,
  record: Readonly<Record<string, unknown>> | null | undefined,
  name: string,
): unknown {
  if (record === null || record === undefined) return undefined;
  const dot = name.indexOf(".");
  if (dot < 0 || meta?.fields[name] !== undefined || Object.hasOwn(record, name))
    return record[name];
  const head = name.slice(0, dot);
  const inner = record[head];
  return typeof inner === "object" && inner !== null
    ? valueAt(
        meta?.fields[head]?.definition,
        inner as Record<string, unknown>,
        name.slice(dot + 1),
      )
    : undefined;
}

/** What the model says of a name — a field, or a field of an embedded value — if it says it. */
export function fieldMetaOf(
  meta: Meta | null | undefined,
  name: string,
): FieldMeta | undefined {
  const place = fieldAt(meta, name);
  return place.meta?.fields[place.name];
}

function fieldOf(meta: Meta | null | undefined, name: string): FieldMeta {
  return fieldMetaOf(meta, name) ?? UNKNOWN;
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
  const place = fieldAt(meta, name);
  return {
    name,
    label: labelOf(place.meta, place.name, locale),
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

/**
 * What the framework writes on every record of its own: when and by whom it was made and last
 * changed, its version, when it went to the trash. A record's audit and its activity say these;
 * a form, a list inside a record and a record's facts never repeat them.
 */
export const STAMPS: ReadonlySet<string> = new Set([
  "version",
  "created_at",
  "created_by",
  "updated_at",
  "updated_by",
  "archived_at",
]);

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

/**
 * How a date is written: `numeric` — «16/11/2026», «16/11/2026 15:36» — or `literal`, its month
 * in words — «16 nov 2026, 15:36» —, where space asks for a word (a phone).
 *
 * Context: Sincpro's standard is numeric, day first, whatever the language: a back office reads
 * columns of dates, and «16 nov» and «6 nov» do not line up. The month in words was the only
 * style, chosen by `Intl` for the locale. An application installs its style once
 * (`FrameworkProvider dateStyle`), as it installs its zone, and every cell, field, fact and
 * `useTextOf` writes it.
 */
export type DateStyle = "numeric" | "literal";

let dateStyle: DateStyle = "numeric";

/** Install how dates are written; `undefined` puts the default back (numeric). */
export function installDateStyle(style: DateStyle | undefined): void {
  dateStyle = style ?? "numeric";
}

/** The style dates are written in now. */
export const dateStyleNow = (): DateStyle => dateStyle;

function dateFormat(locale: string | undefined, withTime: boolean): Intl.DateTimeFormat {
  // An instant reads on the wall clock of the installed zone; a calendar day has no zone.
  const zone = withTime ? timeZoneNow() : "";
  const numeric = dateStyle === "numeric";
  // Numeric is the same everywhere — day, month, year — so its locale does not matter: only
  // its parts are read (`numericDate`), in Latin digits.
  const key = `d|${numeric ? "" : (locale ?? "")}|${withTime}|${zone}|${dateStyle}`;
  let format = formatters.get(key) as Intl.DateTimeFormat | undefined;
  if (format === undefined) {
    format = numeric
      ? new Intl.DateTimeFormat("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          numberingSystem: "latn",
          ...(withTime
            ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: zone }
            : {}),
        })
      : new Intl.DateTimeFormat(
          locale,
          withTime
            ? { dateStyle: "medium", timeStyle: "short", timeZone: zone }
            : { dateStyle: "medium" },
        );
    formatters.set(key, format);
  }
  return format;
}

/** «DD/MM/YYYY», and « HH:mm» after it for an instant — assembled from the parts, so no
 *  locale reorders them (`en-US` would write the month first). */
function numericDate(date: Date, withTime: boolean): string {
  const parts = dateFormat(undefined, withTime).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((one) => one.type === type)?.value ?? "";
  const day = `${part("day")}/${part("month")}/${part("year")}`;
  return withTime ? `${day} ${part("hour")}:${part("minute")}` : day;
}

function dateText(date: Date, locale: string | undefined, withTime: boolean): string {
  return dateStyle === "numeric"
    ? numericDate(date, withTime)
    : dateFormat(locale, withTime).format(date);
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

/** The currency codes `Intl` refused, by locale: asked once, not on every cell. */
const unknownCurrencies = new Set<string>();

function currencyFormat(
  locale: string | undefined,
  currency: string,
): Intl.NumberFormat | null {
  const key = `c|${locale ?? ""}|${currency}`;
  if (unknownCurrencies.has(key)) return null;
  let format = formatters.get(key) as Intl.NumberFormat | undefined;
  if (format === undefined) {
    try {
      format = new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        minimumFractionDigits: Money.decimalsOf(currency),
        maximumFractionDigits: Money.decimalsOf(currency),
      });
    } catch {
      // Not an ISO 4217 code Intl knows (a token, a loyalty point): drawn as «amount CODE».
      unknownCurrencies.add(key);
      return null;
    }
    formatters.set(key, format);
  }
  return format;
}

/**
 * A money as a person reads it: `{ amount: "1150.5", currency: "BOB" }` → «Bs 1.150,50». The
 * amount goes to `Intl` as text, so no digit passes through a float, rounded to the currency's
 * decimals as an invoice shows it (`Money.rounded`).
 */
function moneyText(
  value: { amount: string | number; currency: string },
  locale?: string,
): string | null {
  let money: Money;
  try {
    money = Money.fromJSON(value).rounded();
  } catch {
    // A money of the right shape with an amount or a code that is not one (`"1,50"`, `""`): no
    // text, as any value object — never an error that takes the whole view down.
    return null;
  }
  const amount = money.amount as Intl.StringNumericLiteral;
  return (
    currencyFormat(locale, money.currency)?.format(amount) ??
    `${numberFormat(locale, money.decimals).format(amount)} ${money.currency}`
  );
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
 * What a value reads as when a screen holds it outside any model — a total it added up, a
 * due date of its own: the same text `textOf` gives a field of that type, in `locale`, on the
 * zone the application installed. `null` when there is nothing to read. `useTextOf()` binds them
 * to the provider's locale.
 *
 *     numberTextOf("1150.5", "es-BO")                              -> "1.150,5"
 *     dayTextOf("2026-03-12", "es")                                -> "12/03/2026"
 *     instantTextOf("2026-03-12T14:00:00Z", "es")                  -> "12/03/2026 10:00" (La Paz)
 *     moneyTextOf({ amount: "1150.5", currency: "BOB" }, "es-BO")  -> "Bs 1.150,50"
 *
 * Context: every application wrote its own money and date formatting for its own screens, on
 * the browser's zone and its own locale, while the framework had the right one private.
 */
export function numberTextOf(value: unknown, locale?: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (Number.isNaN(Number(value))) return String(value);
  // A decimal that travels as text goes to `Intl` as text: every digit kept, none through a
  // float (`"12345678901234567.89"` reads whole).
  if (typeof value === "string")
    return numberFormat(locale, decimals(value)).format(
      value.trim() as Intl.StringNumericLiteral,
    );
  return numberFormat(locale, undefined).format(Number(value));
}

/** A day (`"2026-03-12"`) as a person reads it. A day has no zone: it is never converted. */
export function dayTextOf(value: unknown, locale?: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return String(value);
  const day = localDate(value.slice(0, 10));
  return Number.isNaN(day.getTime()) ? value : dateText(day, locale, false);
}

/** An instant as a person reads it, on the wall clock of the zone the application installed. */
export function instantTextOf(value: unknown, locale?: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : dateText(date, locale, true);
}

/** A money (`{ amount, currency }`) as a person reads it, rounded to its currency's decimals;
 *  `null` when the value is not one. */
export function moneyTextOf(value: unknown, locale?: string): string | null {
  return Money.isMoney(value) ? moneyText(value, locale) : null;
}

/**
 * The currency an amount is in when it carries none — a decimal the model draws as money
 * (`widget: "money"`, «Monto (Bs.)»): the business's, installed once with the zone
 * (`FrameworkProvider currency`). Without one, such an amount is rounded to two decimals and
 * written with no symbol.
 */
let currency: string | undefined;

/** Install the business's currency (`"BOB"`); `undefined` forgets it. */
export function installCurrency(code: string | undefined): void {
  currency = code;
}

/** The business's currency now, if one was installed. */
export const currencyNow = (): string | undefined => currency;

/** A bare amount drawn as money: in the business's currency, or rounded to cents. */
function amountText(value: unknown, locale: string | undefined): string | null {
  const amount = typeof value === "number" ? String(value) : value;
  if (typeof amount !== "string" || Number.isNaN(Number(amount))) return null;
  if (currency !== undefined) return moneyText({ amount, currency }, locale);
  return numberFormat(locale, 2).format(Number(amount));
}

/** A definition of exactly an amount and a currency: a money, whatever the entity calls it. */
export function isMoneyDefinition(definition: Meta | null | undefined): boolean {
  const parts = Object.keys(definition?.fields ?? {});
  return parts.length === 2 && parts.includes("amount") && parts.includes("currency");
}

/**
 * A value object read through its definition: «N.º de recibo: 0042 · Concepto: Cuota» — each
 * field by its label, in the order the definition declares them, the empty ones left out. A
 * money stays a money; a list of values reads as how many there are.
 */
function embeddedText(
  field: FieldMeta,
  value: unknown,
  locale: string | undefined,
): string | null {
  const definition = field.definition;
  // A money — by its value, or by a definition of an amount and a currency — is one, or nothing:
  // an amount that is not one never reads as «amount: 1,50 · currency: BOB».
  if (Money.isMoney(value) || isMoneyDefinition(definition))
    return moneyTextOf(value, locale);
  if (Array.isArray(value))
    return value.length === 0 ? null : frameworkCopy().value.items(value.length, true);
  if (!definition || typeof value !== "object" || value === null) return null;
  const parts = Object.keys(definition.fields)
    .map((name) => {
      const text = textOf(definition, name, (value as AnyRecord)[name], locale);
      return text === null ? null : `${labelOf(definition, name, locale)}: ${text}`;
    })
    .filter((part): part is string => part !== null);
  return parts.length === 0 ? null : parts.join(" · ");
}

/**
 * The text a value reads as. `null` when there is nothing to read — the caller draws its own
 * «empty» (a dash in a fact, nothing in a cell).
 *
 *     textOf(meta, "state", "paid", "es")            -> "Pagada"     (choice_labels)
 *     textOf(meta, "active", true, "es")              -> "sí"
 *     textOf(meta, "due", "2026-03-12", "es")         -> "12/03/2026" («12 mar 2026» literal)
 *     textOf(meta, "total", "1150.5", "es")           -> "1150,5"     (exact: digits kept)
 *     textOf(meta, "price", { amount: "19.9", currency: "BOB" }, "es") -> "19,90 Bs"
 *     textOf(meta, "monto", "25", "es")               -> "Bs 25,00"  (widget money, BOB installed)
 *     textOf(meta, "recibo", {numero: "0042", …})     -> "N.º de recibo: 0042 · …"
 *     textOf(meta, "recibo.numero", "0042")           -> "0042"
 *     textOf(meta, "lines", {items, count: {value: 30}}) -> "30 elementos"
 */
export function textOf(
  meta: Meta | null | undefined,
  name: string,
  value: unknown,
  locale?: string,
): string | null {
  if (value === null || value === undefined || value === "") return null;
  const place = fieldAt(meta, name);
  if (place.meta !== meta) return textOf(place.meta, place.name, value, locale);
  const field = fieldOf(meta, name);
  const copy = frameworkCopy();

  if (field.choices && field.choices.length > 0)
    return choiceLabelOf(meta, name, value, locale);

  // An amount the model draws as money is money, though it travels bare.
  if (field.widget === "money" && field.kind === "scalar") {
    const amount = amountText(value, locale);
    if (amount !== null) return amount;
  }

  switch (field.type) {
    case "boolean":
      return value ? copy.value.yes : copy.value.no;
    case "date":
      return dayTextOf(value, locale);
    case "datetime":
      return instantTextOf(value, locale);
    case "integer":
    case "number":
      return numberTextOf(value, locale);
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
      // A value object reads through its definition; a money, the one every ERP holds, as one.
      return embeddedText(field, value, locale);
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
