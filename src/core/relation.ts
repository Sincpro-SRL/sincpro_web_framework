import { type Entity, entityKeyOf, kindOf, relatedCriteria } from "@sincpro/client-framework";
import type { AnyRecord, Criteria, FieldMeta, Meta } from "@sincpro/criteria";

/**
 * Which record a field of a form is about, read from the model — so a form draws a many2one
 * as a picker of the right entity without being told.
 *
 * Context: sincpro_framework publishes a many2one twice: the RELATION (`customer`, expanded as
 * the record it points at, read-only) and its scalar KEY (`customer_id`, what is written),
 * joined by `identified_by`. A form may name either; both mean «the customer». A relation
 * names the other side by its AGGREGATE («Cliente»), which says nothing about where it is read
 * — that is the entity the application declared (`entityFor`).
 *
 * A key may also stand alone: `tenant_id: EntityID[Tenant]` on the server is a scalar that says
 * whose record it names (`relation: "auth.Tenant"`) with no relation field beside it. It is a
 * many2one all the same — chosen with the picker of that entity — but only its key is in hand
 * (`held: false`): nothing else is written beside it, and its name is asked for by key.
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
  /** The record it points at comes with the record (a relation field the server expands), or
   *  only its key does (`EntityID[Tenant]`): then `relation` IS the key. */
  held: boolean;
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
          held: true,
        };
  const own = meta.fields[name];
  if (own?.kind === "relation") return of(name, own);
  // A scalar that a relation is identified by: `customer_id` IS the customer.
  for (const [relation, field] of Object.entries(meta.fields))
    if (field.kind === "relation" && field.identified_by === name) return of(relation, field);
  // A key alone that says whose record it names: the record is not in hand, its key is.
  if (own !== undefined && own.kind !== "embedded" && own.relation)
    return {
      relation: name,
      key: name,
      target: own.relation,
      many: own.many === true,
      field: own,
      held: false,
    };
  return undefined;
}

/**
 * Whether `target` names `one` the way a key does — by its model, `auth.Tenant` in another
 * context or `Tenant` in its own —: the name a generated entity's key is made of (`entityKeyOf`).
 */
function namedBy(one: Entity, target: string): boolean {
  const dot = target.lastIndexOf(".");
  if (dot === -1) return one.key === entityKeyOf(one.domain, target);
  return one.key === entityKeyOf(target.slice(0, dot), target.slice(dot + 1));
}

/**
 * The declared entity a relation points at: the one that says it is that aggregate, else the
 * one whose model definition is, else the one whose key it is (`"ventas:cliente"`), else the one
 * its model names (`"auth.Tenant"` → `auth:tenant`), else the only one of that kind — a context
 * named by its own name (`sincpro-forge-auth.Tenant`) where the application keys it by alias.
 */
export function entityFor(
  entities: readonly Entity[],
  target: string,
  metaOf: (key: string) => Meta | undefined = () => undefined,
): Entity | undefined {
  const model = target.slice(target.lastIndexOf(".") + 1);
  const ofKind = entities.filter((one) => one.kind === kindOf(model));
  return (
    entities.find((one) => one.aggregate === target) ??
    entities.find((one) => metaOf(one.key)?.aggregate === target) ??
    entities.find((one) => one.key === target) ??
    entities.find((one) => namedBy(one, target)) ??
    (ofKind.length === 1 ? ofKind[0] : undefined)
  );
}

/**
 * The field of the related records that points back at a record, and the value it holds for this
 * one — what a list of them hides as a column and fills on a new one. `null` when the relation
 * does not say. It reads the keys as @sincpro/client-framework's `relatedCriteria` asks by them.
 */
export function backReference(
  record: AnyRecord | null,
  field: FieldMeta | undefined,
  identity: string,
): { field: string; value: unknown } | null {
  const there = field?.related_field ?? field?.identified_by;
  if (record === null || !there) return null;
  const here = field?.related_field ? (field.parent_field ?? identity) : identity;
  return { field: there, value: record[here] };
}

/** Whether a value can point a relation at a record: an empty key points at the orphans. */
export function isKeyValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== "";
}

/**
 * The criteria a relation of ONE record is listed with, over the related entity — or `null` while
 * there is no key to ask by: the record or its definition has not arrived, or the record holds no
 * value in that key yet (a new one, a business key not written). Never a question that would
 * match every orphan.
 *
 *     relatedScope(customer, meta.fields.invoices, "id", criteria)
 *       ->  criteria AND customer_id = customer.id          (identified_by)
 *       ->  criteria AND customer_code = customer.code      (parent_field / related_field)
 */
export function relatedScope<T extends AnyRecord>(
  record: AnyRecord | null,
  field: FieldMeta | undefined,
  identity: string,
  criteria?: Criteria<T>,
): Criteria<T> | null {
  const back = backReference(record, field, identity);
  if (record === null || field === undefined || back === null || !isKeyValue(back.value))
    return null;
  return relatedCriteria<T>(field, record, identity, criteria);
}
