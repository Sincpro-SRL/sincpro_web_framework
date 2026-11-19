"use client";

import {
  type Entity,
  keysOf,
  listRoute,
  type MetaStore,
  type Selection,
  SelectionTooLarge,
  type Transport,
} from "@sincpro/client-framework";
import { type AnyRecord, type Expression, matching, type Meta } from "@sincpro/criteria";
import { frameworkCopy } from "@sincpro/web-framework/core/copy";
import { explain } from "@sincpro/web-framework/core/explain";
import { lookupOf } from "@sincpro/web-framework/core/lookup";
import type { NameBook } from "@sincpro/web-framework/core/names";
import { entityFor } from "@sincpro/web-framework/core/relation";
import { summaryOf } from "@sincpro/web-framework/core/summary";
import { useFramework } from "@sincpro/web-framework/react/context";
import { BATCH_LIMIT } from "@sincpro/web-framework/react/useBatchCommand";
import { presentationOf } from "@sincpro/web-framework/web/list/presentation";
import { modelOf } from "@sincpro/web-framework/web/list/search";
import type {
  BrowseRecords,
  LoadModel,
  RecordOption,
  SearchRecords,
  ToastSpec,
} from "@sincpro/web-ui";
import { createContext, type ReactNode, useContext, useMemo } from "react";

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

/** What the searches of records ask of the framework: its transport, its definitions, its
 *  names and its entities — `useFramework()`'s. */
export type FrameworkReads = {
  transport: Transport;
  metas: MetaStore;
  names: NameBook;
  entities: readonly Entity[];
};

