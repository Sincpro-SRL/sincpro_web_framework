import type { FieldMeta, Meta } from "@sincpro/criteria";
import type { Entity } from "@sincpro/web-framework/core/entity";

/**
 * Which record a field of a form is about, read from the model — so a form draws a many2one
 * as a picker of the right entity without being told.
 *
 * Context: sincpro_framework publishes a many2one twice: the RELATION (`customer`, expanded as
 * the record it points at, read-only) and its scalar KEY (`customer_id`, what is written),
 * joined by `identified_by`. A form may name either; both mean «the customer». A relation
 * names the other side by its AGGREGATE («Cliente»), which says nothing about where it is read
 * — that is the entity the application declared (`entityFor`).
 */
export type RelationField = {
  /** The relation field: `customer`. */
  relation: string;
  /** The scalar written for it: `customer_id` (the relation itself when it has none). */
  key: string;
  /** The aggregate on the other side: `"Cliente"`. */
  target: string;
  many: boolean;
  field: FieldMeta;
};

export function relationFieldOf(
  meta: Meta | null | undefined,
  name: string,
): RelationField | undefined {
  if (!meta) return undefined;
  const of = (relation: string, field: FieldMeta): RelationField | undefined =>
    field.kind !== "relation" || !field.relation
      ? undefined
      : {
          relation,
          key: field.identified_by || relation,
          target: field.relation,
          many: field.many === true,
          field,
        };
  const own = meta.fields[name];
  if (own?.kind === "relation") return of(name, own);
  // A scalar that a relation is identified by: `customer_id` IS the customer.
  for (const [relation, field] of Object.entries(meta.fields))
    if (field.kind === "relation" && field.identified_by === name) return of(relation, field);
  return undefined;
}

/**
 * The declared entity a relation points at: the one that says it is that aggregate, else the
 * one whose model definition is, else the one whose key it is (`"ventas:cliente"`).
 */
export function entityFor(
  entities: readonly Entity[],
  target: string,
  metaOf: (key: string) => Meta | undefined = () => undefined,
): Entity | undefined {
  return (
    entities.find((one) => one.aggregate === target) ??
    entities.find((one) => metaOf(one.key)?.aggregate === target) ??
    entities.find((one) => one.key === target)
  );
}
