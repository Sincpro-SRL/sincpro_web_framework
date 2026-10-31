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
 */
export function modelOf(meta: Meta, locale?: string): ModelDefinition {
  const names = Object.keys(meta.fields);
  return {
    aggregate: meta.aggregate,
    identity: meta.identity,
    fields: Object.fromEntries(
      Object.entries(meta.fields).map(([name, field]) => [
        name,
        {
          type: field.type,
          nullable: field.nullable,
          sortable: field.sortable,
          ops: field.ops,
          kind: field.kind,
          ...(field.many === undefined ? {} : { many: field.many }),
          ...(field.relation === undefined ? {} : { relation: field.relation }),
          ...(field.identified_by === undefined ? {} : { identifiedBy: field.identified_by }),
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
  walk(meta.search?.["where"]);
  return found;
}

/**
 * Where a typed text can be looked for: the fields the entity's own search template names
 * first (what «search by name» means for THIS entity), then every other text field it can
 * filter on.
 */
export function facetsOf(meta: Meta, locale?: string): SearchFacet[] {
  const first = searchedFields(meta);
  const texts = Object.entries(meta.fields)
    .filter(
      ([, field]) =>
        field.type === "text" && field.ops.includes("like") && !field.choices?.length,
    )
    .map(([name]) => name);
  const order = [...new Set([...first, ...texts])];
  return order.map((name) => ({ id: name, label: labelOf(meta, name, locale) }));
}