/** An entity's definition: known, or read once (one row) and kept for every place after. */
async function metaOf(
  framework: FrameworkReads,
  entity: Entity,
  signal?: AbortSignal,
): Promise<Meta | undefined> {
  const known = framework.metas.get(entity.key);
  if (known !== undefined) return known;
  const route = routeOf(entity);
  if (route === undefined) return undefined;
  const read = (await framework.transport.list(route, { pagination: { limit: 1 } }, signal))
    .meta;
  if (read == null) return undefined;
  framework.metas.set(entity.key, read);
  return read;
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
  framework: FrameworkReads,
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
    const meta = await metaOf(framework, entity, signal);
    if (route === undefined || meta === undefined) return [];
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

/**
 * web-ui's `loadModel` (2.8) answered by the framework: the model at the end of a path of
 * relations — «Cliente › País» —, what the criteria builder walks to offer a related record's
 * fields and the records themselves.
 *
 *     await modelLoader(framework, facturaMeta, "es")(["customer"])   ->  the customers' model
 *
 * 1. From the root's definition, each name of the path is a relation of the model before it.
 * 2. Its model is the relation's own definition, when the server published it inside; else its
 *    entity's (`entityFor` by the aggregate it names), known or read once.
 * Final: that definition as web-ui reads a model (`modelOf`); a path that leads nowhere — a name
 *    the model lacks, a relation to an entity the application did not declare — is refused.
 */
export function modelLoader(
  framework: FrameworkReads,
  root: Meta,
  locale: string | undefined,
): LoadModel {
  const next = async (meta: Meta, name: string): Promise<Meta | undefined> => {
    const field = meta.fields[name];
    if (field === undefined) return undefined;
    if (field.definition) return field.definition;
    const entity =
      typeof field.relation === "string"
        ? entityFor(framework.entities, field.relation, framework.metas.get)
        : undefined;
    return entity === undefined ? undefined : metaOf(framework, entity);
  };
  return async (path) => {
    let meta = root;
    for (const name of path) {
      const found = await next(meta, name);
      if (found === undefined) throw new Error(`no model at ${path.join(" › ")}`);
      meta = found;
    }
    return modelOf(meta, locale);
  };
}

/** `modelLoader` over the framework's context, from a list's definition (none yet: none). */
export function useLoadModel(root: Meta | null | undefined): LoadModel | undefined {
  const { transport, metas, names, entities, locale } = useFramework();
  return useMemo(
    () =>
      root == null
        ? undefined
        : modelLoader({ transport, metas, names, entities }, root, locale),
    [root, transport, metas, names, entities, locale],
  );
}

/**
 * How a chooser of an entity is opened, and what it answers: one record by its key (`choose`)
 * or what was chosen of several (`chooseMany`, a `Selection`) — the workspace's, given to the
 * fields of a record (`RecordOpening`) and to the search bar (`RecordsBrowserProvider`).
 */
export type Chooser<A> = (
  entity: Entity,
  answer: (value: A) => void,
  query: string,
  scope?: Expression,
) => void;

/**
 * web-ui's `browseRecords` (2.8) answered by the framework: «Buscar más…» under the records of a
 * relation opens its entity's list to choose — several when the place takes several, one
 * otherwise —, on what was typed and without what is already chosen; the keys chosen are answered
 * named.
 *
 * 1. The relation's entity (`entityFor`); one the application did not declare is not browsed.
 * 2. What is chosen is left out of the chooser (`not in` its keys), as a picker's chooser does.
 * 3. Several: the chooser answers a `Selection`, read as keys with a ceiling (`keysOf`,
 *    `BATCH_LIMIT`) — past it nothing is chosen and `refused` says why. One: its key.
 * Final: the keys, named through `names` (the `NameBook`), handed to web-ui (`choose`).
 */
export function recordsBrowser(
  framework: FrameworkReads,
  open: { choose?: Chooser<string> | undefined; chooseMany?: Chooser<Selection> | undefined },
  names: SearchRecords,
  refused: (failure: unknown) => void,
): BrowseRecords {
  return (browse) => {
    const entity = entityFor(framework.entities, browse.relation, framework.metas.get);
    if (entity === undefined) return;
    const meta = framework.metas.get(entity.key);
    const identity = meta?.get_id || meta?.identity || "id";
    const chosen = browse.chosen.map((one) => String(one.id));
    const scope =
      chosen.length === 0
        ? undefined
        : ({ field: identity, operator: "not in", value: chosen } as Expression);
    const answer = (keys: readonly string[]) =>
      names({
        relation: browse.relation,
        path: browse.path,
        text: "",
        keys,
        signal: new AbortController().signal,
      }).then(browse.choose, refused);
    const route = routeOf(entity);
    if (browse.many && open.chooseMany !== undefined && route !== undefined)
      open.chooseMany(
        entity,
        (selection) =>
          void keysOf(selection, {
            transport: framework.transport,
            route,
            identity,
            limit: BATCH_LIMIT,
          }).then(answer, refused),
        browse.text,
        scope,
      );
    else open.choose?.(entity, (id) => void answer([id]), browse.text, scope);
  };
}

/**
 * What a person is told when choosing records failed — too many chosen to take at once
 * (`SelectionTooLarge`), in the framework's words; anything else, as the server explained it —,
 * as a web-ui toast.
 */
export function refusalNotice(failure: unknown): ToastSpec {
  if (failure instanceof SelectionTooLarge)
    return {
      tone: "warn",
      message: frameworkCopy().batch.tooMany(failure.size, failure.limit),
    };
  const { heading, sentence } = explain(failure);
  return { tone: "bad", message: heading, detail: sentence };
}

const Browser = createContext<BrowseRecords | null>(null);

/** «Buscar más…» for every search bar below — what a workspace view gives its screens. */
export function RecordsBrowserProvider({
  value,
  children,
}: {
  value: BrowseRecords;
  children: ReactNode;
}) {
  return <Browser.Provider value={value}>{children}</Browser.Provider>;
}

/** The view's «Buscar más…», or `null` outside a workspace. */
export function useRecordsBrowser(): BrowseRecords | null {
  return useContext(Browser);
}
