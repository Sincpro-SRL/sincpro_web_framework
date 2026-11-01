import type { Meta } from "@sincpro/criteria";
import { BOOKKEEPING } from "@sincpro/web-framework/core/present";
import { type SummaryFields, summaryFieldsOf } from "@sincpro/web-framework/core/summary";

/**
 * What a record's form shows when the screen names nothing: its fields, and the pages beside
 * them — read from the model, in the order it declares.
 *
 * Context: the default form must be useful on any entity, not a dump of every key. So:
 *
 * - the bookkeeping (`version`, `updated_at`) and who made and changed it are not fields: the
 *   paper says them on its last line (`Record.Audit`); the picture is not a text box;
 * - a read-only identity is the record's name, not a field to look at;
 * - a many2one is written by its KEY (`customer_id`, a picker of customers): the expanded
 *   relation beside it (`customer`) would be the same thing twice;
 * - a one2many is a page of its own — a list, not a field;
 * - a value object, and a many2many the backend cannot write yet, are left to the screen.
 */
export type FormLayout = { fields: string[]; pages: string[] };

export function formOf(
  meta: Meta | null | undefined,
  summary: SummaryFields = {},
): FormLayout {
  if (!meta) return { fields: [], pages: [] };
  const parts = summaryFieldsOf(meta, {}, summary);
  const told = new Set(
    [parts.createdAt, parts.createdBy, parts.updatedAt, parts.updatedBy, parts.image].filter(
      (name): name is string => name !== undefined,
    ),
  );
  const keys = new Set(
    Object.values(meta.fields)
      .map((field) => (field.kind === "relation" ? field.identified_by : undefined))
      .filter((name): name is string => typeof name === "string" && name in meta.fields),
  );
  const fields: string[] = [];
  const pages: string[] = [];
  for (const [name, field] of Object.entries(meta.fields)) {
    if (BOOKKEEPING.has(name) || told.has(name)) continue;
    if (name === meta.identity && field.readonly) continue;
    if (field.kind === "embedded") continue;
    if (field.kind === "relation") {
      if (field.type === "one2many") pages.push(name);
      else if (!field.many && !(field.identified_by && keys.has(field.identified_by)))
        fields.push(name);
      continue;
    }
    fields.push(name);
  }
  return { fields, pages };
}
