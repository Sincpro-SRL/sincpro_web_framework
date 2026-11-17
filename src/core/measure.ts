import { labelOf, type Measure, measure, type Meta } from "@sincpro/criteria";
import { BOOKKEEPING, fieldMetaOf, textOf } from "@sincpro/web-framework/core/present";

/**
 * How the model adds a field up (`Presentation.totals` on the server, `"total": "sum"` in the
 * Meta), as one of the functions a screen draws; none when it says nothing, or names one this
 * package does not draw.
 */
export type Total = "sum" | "avg" | "min" | "max";

const TOTALS: ReadonlySet<string> = new Set(["sum", "avg", "min", "max"]);

export function totalOf(meta: Meta | null | undefined, name: string): Total | undefined {
  const total = fieldMetaOf(meta, name)?.total;
  if (typeof total !== "string") return undefined;
  // `mean` is the same function by web-ui's name.
  const said = total === "mean" ? "avg" : total;
  return TOTALS.has(said) ? (said as Total) : undefined;
}

/**
 * What a group ADDS UP TO — «Total 1.204.933,00» beside «Pagadas · 187» — summed by the server
 * over every row of the group, never the page.
 *
 * Context: a count says how many; whoever groups invoices by state wants to know how much. Which
 * fields add up is the domain's: the model says it with `total` (sincpro_framework's
 * `Presentation.totals`), and those are the default. A model that says nothing falls back to
 * the figure a record computes: an exact number that is read-only (a total, a subtotal, a
 * balance). What a person types — a discount, a percentage, a limit — is not added up: a sum of
 * percentages means nothing. A screen names its own (`EntityList sums`).
 */
export function sumsOf(meta: Meta | null | undefined): string[] {
  if (!meta) return [];
  const totalled = Object.keys(meta.fields).filter(
    (name) => totalOf(meta, name) !== undefined,
  );
  if (totalled.length > 0) return totalled;
  return Object.entries(meta.fields)
    .filter(
      ([name, field]) =>
        !BOOKKEEPING.has(name) &&
        (field.type === "number" || field.type === "integer") &&
        field.exact === true &&
        field.readonly === true,
    )
    .map(([name]) => name);
}

/** The grouping's measures for these fields, each under its own name — by the function the
 *  model adds it up with (`total`), a sum when it names none. */
export function measuresOf(
  fields: readonly string[],
  meta?: Meta | null,
): Record<string, Measure> {
  return Object.fromEntries(
    fields.map((field) => {
      switch (totalOf(meta, field)) {
        case "avg":
          return [field, measure.avg(field)];
        case "min":
          return [field, measure.min(field)];
        case "max":
          return [field, measure.max(field)];
        default:
          return [field, measure.sum(field)];
      }
    }),
  );
}

/** What a group's measures read as: «Total 1.204.933,00 · Saldo 12,50». */
export function detailOf(
  meta: Meta | null | undefined,
  measures: Readonly<Record<string, unknown>> | undefined,
  locale?: string,
): string | undefined {
  if (measures === undefined) return undefined;
  const parts = Object.entries(measures)
    .map(([field, value]) => {
      const text = textOf(meta, field, value, locale);
      return text === null ? null : `${labelOf(meta, field, locale)} ${text}`;
    })
    .filter((part): part is string => part !== null);
  return parts.length === 0 ? undefined : parts.join(" · ");
}
