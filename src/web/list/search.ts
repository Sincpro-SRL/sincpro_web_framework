import { labelOf, type Meta } from "@sincpro/criteria";
import type { ModelDefinition, SearchFacet } from "@sincpro/web-ui";

/**
 * The model, as web-ui's search bar and criteria builder read it.
 *
 * Context: web-ui keeps its OWN vocabulary of a model (`ModelDefinition`), written before the
 * framework settled its wire, and the two drifted: `identifiedBy` against `identified_by`, one
 * `translations` object against a `label` on each field. web-ui is right to own it — it is a
 * design system and must not depend on one backend — so the translation lives here, the one
 * place that knows both.
 *
 * Known gap: web-ui's field has `choices` but no word for each choice, so the bar offers an
 * enum's raw values («paid») where a cell says «Pagada». Fixing it is web-ui's.
 *
 * `texts` keeps only those plain text fields: web-ui's bar offers a typed word in EVERY text
 * field of the model it is handed (its `facets` are read only without one), so the bar is handed
 * the model with the text fields a person types into (`facetsOf`) — and the criteria builder the
 * whole one.
 */
export function modelOf(
  meta: Meta,
  locale?: string,
  texts?: readonly string[],
): ModelDefinition {
  const kept = (name: string) => {
    const field = meta.fields[name];
    const text = field?.type === "text" && !field.choices?.length;
    return texts === undefined || !text || texts.includes(name);
  };
  const names = Object.keys(meta.fields).filter(kept);
  return {
    aggregate: meta.aggregate,
    identity: meta.identity,
    fields: Object.fromEntries(
      Object.entries(meta.fields)
        .filter(([name]) => kept(name))
        .map(([name, field]) => [
          name,
          {
            type: field.type,
            nullable: field.nullable,
            sortable: field.sortable,
            ops: field.ops,
            kind: field.kind,
            ...(field.many === undefined ? {} : { many: field.many }),
            ...(field.relation === undefined ? {} : { relation: field.relation }),
            ...(field.identified_by === undefined
              ? {}
              : { identifiedBy: field.identified_by }),
            ...(field.choices && field.choices.length > 0 ? { choices: field.choices } : {}),
          },
        ]),
    ),
    translations: {
      name: {
        default: meta.name?.[locale ?? ""] ?? meta.name?.["default"] ?? meta.aggregate,
      },
      labels: Object.fromEntries(
        names.map((name) => [name, { default: labelOf(meta, name, locale) }]),
      ),
    },
  };
}

/** The fields its search template looks in, as named in `meta.search`. */
function searchedFields(meta: Meta): string[] {
  const found: string[] = [];
  const walk = (node: unknown) => {
    if (typeof node !== "object" || node === null) return;
    const record = node as Record<string, unknown>;
    if (typeof record["field"] === "string") found.push(record["field"]);
    for (const value of Object.values(record)) {
      if (Array.isArray(value)) value.forEach(walk);
      else walk(value);
    }
  };
  walk(meta.search?.["selection"]);
  return found;
}

/**
 * Where a typed text can be looked for: the fields the screen names (`defineList facets`), else
 * the ones the entity's search template names — what a typed text already means for it —, else
 * its display field.
 *
 * Context: it used to append every text field that takes `like`, and «Excel» in a list of
 * enrollments offered sixteen places to look, «ID» and a storage key among them. Which fields a
 * person types into is the screen's decision; every other field is still in the criteria builder.
 */
export function facetsOf(
  meta: Meta,
  locale?: string,
  named?: readonly string[],
): SearchFacet[] {
  const searched = [...new Set(searchedFields(meta))];
  const fields =
    named ?? (searched.length > 0 ? searched : meta.display ? [meta.display] : []);
  return fields.map((name) => ({ id: name, label: labelOf(meta, name, locale) }));
}
