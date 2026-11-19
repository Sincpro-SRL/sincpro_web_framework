"use client";

import {
  type Entity,
  listRoute,
  type MetaStore,
  type Transport,
} from "@sincpro/client-framework";
import { type AnyRecord, matching, type Meta } from "@sincpro/criteria";
import { lookupOf } from "@sincpro/web-framework/core/lookup";
import type { NameBook } from "@sincpro/web-framework/core/names";
import { entityFor } from "@sincpro/web-framework/core/relation";
import { summaryOf } from "@sincpro/web-framework/core/summary";
import { useFramework } from "@sincpro/web-framework/react/context";
import { presentationOf } from "@sincpro/web-framework/web/list/presentation";
import type { RecordOption, SearchRecords } from "@sincpro/web-ui";
import { useMemo } from "react";

/** A record as a person picks it by name: its key, its name, and what tells it apart. */
export type Choice = { id: string; name: string; detail?: string };

/**
 * The records of an entity that match a typed text, as a person picks them by name — a ⌘K hit,
 * a relation's record in the search bar: the entity's LITERAL search (`matching`: its search
 * template and a short page), each record whole, read as its name and, beside it, what tells it
 * apart — the entity's `option` look, else its summary's description or type. Never its key.
 *
 *     await findChoices(transport, clientes, clienteMeta, "/clientes", "andres", "es")
 *       -> [{ id: "C-7", name: "Andrés Pérez", detail: "NIT 4455667" }, …]
 *
 * Context: `matching` asks for references (identity and display), and the `option` look and the
 * summary read fields a reference does not carry: ⌘K's detail was always empty against the real
 * backend (#48). The question keeps `matching`'s template and its page, and brings each record
 * whole. ⌘K and the search bar's records (web-ui 2.7) read a record the same way, here.
 */
export async function findChoices<T extends AnyRecord>(
  transport: Transport,
  entity: Entity<T>,
  meta: Meta,
  route: string,
  text: string,
  locale: string | undefined,
  signal?: AbortSignal,
): Promise<Choice[]> {
  const { specification: _reference, ...question } = matching(meta, text);
  const page = await transport.list<AnyRecord>(route, question, signal);
  const look = presentationOf(entity).option;
  return lookupOf(meta, page.rows, entity.summary).map((one) => {
    const own = look === undefined || one.record === undefined ? {} : look(one.record as T);
    const summary =
      one.record === undefined
        ? undefined
        : summaryOf(meta, one.record, {
            fields: entity.summary ?? {},
            ...(locale === undefined ? {} : { locale }),
          });
    const detail = own.meta ?? summary?.description ?? summary?.type ?? undefined;
    return {
      id: one.id,
      name: own.name ?? one.label,
      ...(detail === undefined ? {} : { detail }),
    };
  });
}

/** Where an entity is listed, or `undefined` when only under another record (`/{id}/lines`). */
function routeOf(entity: Entity): string | undefined {
  try {
    return listRoute(entity.list);
  } catch {
    return undefined;
  }
}

/**
 * web-ui's `searchRecords` (2.7) answered by the framework: the records of a relation the search
 * bar unfolds and the criteria builder picks — «andres» → the customers that match —, each
 * chosen by its key and read by its name.
 *
 * 1. The relation names an aggregate: its entity among the application's (`entityFor`); one the
 *    application did not declare finds nothing — the bar still offers the relation's text.
 * 2. Keys instead of a text (a filter read back from a link): their names, through the book every
 *    cell asks (`NameBook`: one request per entity, kept) — a key without one reads as itself.
 * 3. Else the entity's literal search (`findChoices`), its definition known or read once.
 */
export function recordsSearch(
  framework: {
    transport: Transport;
    metas: MetaStore;
    names: NameBook;
    entities: readonly Entity[];
  },
  locale: string | undefined,
): SearchRecords {
  return async ({ relation, text, keys, signal }) => {
    const entity = entityFor(framework.entities, relation, framework.metas.get);
    if (entity === undefined) return [];
    if (keys !== undefined)
      return Promise.all(
        keys.map(async (key) => ({
          id: key,
          name: (await framework.names.nameOf(entity, String(key))) ?? String(key),
        })),
      );
    const route = routeOf(entity);
    if (route === undefined) return [];
    let meta = framework.metas.get(entity.key);
    if (meta === undefined) {
      const read = (
        await framework.transport.list(route, { pagination: { limit: 1 } }, signal)
      ).meta;
      if (read == null) return [];
      framework.metas.set(entity.key, read);
      meta = read;
    }
    const choices = await findChoices(
      framework.transport,
      entity,
      meta,
      route,
      text,
      locale,
      signal,
    );
    return choices.map((one): RecordOption => ({
      id: one.id,
      name: one.name,
      ...(one.detail === undefined ? {} : { meta: one.detail }),
    }));
  };
}

/** `recordsSearch` over the framework's context: the screens' transport, its definitions and
 *  its names, in the provider's language. */
export function useSearchRecords(): SearchRecords {
  const { transport, metas, names, entities, locale } = useFramework();
  return useMemo(
    () => recordsSearch({ transport, metas, names, entities }, locale),
    [transport, metas, names, entities, locale],
  );
}
