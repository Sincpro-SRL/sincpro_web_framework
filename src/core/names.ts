import {
  type Change,
  type Entity,
  listRoute,
  type MetaStore,
  type Transport,
} from "@sincpro/client-framework";
import type { AnyRecord, Criteria } from "@sincpro/criteria";
import { touches } from "@sincpro/web-framework/core/changes";
import { lookupOf } from "@sincpro/web-framework/core/lookup";

/**
 * The names of records by their keys — what a cell, a fact or a chip that holds only a key shows
 * — asked in ONE request per entity, however many of them ask at once.
 *
 * Context: a page of 50 rows naming 50 tenants asked 50 requests, one per cell, so screens showed
 * the key instead of the name (ROADMAP: «asking for a name per row does not scale»). Here every
 * key asked in the same tick waits together, and one page answers them all — the entity's own
 * list, narrowed to those keys (`in`), in slices of `SLICE` so no page is asked without a
 * ceiling. A name is kept for the book's life, shared by every place that shows it, and forgotten
 * when a write touches its entity (`changed`: a rename). Unnamed is no error — the place shows the
 * key —; a request that fails is not kept, so the next place asks again. An entity listed only
 * under another record (`/tenants/{tenant_id}/members`) has no list to ask by key: it stays
 * unnamed.
 *
 *     const names = nameBook(transport, metas, entities);
 *     await names.nameOf(tenants, "acme")   ->  "ACME S.R.L."
 */
export type NameBook = {
  /** The name of record `id` of `entity`; `undefined` when it has none to read or it failed. */
  nameOf(entity: Entity, id: string): Promise<string | undefined>;
  /** A write landed: forget the names it may have changed. */
  changed(change: Change): void;
};

/** The most keys one request asks for. */
const SLICE = 100;

type Waiting = Map<string, (name: string | undefined) => void>;

/** The route an entity is listed at, or `undefined` when it is listed only under a record. */
function routeOf(entity: Entity): string | undefined {
  try {
    return listRoute(entity.list);
  } catch {
    return undefined;
  }
}

export function nameBook(
  transport: Transport,
  metas: MetaStore,
  entities: readonly Entity[] = [],
): NameBook {
  /** By entity key: where it is listed, and by record key the name, asked or answered. */
  const known = new Map<
    string,
    { route: string; names: Map<string, Promise<string | undefined>> }
  >();
  /** By entity key: the keys waiting for the next request, and how to answer each. */
  const asking = new Map<string, { entity: Entity; route: string; waiting: Waiting }>();

  async function ask(entityKey: string): Promise<void> {
    const batch = asking.get(entityKey);
    if (batch === undefined) return;
    asking.delete(entityKey);
    const { entity, route, waiting } = batch;
    const meta = metas.get(entity.key);
    const field = meta?.get_id || meta?.identity || "id";
    const keys = [...waiting.keys()];
    for (let at = 0; at < keys.length; at += SLICE) {
      const slice = keys.slice(at, at + SLICE);
      const criteria: Criteria = {
        selection: { field, operator: "in", value: slice },
        pagination: { limit: slice.length },
      };
      try {
        const page = await transport.list<AnyRecord>(route, criteria);
        const named = new Map(
          lookupOf(page.meta ?? meta ?? null, page.rows, entity.summary).map((one) => [
            one.id,
            one.label,
          ]),
        );
        for (const id of slice) waiting.get(id)?.(named.get(id));
      } catch {
        for (const id of slice) {
          known.get(entityKey)?.names.delete(id);
          waiting.get(id)?.(undefined);
        }
      }
    }
  }

  return {
    nameOf(entity, id) {
      const route = routeOf(entity);
      if (route === undefined || id === "") return Promise.resolve(undefined);
      const shelf = known.get(entity.key) ?? { route, names: new Map() };
      known.set(entity.key, shelf);
      const kept = shelf.names.get(id);
      if (kept !== undefined) return kept;
      const name = new Promise<string | undefined>((answer) => {
        const batch = asking.get(entity.key);
        if (batch !== undefined) return void batch.waiting.set(id, answer);
        asking.set(entity.key, { entity, route, waiting: new Map([[id, answer]]) });
        // Every key asked in this tick goes in the same request.
        queueMicrotask(() => void ask(entity.key));
      });
      shelf.names.set(id, name);
      return name;
    },
    changed(change) {
      for (const [entityKey, shelf] of [...known])
        if (touches(change, shelf.route, entities)) known.delete(entityKey);
    },
  };
}
