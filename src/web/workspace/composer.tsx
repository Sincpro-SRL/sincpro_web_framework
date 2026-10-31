"use client";

import { type AnyRecord, matching, type Meta } from "@sincpro/criteria";
import type { SearchHit, ViewProps, ViewSpec } from "@sincpro/web-composer";
import type { Entity } from "@sincpro/web-framework/core/entity";
import { lookupOf } from "@sincpro/web-framework/core/lookup";
import type { Transport } from "@sincpro/web-framework/core/transport";
import type { ComponentType } from "react";

/**
 * An entity as the composer's view: one `ViewSpec` for its list (a reference without an id)
 * and its record (with one), searchable from ⌘K.
 *
 * Context: the composer opens references and never imports a domain — a domain DECLARES itself
 * with a `ViewSpec`. The entity already knows its key (`domain:kind`), its routes and how a
 * text finds one of its records (the framework's `LiteralSearch`: `meta.search` filled by
 * `matching`), so its spec is written here once instead of by hand per kind (forge wrote
 * eight). The screens stay the application's: `list` and `record` are its components.
 *
 * ⌘K asks the server with `matching` — 8 records, identity and display — the same question a
 * many2one asks. The model definition is asked for once, on the first search, unless `meta`
 * is handed over.
 */
export type EntityViewOptions = {
  transport: Transport;
  /** How it reads in the palette, a panel's frame and the breadcrumb. */
  name: string;
  list: ComponentType<ViewProps>;
  record: ComponentType<ViewProps>;
  icon?: ViewSpec["icon"];
  /** Listed under «Go to» in ⌘K. On by default. */
  goto?: boolean;
  /** Known before any search: no request asks for it. */
  meta?: Meta;
  actions?: ViewSpec["actions"];
};

export function entityView<T extends AnyRecord>(
  entity: Entity<T>,
  options: EntityViewOptions,
): ViewSpec {
  const { list: List, record: One } = options;
  let meta: Meta | null = options.meta ?? null;

  function EntityView(props: ViewProps) {
    return props.resource.id === undefined ? <List {...props} /> : <One {...props} />;
  }

  return {
    domain: entity.domain,
    kind: entity.kind,
    title: (ref) => ref.id ?? options.name,
    goto: options.goto ?? true,
    ...(options.icon === undefined ? {} : { icon: options.icon }),
    ...(options.actions === undefined ? {} : { actions: options.actions }),
    search: async (query): Promise<readonly SearchHit[]> => {
      if (query.trim() === "") return [];
      if (meta === null)
        meta = (await options.transport.list(entity.list, { pagination: { limit: 1 } })).meta;
      if (meta?.search == null) return [];
      const page = await options.transport.list<AnyRecord>(entity.list, {
        ...matching(meta, query),
        meta: false,
      });
      return lookupOf(meta, page.rows).map((one) => ({
        ref: entity.ref(one.id),
        label: one.label,
        ...(one.detail === undefined ? {} : { detail: one.detail }),
      }));
    },
    load: async () => EntityView,
  };
}
