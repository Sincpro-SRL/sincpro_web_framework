import { choiceLabelOf, isRelational, labelOf, type Meta } from "@sincpro/criteria";
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
 * An enum carries the word of each value (`translations.choices`, web-ui 2.7): the bar offers
 * «Estado: Pagada» for «pagada» typed and sends `paid` — before, it offered the raw value where
 * a cell said «Pagada». A to-many relation carries the key of the records on the other side
 * (`relationKey`, from the related definition): what the bar's records are compared by through
 * it once chosen.
 *
 * `texts` keeps only those plain text fields: web-ui's bar offers a typed word in EVERY text
 * field of the model it is handed (its `facets` are read only without one), so the bar is handed
 * the model with the text fields a person types into (`facetsOf`) — and the criteria builder the
 * whole one.
 */
/** The comparisons of a text a person types: never asked of a key. */
const TYPED_TEXT: ReadonlySet<string> = new Set(["like", "starts with"]);

export function modelOf(
  meta: Meta,
  locale?: string,
  texts?: readonly string[],
): ModelDefinition {
  // The column a to-one relation is identified by — sincpro_framework's `identified_by`, its
  // foreign key — stays: web-ui compares a chosen record by it and never offers it on its own.
  // It holds a KEY, so it is handed without the comparisons of a text a person types («like»,
  // «starts with»): with them web-ui read it as a column that names the record, and «globex» on
  // «Cliente» became «customer_id contains globex» instead of unfolding the customers.
  const identifying = new Set(
    Object.values(meta.fields)
      .filter((field) => isRelational(field) && field.many !== true)
      .map((field) => field.identified_by)
      .filter((name): name is string => typeof name === "string" && name !== ""),
  );
  const kept = (name: string) => {
    const field = meta.fields[name];
    const text = field?.type === "text" && !field.choices?.length;
    return texts === undefined || !text || texts.includes(name) || identifying.has(name);
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
            ops: identifying.has(name)
              ? field.ops.filter((op) => !TYPED_TEXT.has(op))
              : field.ops,
            kind: field.kind,
            ...(field.many === undefined ? {} : { many: field.many }),
            ...(field.relation === undefined ? {} : { relation: field.relation }),
            ...(field.identified_by === undefined
              ? {}
              : { identifiedBy: field.identified_by }),
            ...(field.choices && field.choices.length > 0 ? { choices: field.choices } : {}),
            ...(field.many === true && field.definition
              ? { relationKey: field.definition.get_id || field.definition.identity }
              : {}),
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
      choices: Object.fromEntries(
        names
          .filter((name) => (meta.fields[name]?.choices?.length ?? 0) > 0)
          .map((name) => [
            name,
            Object.fromEntries(
              (meta.fields[name]?.choices ?? []).map((value) => [
                String(value),
                { default: choiceLabelOf(meta, name, value, locale) },
              ]),
            ),
          ]),
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
