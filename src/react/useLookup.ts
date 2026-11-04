"use client";

import { type AnyRecord, type Criteria, merge, type Meta } from "@sincpro/criteria";
import type { Entity } from "@sincpro/web-framework/core/entity";
import { isList, type ListDefinition } from "@sincpro/web-framework/core/list";
import { lookupOf, type LookupOption } from "@sincpro/web-framework/core/lookup";
import { useFramework } from "@sincpro/web-framework/react/context";
import { useListing } from "@sincpro/web-framework/react/useListing";
import { useEffect, useRef, useState } from "react";

/**
 * The records of an entity as choices — the literal search of a many2one.
 *
 * Context: it is a listing like any other — the entity's own search template fills with what
 * is typed, debounced, asked of the server — whose rows are read as choices (`lookupOf`). It
 * opens on the first TEN in the entity's own order (what Odoo's many2one shows, and what fits
 * a dropdown); typing asks the server, so the record 123 455 of 200 000 is found by its name
 * though it was never among the ten. Never the table.
 *
 * The chosen record usually is NOT on the page on screen — a search narrowed it, or it lies
 * past the first ten — so its name is kept: from the options it was seen among, or asked of
 * the server once by its key (`chosen`).
 *
 * `exclude` leaves keys out of the choices — the tenants a project is already shared with — and
 * the SERVER leaves them out (`not in` under `criteria`), so the ten are ten that may be chosen.
 * It needs the entity's key field: until its definition is known the first ten come
 * unexcluded, and the reading starts over when it arrives.
 */
export type Lookup = {
  options: LookupOption[];
  text: string;
  search: (text: string) => void;
  /** The entity has a literal search template: typing asks the server. Without one the
   *  options are filtered where they are. */
  searchable: boolean;
  loading: boolean;
  hasMore: boolean;
  more: () => void;
  /** The chosen record as a choice, whether or not it is among `options`. */
  chosen: LookupOption | undefined;
  /** The chosen records of a many2many (`values`), in their order, each as a choice — those
   *  not known yet are asked of the server in one question. */
  chosenAll: LookupOption[];
};

/** Ten: what a dropdown shows without scrolling, and what Odoo's many2one asks for. */
const FIRST = 10;

/** What may be chosen: the screen's own cut, without the keys it excludes. */
export function excluding<T extends AnyRecord>(
  criteria: Criteria<T> | undefined,
  exclude: readonly string[] | undefined,
  meta: Meta | null | undefined,
): Criteria<T> | undefined {
  if (exclude === undefined || exclude.length === 0 || meta == null) return criteria;
  const out = {
    where: {
      field: meta.get_id || meta.identity || "id",
      operator: "not in",
      value: [...exclude],
    },
  } as Criteria<T>;
  return criteria === undefined ? out : merge<T>(criteria, out);
}

export function useLookup<T extends AnyRecord>(
  /** The entity, or a named list of it: «active customers» chooses only those. */
  entity: Entity<T> | ListDefinition<T>,
  options: {
    pageSize?: number;
    /**
     * Which records may be chosen at all — the contacts OF the chosen customer, the warehouses
     * OF the branch. The server applies it under whatever is typed; a new scope starts over.
     */
    criteria?: Criteria<T>;
    /** The key of the chosen record, to keep its name (`chosen`). */
    value?: string;
    /** The keys chosen in a many2many, to keep their names (`chosenAll`). */
    values?: readonly string[];
    /** Keys never offered — those already chosen elsewhere. Left out by the server. */
    exclude?: readonly string[];
  } = {},
): Lookup {
  const { transport, metas } = useFramework();
  const base = isList(entity) ? entity.entity : entity;
  // The key field to exclude by comes with the definition: known already, or with the first
  // answer — then this renders again and the reading starts over without the excluded.
  const [definition, setDefinition] = useState(() => metas.get(base.key));
  const scope = excluding(options.criteria, options.exclude, definition);
  // «More», not pages: a choice list grows downwards, and its ceiling keeps it light.
  const listing = useListing(entity, {
    paging: "more",
    pageSize: options.pageSize ?? FIRST,
    ...(scope === undefined ? {} : { criteria: scope }),
  });
  useEffect(() => {
    if (definition === undefined && listing.meta !== null) setDefinition(listing.meta);
  }, [definition, listing.meta]);
  const choices = lookupOf(listing.meta, listing.rows, base.summary);

  // Every choice seen is remembered: the chosen are named even after the page moved on.
  const seen = useRef(new Map<string, LookupOption>());
  for (const one of choices) seen.current.set(one.id, one);
  const [, setNamed] = useState(0);
  const value = options.value ?? "";
  const wanted = options.values ?? (value === "" ? [] : [value]);
  const missing = wanted.filter((id) => !seen.current.has(id));
  const missingKey = missing.join("\u0000");

  // Chosen but never seen (a form opened on a saved record): their names, asked ONCE by key.
  const route = base.list;
  const meta = listing.meta;
  useEffect(() => {
    if (missingKey === "" || meta === null) return;
    const keys = missingKey.split("\u0000");
    const key = meta.get_id || meta.identity || "id";
    const aborter = new AbortController();
    transport
      .list<AnyRecord>(
        route,
        {
          where:
            keys.length === 1
              ? { field: key, operator: "=", value: keys[0] ?? "" }
              : { field: key, operator: "in", value: keys },
          pagination: { limit: keys.length },
          meta: false,
        },
        aborter.signal,
      )
      .then((page) => {
        for (const one of lookupOf(meta, page.rows, base.summary))
          seen.current.set(one.id, one);
        setNamed((n) => n + 1);
      })
      .catch(() => undefined); // unnamed is not an error: the field shows its key
    return () => aborter.abort();
  }, [transport, route, meta, missingKey, base.summary]);

  const known = value === "" ? undefined : seen.current.get(value);
  const chosenAll = wanted.map((id) => seen.current.get(id) ?? { id, label: id });

  return {
    options: choices,
    text: listing.text,
    search: listing.search,
    searchable: listing.meta?.search != null,
    loading: listing.status === "loading",
    hasMore: listing.hasMore,
    more: listing.more,
    chosen: known,
    chosenAll,
  };
}
