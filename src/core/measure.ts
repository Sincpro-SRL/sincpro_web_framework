import { labelOf, type Measure, measure, type Meta } from "@sincpro/criteria";
import { BOOKKEEPING, textOf } from "@sincpro/web-framework/core/present";

/**
 * What a group ADDS UP TO — «Total 1.204.933,00» beside «Pagadas · 187» — summed by the server
 * over every row of the group, never the page.
 *
 * Context: a count says how many; whoever groups invoices by state wants to know how much. Which
 * fields add up is the domain's, and the model does not say it yet, so the default is the
 * figure a record computes: an exact number that is read-only (a total, a subtotal, a balance).
 * What a person types — a discount, a percentage, a limit — is not added up: a sum of
 * percentages means nothing. A screen names its own (`EntityList sums`).
 */
export function sumsOf(meta: Meta | null | undefined): string[] {
  if (!meta) return [];
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

/** The grouping's measures for these fields, each under its own name. */
export function measuresOf(fields: readonly string[]): Record<string, Measure> {
  return Object.fromEntries(fields.map((field) => [field, measure.sum(field)]));
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
