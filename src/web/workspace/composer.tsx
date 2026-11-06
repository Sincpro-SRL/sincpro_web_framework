"use client";

import {
  type Entity,
  listRoute,
  NEW_PARAM,
  scopeOfRef,
  type Transport,
} from "@sincpro/client-framework";
import { type AnyRecord, matching, type Meta } from "@sincpro/criteria";
import type { SearchHit, ViewProps, ViewSpec, WorkspaceApi } from "@sincpro/web-composer";
import type { ListDefinition } from "@sincpro/web-framework/core/list";
import { lookupOf } from "@sincpro/web-framework/core/lookup";
import { ListScopeProvider } from "@sincpro/web-framework/react/scope";
import { useListing } from "@sincpro/web-framework/react/useListing";
import { EntityList } from "@sincpro/web-framework/web/list/EntityList";
import { presentationOf } from "@sincpro/web-framework/web/list/presentation";
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
 * (`entity.newRef(values)`), which `useRecord(entity, resource)` fills with the model's defaults
 * and what the reference carries.
 *
 * ⌘K asks the server with `matching` — 8 records, identity and display — the same question a
 * many2one asks. The model definition is asked for once, on the first search, unless `meta`
 * is handed over. A list whose route answers a SCOPE by its params (forge's `/projects`
 * without `tenant_id` is the projects with NO tenant) is searched in the one ⌘K should see:
 * `search: { params }`.
 *
 * The screens can come in a chunk of their own (`load`): the composer asks for a view's
 * component when it first opens, so the application's bundle does not carry every screen of
 * every entity — `entityView` keeps that, where handing it the components had lost it.
 *
 *     entityView(invoices, { transport, name: "Facturas",
 *       load: () => import("./invoice_views").then((m) => ({ list: m.Invoices, record: m.Invoice })) })
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
  /** ⌘K's question: the list route's params that say which records it searches. */
  search?: { params?: Readonly<Record<string, string>> };
  /** The screens, loaded when the view first opens — a dynamic `import()`. What it does not
   *  bring is `list` / `record`, or the defaults. */
  load?: () => Promise<{
    list?: ComponentType<ViewProps>;
    record?: ComponentType<ViewProps>;
  }>;
};

/**
 * The fields of a view open their records in the workspace: a modal over this surface by
 * default, beside it from inside a modal, «Buscar más…» as the entity's list that answers, and
 * a one2many's «Agregar» as the new record's form that answers once it exists.
 */
function InWorkspace({ api, children }: { api: WorkspaceApi; children: ReactNode }) {
  const targets = targetsFor(api);
  const opening = useMemo<RecordOpening>(() => {
    // Never a modal over a modal: from inside one, what answers docks beside it.
    const answering =
      targets[0] === "modal"
        ? { to: "modal" as const, size: RECORD_SIZE }
        : { to: "side" as const };
    return {
      open: (ref, to) => openIn(api, ref, to),
      targets,
      narrow: api.surface !== "page",
      choose: (entity, answer, query, scope) =>
        api.pick(
          entity.chooserRef(query, scope),
          (ref) => ref.id === undefined || answer(ref.id),
          answering,
        ),
      create: (entity, values, created) =>
        api.pick(entity.newRef(values), () => created(), answering),
    };
  }, [api, targets]);
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
  let meta: Meta | null = options.meta ?? null;
  const route = listRoute(entity.list, options.search?.params);

  async function screens(): Promise<ComponentType<ViewProps>> {
    const loaded = options.load === undefined ? {} : await options.load();
    const List = loaded.list ?? options.list ?? listOf(entity);
    const One = loaded.record ?? options.record ?? recordOf(entity);
    return function EntityView(props: ViewProps) {
      const record =
        props.resource.id !== undefined || props.resource.params?.[NEW_PARAM] !== undefined;
      // A chooser opened by a picker offers only what the picker may choose: its cut travels in
      // the reference, and the list — the application's own too — reads under it.
      const cut = record ? undefined : scopeOfRef(props.resource);
      const list =
        cut === undefined ? (
          <List {...props} />
        ) : (
          <ListScopeProvider value={{ key: entity.key, where: cut }}>
            <List {...props} />
          </ListScopeProvider>
        );
      return <InWorkspace api={props.api}>{record ? <One {...props} /> : list}</InWorkspace>;
    };
  }
  // Built once: a second open of the view must be the same component, or it would remount. A
  // chunk that failed to arrive is asked again next time.
  let view: Promise<ComponentType<ViewProps>> | null = null;

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
        meta = (await options.transport.list(route, { pagination: { limit: 1 } })).meta;
      if (meta?.search == null) return [];
      const page = await options.transport.list<AnyRecord>(route, matching(meta, query));
      // ⌘K writes text: of the entity's look of a choice, its name and its meta.
      const look = presentationOf(entity).option;
      return lookupOf(meta, page.rows, entity.summary).map((one) => {
        const own =
          look === undefined || one.record === undefined ? {} : look(one.record as T);
        const detail = own.meta ?? one.detail;
        return {
          ref: entity.ref(one.id),
          label: own.name ?? one.label,
          ...(detail === undefined ? {} : { detail }),
        };
      });
    },
    load: () => {
      view ??= screens().catch((failure: unknown) => {
        view = null;
        throw failure;
      });
      return view;
    },
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
