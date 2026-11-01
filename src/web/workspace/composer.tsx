"use client";

import { type AnyRecord, matching, type Meta } from "@sincpro/criteria";
import type { SearchHit, ViewProps, ViewSpec, WorkspaceApi } from "@sincpro/web-composer";
import { type Entity, NEW_PARAM } from "@sincpro/web-framework/core/entity";
import type { ListDefinition } from "@sincpro/web-framework/core/list";
import { lookupOf } from "@sincpro/web-framework/core/lookup";
import type { Transport } from "@sincpro/web-framework/core/transport";
import { useListing } from "@sincpro/web-framework/react/useListing";
import { EntityList } from "@sincpro/web-framework/web/list/EntityList";
import {
  type RecordOpening,
  RecordOpeningProvider,
} from "@sincpro/web-framework/web/record/opening";
import { openIn, RECORD_SIZE, targetsFor } from "@sincpro/web-framework/web/workspace/open";
import { EntityRecord } from "@sincpro/web-framework/web/workspace/record";
import { type ComponentType, type ReactNode, useMemo } from "react";

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
 * A reference with no id is the list — opened to choose one when it carries `pick` — and one
 * with `new` is the record's own view with no id: the form of a record that does not exist yet
 * (`entity.newRef()`), which `useRecord(entity, "")` fills with the model's defaults.
 *
 * ⌘K asks the server with `matching` — 8 records, identity and display — the same question a
 * many2one asks. The model definition is asked for once, on the first search, unless `meta`
 * is handed over.
 */
export type EntityViewOptions = {
  transport: Transport;
  /** How it reads in the palette, a panel's frame and the breadcrumb. */
  name: string;
  /** Its list. Without it, `EntityList` over the entity: search bar, pages, «Nuevo». */
  list?: ComponentType<ViewProps>;
  /** Its record. Without it, `EntityRecord`: the form the model describes. */
  record?: ComponentType<ViewProps>;
  icon?: ViewSpec["icon"];
  /** Listed under «Go to» in ⌘K. On by default. */
  goto?: boolean;
  /** Known before any search: no request asks for it. */
  meta?: Meta;
  actions?: ViewSpec["actions"];
};

/**
 * The fields of a view open their records in the workspace: a modal over this surface by
 * default, beside it from inside a modal, and «Buscar más…» as the entity's list that answers.
 */
function InWorkspace({ api, children }: { api: WorkspaceApi; children: ReactNode }) {
  const targets = targetsFor(api);
  const opening = useMemo<RecordOpening>(
    () => ({
      open: (ref, to) => openIn(api, ref, to),
      targets,
      choose: (entity, answer, query) =>
        api.pick(entity.chooserRef(query), (ref) => ref.id === undefined || answer(ref.id), {
          // Never a modal over a modal: from inside one, the chooser docks beside it.
          ...(targets[0] === "modal"
            ? { to: "modal" as const, size: RECORD_SIZE }
            : { to: "side" as const }),
        }),
    }),
    [api, targets],
  );
  return <RecordOpeningProvider value={opening}>{children}</RecordOpeningProvider>;
}

/** The entity's list when the application writes none. */
function listOf<T extends AnyRecord>(entity: Entity<T>): ComponentType<ViewProps> {
  return function DefaultList({ api }: ViewProps) {
    return <EntityList listing={useListing(entity)} api={api} />;
  };
}

/** The entity's record when the application writes none. */
function recordOf<T extends AnyRecord>(entity: Entity<T>): ComponentType<ViewProps> {
  return function DefaultRecord(props: ViewProps) {
    return <EntityRecord {...props} entity={entity} />;
  };
}

export function entityView<T extends AnyRecord>(
  entity: Entity<T>,
  options: EntityViewOptions,
): ViewSpec {
  const List = options.list ?? listOf(entity);
  const One = options.record ?? recordOf(entity);
  let meta: Meta | null = options.meta ?? null;

  function EntityView(props: ViewProps) {
    const record =
      props.resource.id !== undefined || props.resource.params?.[NEW_PARAM] !== undefined;
    return (
      <InWorkspace api={props.api}>
        {record ? <One {...props} /> : <List {...props} />}
      </InWorkspace>
    );
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

/**
 * A named list as a view of its own: «Por cobrar» in ⌘K's «Go to», its own breadcrumb, the
 * list the definition declares. Its rows open the ENTITY's record — the view `entityView`
 * registered — so a list view needs no record screen of its own.
 *
 *     views: [entityView(facturas, …), listView(porCobrar), listView(borradores)]
 */
export type ListViewOptions = {
  /** The screen; without it, `EntityList` over the definition, as it declares. */
  list?: ComponentType<ViewProps>;
  icon?: ViewSpec["icon"];
  /** Listed under «Go to» in ⌘K. On by default. */
  goto?: boolean;
};

export function listView<T extends AnyRecord>(
  list: ListDefinition<T>,
  options: ListViewOptions = {},
): ViewSpec {
  const Screen = options.list ?? definedList(list);
  return {
    domain: list.entity.domain,
    kind: list.ref().kind,
    title: () => list.title,
    goto: options.goto ?? true,
    ...(options.icon === undefined ? {} : { icon: options.icon }),
    load: async () => Screen,
  };
}

function definedList<T extends AnyRecord>(list: ListDefinition<T>): ComponentType<ViewProps> {
  function DefinedList({ api }: ViewProps) {
    return <EntityList listing={useListing(list)} api={api} />;
  }
  DefinedList.displayName = `List(${list.key})`;
  return DefinedList;
}
