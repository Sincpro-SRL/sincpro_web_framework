"use client";

import {
  type CommandBodies,
  PICK_PARAM,
  QUERY_PARAM,
  TRAIL_PARAM,
} from "@sincpro/client-framework";
import { type AnyRecord, type Criteria, nameOf } from "@sincpro/criteria";
import { RecordLink, useCrumbs, usePhone, type WorkspaceApi } from "@sincpro/web-composer";
import { frameworkCopy } from "@sincpro/web-framework/core/copy";
import { ownCrumbs } from "@sincpro/web-framework/core/crumbs";
import { explain } from "@sincpro/web-framework/core/explain";
import {
  choosesMany,
  type GroupLevel,
  type NamedFilter,
} from "@sincpro/web-framework/core/list";
import { textOf, viewOf } from "@sincpro/web-framework/core/present";
import { summaryFieldsOf } from "@sincpro/web-framework/core/summary";
import { useFramework } from "@sincpro/web-framework/react/context";
import { useGroups } from "@sincpro/web-framework/react/useGroups";
import type { Listing } from "@sincpro/web-framework/react/useListing";
import { usePivot } from "@sincpro/web-framework/react/usePivot";
import { type ListSelection, useSelection } from "@sincpro/web-framework/react/useSelection";
import { columnsOf } from "@sincpro/web-framework/web/list/columns";
import { actionsOf, type ScreenActions } from "@sincpro/web-framework/web/list/dock";
import { EntitySearchBar } from "@sincpro/web-framework/web/list/EntitySearchBar";
import { pilesOf } from "@sincpro/web-framework/web/list/groups";
import { OpenInMenu, openOptions, targetsFor } from "@sincpro/web-framework/web/list/openIn";
import { pivotOf } from "@sincpro/web-framework/web/list/pivot";
import { over, presentationOf } from "@sincpro/web-framework/web/list/presentation";
import {
  RESTORE,
  type RowCommand,
  useRowCommands,
} from "@sincpro/web-framework/web/list/rowCommands";
import {
  Button,
  Callout,
  type CardWays,
  type DockAction,
  List,
  type ListCrumb,
  type ListPresentProps,
  type ListSet,
  type OpenTarget,
  Pagination,
  pathKey,
  type Pile,
  RecordCard,
  type RowAction,
  type RowOf,
  SearchField,
  Tag,
} from "@sincpro/web-ui";
import { Plus, RotateCcw } from "lucide-react";
import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";

/**
 * A whole collection from a `Listing`: the bar, the search, the set in the views it offers,
 * and the way through it — the screen forge wrote five times by hand, written once.
 *
 * Context: this is the ready-made composition, not a cage. Everything it does is reachable on
 * its own — `columnsOf` for the columns, `EntitySearchBar` for the search, `useListing` for the
 * state — so a screen that needs its own bar or a second table writes `List` with those.
 *
 * Built for sets of any size: in `pages` mode (the default) the screen holds ONE page and walks
 * the server's cursor, so a million rows cost what fifty do; in `more` mode it stops growing at
 * its ceiling and asks to narrow the search. Nothing is filtered, ordered or counted on the
 * page: every gesture is a question to the server.
 *
 * Grouping obeys the same rule: «Group by» in the search bar asks the SERVER for the groups of
 * the whole set (`useGroups`), drawn as piles with their real count; a group's rows are read
 * when it is opened, and «See N more» reads its next page on the server's cursor. Since web-ui
 * 1.4 every face draws piles counted elsewhere — the table too — so grouping keeps the face.
 *
 * Where a record opens is the composer's question: with `api`, a row opens the page and the
 * identity column is the composer's `RecordLink` (peek, side panel, window); without it, the
 * screen passes `onOpen`.
 */
export type { NamedFilter };

/** What `useCrumbs` reads when the list is not in a workspace: no trail, and nothing to follow. */
const NO_TRAIL: readonly never[] = [];
const NO_WORKSPACE = {
  crumbs: () => NO_TRAIL,
  context: { subscribe: () => () => undefined },
  layout: { phone: () => false, subscribe: () => () => undefined },
} as unknown as WorkspaceApi;

/** How many lists' trails are kept: the records opened from the last fifty lists page on. */
const TRAILS = 50;

export type EntityListProps<T extends AnyRecord, C extends CommandBodies = CommandBodies> = {
  listing: Listing<T, C>;
  /**
   * The workspace this list is a view of. With it, a row opens its record as a page, the
   * identity column is the composer's `RecordLink` (peek, side panel, window on hover) and the
   * breadcrumb is the composer's — nothing for the screen to write.
   */
  api?: WorkspaceApi;
  /** The fields shown, in order. Without it, the named list's, or every scalar field. */
  columns?: readonly string[];
  /** The cells that are not plain text: a link, a tag. Memoise it: compared by identity. */
  cells?: Readonly<Partial<Record<string, (row: T) => ReactNode>>>;
  /**
   * The ways to look at the set, the first one shown: `table` (columns), `rows` (a name and
   * its facts, what a narrow panel wants), `board` (cards) and `sheet` (a spreadsheet, every
   * cell a value — web-ui's, windowed). The same set, the same search, the same page in each.
   * Without it, a named list's; else all four on a screen, and the table (rows when narrow)
   * inside a record. The id of one of `faces` opens on that face.
   */
  views?: readonly (View | (string & {}))[];
  /**
   * The set crossed by two fields — `{ rows: "state", columns: "payment" }` — counted and added
   * up by the server (`usePivot`), offered as the `pivot` face. Only while it is on screen does
   * it ask; never folded from the page.
   */
  pivot?: {
    rows: string | GroupLevel;
    columns: string | GroupLevel;
    /** What each crossing adds up. Without it, the figures the model computes. */
    measures?: readonly string[];
  };
  /** Without it, the model's own name. */
  title?: string;
  description?: string;
  crumbs?: readonly ListCrumb[];
  /**
   * What the list starts — «Importar», «Exportar ▸» —, beside «Nuevo». As data (`DockAction`s)
   * the application's view style draws them with «Nuevo»: the bar's buttons in `traditional`,
   * one pill floating at the bottom in `modern` (web-ui's `ViewStyleProvider`). A node drawn
   * by hand stays in the bar.
   */
  actions?: ScreenActions;
  onOpen?: (row: T) => void;
  onPeek?: (row: T) => void;
  /**
   * Where a row's record may open besides a press (the page): a look (👁), a modal, beside, a
   * window — offered in «Abrir en…» by the row's name. With `api`, everywhere the workspace
   * allows from here (`targetsFor`: no modal from inside a modal); `[]` or a few restrict it.
   */
  openTargets?: readonly OpenTarget[];
  /** Open a row's record there — without `api`, how a screen (a one2many) places it. */
  onOpenIn?: (row: T, to: OpenTarget) => void;
  /** What an empty list says. */
  empty?: string;
  /**
   * `"bar"` (the default) is the full search bar with the criteria builder; `"box"` is one
   * text box over the entity's search template — a chooser, a narrow panel; `false` is none.
   * Both ask the server on Enter, never per keystroke: a table is searched on purpose.
   */
  search?: "bar" | "box" | false;
  /** What each group adds up when the list is grouped — «Total 1.204.933,00» in its header,
   *  summed by the server over every row of it. Without it, the figures the model computes
   *  (read-only exact numbers, `sumsOf`); `false` adds nothing up. */
  sums?: readonly string[] | false;
  /** The cuts this list offers by name: «sólo pagadas», «vencidas». */
  filters?: readonly NamedFilter<T>[];
  /** The fields the search bar offers to look a typed text up in. Without it, the list
   *  definition's, else the entity's search template's, else its display (`facetsOf`). */
  facets?: readonly string[];
  /** The fields «Group by» offers, in this order — among those the model lets split the set.
   *  Without it, the list definition's, else every one the model does. */
  groupable?: readonly string[];
  /**
   * Rows can be ticked — and, past the page, «Elegir los 187 que coinciden». With `api`, what is
   * chosen is PUBLISHED to the workspace (`api.select`): a panel beside it follows the selection
   * without knowing this list.
   */
  selectable?: boolean;
  /** The selection, held by the screen (`useSelection(listing)`): read and set from outside the
   *  list. Without it the list holds its own. */
  selection?: ListSelection<T>;
  /** What to do with what is chosen, while something is — handed the selection to act on it
   *  (`useBatchCommand`). As data, the view style draws it: in the bar in place of the search
   *  in `traditional`, a pill floating at the bottom in `modern` («3 elegidas ✕ · Confirmar»).
   *  Giving it makes the rows choosable: `selectable` is not needed with it. */
  selectionActions?: ScreenActions | ((selection: ListSelection<T>) => ScreenActions);
  /** The list is a FIELD of a record — its lines, its members — and not a screen. */
  embedded?: boolean;
  /**
   * With `api` and an entity that declares `create`, the bar offers «New», which opens the
   * record's form with no id (`entity.newRef()`). `false` hides it — a list of what only a
   * Command produces, or a caller who may not create.
   */
  create?: boolean;
  /**
   * The entity's Commands offered on each row («Confirmar»), sent with their idempotency key;
   * the list is read again when one is done (`useRowCommands`).
   */
  commands?: readonly RowCommand<T, C>[];
  /** Any other action of a row — or the commands built by hand with `useRowCommands`. */
  rowActions?: (row: T) => readonly RowAction[];
  /**
   * Ways of looking at the set the SCREEN writes — a gallery, a map, a record with its lines and
   * its buttons — offered beside the built-in ones (web-ui's `List.Present`). Each is handed the
   * same set the others draw: the page, the search's grouping, the selection and what a press
   * does (`ListSet`). Offered after `views`; name one in `views` to open on it.
   */
  faces?: readonly EntityFace<T>[];
};

/** A face of a list written by the screen: its name and icon in the switcher, and how it draws
 *  the set. `wide` when it needs width (a narrow list does not offer it). */
export type EntityFace<T> = {
  id: string;
  label: string;
  icon: ListPresentProps<T>["icon"];
  wide?: boolean;
  render: (set: ListSet<T>) => ReactNode;
};

/** No commands: one constant, so the hook is not handed a new array on every render. */
const NO_COMMANDS: readonly never[] = [];

export type View = "table" | "rows" | "board" | "sheet" | "pivot";

/** What a list offers when nobody said: every face that needs no configuration. */
const EVERY_VIEW: readonly View[] = ["table", "rows", "board", "sheet"];

export function EntityList<T extends AnyRecord, C extends CommandBodies = CommandBodies>({
  listing,
  api,
  columns: askedColumns,
  cells,
  views: askedViews,
  title: askedTitle,
  description: askedDescription,
  crumbs,
  actions,
  onOpen,
  onPeek,
  openTargets,
  onOpenIn,
  pivot: pivotAsked,
  empty,
  search = "bar",
  sums,
  filters: askedFilters,
  facets: askedFacets,
  groupable: askedGroupable,
  selectable = false,
  selection: held,
  selectionActions,
  embedded = false,
  create = true,
  commands = NO_COMMANDS,
  rowActions: askedRowActions,
  faces,
}: EntityListProps<T, C>) {
  // A named list (`defineList`) brings its own columns, filters, faces and words; what the
  // screen passes wins.
  const definition = listing.definition;
  // The entity's own look (`presented`): its columns, the tones of its choices, its row and card.
  const look = presentationOf(listing.entity);
  const columns = askedColumns ?? definition?.columns ?? look.columns;
  const views =
    askedViews ??
    definition?.views ??
    (embedded ? ["table"] : pivotAsked === undefined ? EVERY_VIEW : [...EVERY_VIEW, "pivot"]);
  const filters = askedFilters ?? definition?.filters ?? [];
  const groupable = askedGroupable ?? definition?.groupable;
  const facets = askedFacets ?? definition?.facets;
  const title = askedTitle ?? definition?.title;
  const description = askedDescription ?? definition?.description;
  const copy = frameworkCopy().list;
  const { meta, locale, count, page } = listing;
  const identity = meta?.identity ?? "id";
  const idOf = (row: T) => String(row[identity]);
  const failed = listing.status === "failed" ? explain(listing.error) : null;
  const dropped = listing.dropped.map((d) => viewOf(meta, d.field, locale).label);
  const [present, setPresent] = useState<string>(views[0] ?? "table");
  // Opened to choose on what was typed in a picker (`chooserRef(query)`): it starts searched.
  const asked = api?.self.params?.[QUERY_PARAM] ?? "";
  // The box's text is a draft until Enter: typing asks the server nothing.
  const [draft, setDraft] = useState(asked === "" ? listing.text : asked);
  useEffect(() => {
    if (asked !== "" && search === "box") listing.search(asked, { now: true });
    // Once, as it opens: what the person types next is theirs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Opened by `api.pick` (`entity.chooserRef()`): a row ANSWERS whoever asked, it does not open.
  const choosing = api?.self.params?.[PICK_PARAM] !== undefined;
  // Asked for SEVERAL (`CHOOSE_MANY`, a many2many's «Buscar más…»): a row press ticks it, and
  // «Agregar (N)» answers what was chosen — the keys, or every record the list matches.
  const choosingMany = choosing && choosesMany(api?.choosing?.question);
  const own = useSelection(listing);
  const chosen = held ?? own;
  // Actions for the chosen rows make the rows choosable: given without `selectable` they were
  // silently never shown — no ticks, nothing to act on.
  const ticking = selectable || choosingMany || selectionActions !== undefined;
  // The record opened from a row knows the page it came from: «3 / 64» and its neighbours.
  const { trails, dateStyle } = useFramework();
  const trailKey = `trail:${useId()}`;
  // Kept current with the page on screen: the row and its name (`RecordLink`) open the same
  // reference, and whichever opens it, the record finds where it came from.
  useEffect(() => {
    if (api === undefined) return;
    const pages = listing.paging === "pages";
    trails.set(trailKey, {
      route: listing.route,
      question: listing.question as Criteria,
      key: identity,
      ids: listing.rows.map(idOf),
      offset: pages ? Math.max(0, listing.page.from - 1) : 0,
      size: listing.page.size,
      cursors: pages ? listing.page.cursors : [null],
      after: pages ? listing.page.after : null,
      total: pages ? (listing.count?.value ?? null) : listing.rows.length,
    });
    // Never forgotten when the list unmounts — the record it opened replaced it and still walks
    // on it — so the oldest go past a ceiling instead: one per list ever shown, fifty at most.
    for (const old of trails.keys()) {
      if (trails.size <= TRAILS) break;
      if (old !== trailKey) trails.delete(old);
    }
    // The page on screen is what the trail is: its rows, its cursors, its count.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    api,
    trails,
    trailKey,
    listing.rows,
    listing.count,
    listing.page.from,
    listing.page.after,
  ]);
  const refOf = (row: T) => {
    const ref = listing.entity.ref(idOf(row));
    return { ...ref, params: { ...ref.params, [TRAIL_PARAM]: trailKey } };
  };
  const openWithTrail = (row: T) => api?.open(refOf(row));
  const opening =
    onOpen ??
    (api === undefined
      ? undefined
      : choosingMany
        ? (row: T) => chosen.toggle(idOf(row))
        : choosing
          ? (row: T) => api.answer(listing.entity.ref(idOf(row)))
          : openWithTrail);
  const creating =
    create &&
    api !== undefined &&
    !choosing &&
    !embedded &&
    listing.entity.create !== undefined
      ? () => api.open(listing.entity.newRef())
      : undefined;
  // What the list starts, as data: «Nuevo» — the primary — and the screen's, drawn by the view
  // style (`List.Dock`). Actions drawn by hand stay in the bar, with «Nuevo» beside them.
  const started = actionsOf(actions);
  const startDock: readonly DockAction[] =
    started.drawn !== null
      ? []
      : [
          ...(creating === undefined
            ? []
            : [
                {
                  id: "create",
                  label: frameworkCopy().record.create,
                  icon: Plus,
                  primary: true,
                  onSelect: creating,
                },
              ]),
          ...started.dock,
        ];
  // A press opens the page — the composer's one predictable gesture. Every other place the
  // record may open is offered beside its name («Abrir en…») and, for a look, as web-ui's 👁
  // (`onPeek` with `rowClick="open"`: the press stays «open»). A chooser only chooses.
  const openingIn =
    onOpenIn ??
    (api === undefined
      ? undefined
      : (row: T, to: OpenTarget) =>
          to === "page" ? openWithTrail(row) : api.open(refOf(row), openOptions(to)));
  const targets =
    choosing || openingIn === undefined
      ? []
      : (openTargets ?? (api === undefined ? [] : targetsFor(api)));
  const elsewhere = targets.filter((to) => to !== "page");
  const peeking =
    onPeek ??
    (targets.includes("peek") && openingIn !== undefined
      ? (row: T) => openingIn(row, "peek")
      : undefined);
  // The cells are memoised (below): they reach the opener through a ref, so a screen's inline
  // `onOpenIn` is always the current one without redrawing every cell.
  const openingNow = useRef(openingIn);
  openingNow.current = openingIn;
  const openInOf = (row: T) =>
    elsewhere.length === 0 || openingIn === undefined ? null : (
      <OpenInMenu
        targets={elsewhere}
        name={idOf(row)}
        onOpen={(to) => openingNow.current?.(row, to)}
      />
    );
  // The column that names a row carries its link and «Abrir en…»: the identity, or — in a list
  // that does not show it (a relation inside a record) — the record's name, else the first.
  const named =
    columns === undefined || columns.includes(identity)
      ? identity
      : meta?.display && columns.includes(meta.display)
        ? meta.display
        : (columns[0] ?? identity);
  const rowName = (row: T) =>
    named === identity ? idOf(row) : (textOf(meta, named, row[named], locale) ?? idOf(row));
  const linked: typeof cells =
    choosing || cells?.[named] !== undefined || (api === undefined && elsewhere.length === 0)
      ? cells
      : {
          ...cells,
          [named]: (row: T) => (
            <span className="inline-flex items-center gap-1">
              {api === undefined ? (
                rowName(row)
              ) : (
                <RecordLink api={api} resource={refOf(row)}>
                  {rowName(row)}
                </RecordLink>
              )}
              {openInOf(row)}
            </span>
          ),
        };
  // `useCrumbs`, not `api.crumbs()`: the crumb must follow a name given later (`setTitle`).
  // Without a workspace it reads a trail that never changes — a hook cannot be skipped.
  const following = useCrumbs(api ?? NO_WORKSPACE);
  usePhone(api ?? NO_WORKSPACE); // where a row opens follows the mode (`targetsFor`)
  // The workspace's crumbs say each view's whole name (its tab's); in the trail a crumb says only
  // what is its own — «Pagos», not «Pagos · María Fernanda» under «María Fernanda».
  const trail = crumbs ?? (embedded || api === undefined ? undefined : ownCrumbs(following));

  // The workspace hears what is chosen: the keys, or — «all that match» — the ones on screen.
  const published = (
    chosen.selection.by === "keys"
      ? chosen.selection.keys
      : listing.rows.map((row) => idOf(row)).filter((id) => chosen.isChosen(id))
  ).join("\u0000");
  const heard = useRef(published);
  useEffect(() => {
    if (!ticking || heard.current === published) return;
    heard.current = published;
    api?.select(
      published === "" ? [] : published.split("\u0000").map((id) => listing.entity.ref(id)),
    );
  }, [api, ticking, published, listing.entity]);
  // «Elegir los 187 que coinciden» only past the page, and only with the server's exact count.
  const total = listing.count?.exact === true ? listing.count.value : null;
  // What is done to the chosen rows: answering whoever asked for several, else the screen's.
  const onChosen: ScreenActions = choosingMany
    ? [
        {
          id: "add-chosen",
          label: frameworkCopy().picker.addChosen(chosen.size),
          primary: true,
          onSelect: () => api?.answer(chosen.selection),
        },
      ]
    : typeof selectionActions === "function"
      ? selectionActions(chosen)
      : selectionActions;
  // As data they go to the dock, where the view style draws them; by hand, in the bar.
  const forChosen = actionsOf(onChosen);
  const selection = ticking
    ? {
        has: chosen.isChosen,
        toggle: chosen.toggle,
        count: chosen.size ?? 0,
        clear: chosen.clear,
        ...(total !== null && total > listing.rows.length
          ? { matching: { total, onSelect: chosen.chooseAllMatching } }
          : {}),
        ...(forChosen.drawn === null ? {} : { actions: forChosen.drawn }),
      }
    : undefined;

  // Rebuilt only when what it reads changes: a new set of columns on every render redraws
  // every cell of the table. `columns` is compared by content (it is usually a literal);
  // `cells` by identity, since its functions may close over state — memoise it to keep this.
  const names = columns?.join("\u0000");
  const shown = useMemo(
    () =>
      columnsOf<T>(meta, columns, {
        locale,
        ...(linked ? { cells: linked } : {}),
        ...(look.tones === undefined ? {} : { tones: look.tones }),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meta, locale, names, cells, api, elsewhere.join(), openingIn === undefined, dateStyle],
  );

  // A state the application gave colours to is the row's tag — and not again among its facts.
  const stateField = summaryFieldsOf(meta, {}, listing.entity.summary).state;
  const stateTones =
    stateField === undefined ? undefined : look.tones?.[stateField as keyof T & string];
  // A row and a card read the record by its display and the first fields shown beside it.
  const display = meta?.display || identity;
  const facts = shown
    .filter(
      (c) =>
        c.id !== display &&
        c.id !== identity &&
        !c.defaultHidden &&
        (stateTones === undefined || c.id !== stateField),
    )
    .slice(0, 3);
  // The pivot asks the server only while it is the face on screen.
  const axes =
    pivotAsked === undefined || present !== "pivot" || !views.includes("pivot")
      ? null
      : {
          rows:
            typeof pivotAsked.rows === "string"
              ? { field: pivotAsked.rows }
              : pivotAsked.rows,
          columns:
            typeof pivotAsked.columns === "string"
              ? { field: pivotAsked.columns }
              : pivotAsked.columns,
          ...(pivotAsked.measures === undefined ? {} : { measures: pivotAsked.measures }),
        };
  const crossing = usePivot(listing, axes);
  const folded =
    axes === null
      ? null
      : pivotOf({
          crossed: crossing.crossed,
          byColumn: crossing.columns,
          rows: axes.rows,
          columns: axes.columns,
          measures: crossing.measures,
          meta,
          locale,
        });
  // The sheet's columns are the table's on screen: one set of fields, two ways to read them.
  const sheetColumns = useMemo(
    () =>
      shown
        .filter((column) => !column.defaultHidden)
        .map((column) => ({
          id: column.id,
          header: String(column.header),
          ...(column.numeric === true ? { numeric: true } : {}),
        })),
    [shown],
  );
  const sortStates = useMemo(
    () =>
      listing.order.map((one) => ({
        key: one.field,
        direction: one.descending ? ("desc" as const) : ("asc" as const),
      })),
    [listing.order],
  );
  const sortable = useMemo(
    () =>
      shown
        .filter((column) => column.sortable === true && column.field !== undefined)
        .map((column) => ({ field: column.field!, label: String(column.header) })),
    [shown],
  );
  const rowOf = (row: T): RowOf =>
    over(
      {
        name: textOf(meta, display, row[display], locale) ?? idOf(row),
        meta: [
          // The key only where the list reads it: one that leaves it out (a relation inside a
          // record) does not print a UUID on every row.
          ...(display === identity || named !== identity ? [] : [idOf(row)]),
          ...facts.map((c) => textOf(meta, c.id, row[c.id], locale)).filter(Boolean),
        ].join(" · "),
        ...(elsewhere.length === 0 ? {} : { actions: openInOf(row) }),
        ...(stateTones === undefined || stateField === undefined
          ? {}
          : (() => {
              const word = textOf(meta, stateField, row[stateField], locale);
              return word === null
                ? {}
                : {
                    tags: (
                      <Tag tone={stateTones[String(row[stateField])] ?? "neutral"}>
                        {word}
                      </Tag>
                    ),
                  };
            })()),
      },
      look.row?.(row),
    );
  // Without a look of its own, the board's card is web-ui's, made of the row. With one, the
  // same card — the row's name, meta and tags — under it, and pressing it is still the list's:
  // web-ui (1.5) hands an own card the list's press rule (`ways.press`: open, or choose).
  const ownCard = look.card;
  const cardOfRow =
    ownCard === undefined
      ? undefined
      : (row: T, ways: CardWays) => {
          const d = rowOf(row);
          return (
            <RecordCard
              {...over(
                {
                  title: d.name,
                  ...(d.tags === undefined ? {} : { tags: d.tags }),
                  ...(d.meta === undefined ? {} : { meta: d.meta }),
                },
                ownCard(row),
              )}
              {...(ways.press === undefined ? {} : { onOpen: ways.press })}
            />
          );
        };

  // Grouped: the SERVER counts the groups; a group's rows are read when it is opened, so every
  // group starts closed. Every face of web-ui (1.4) draws these piles, the table included, and
  // each says what its next «more» brings (1.5).
  const groups = useGroups(listing, sums === undefined ? {} : { sums: sums || [] });
  const grouped = groups.levels.length > 0;
  // A table and a sheet say a group's sums under their columns (web-ui 2.9): beside the group's
  // name, only what no column shown adds up.
  const columnar = present === "table" || present === "sheet";
  const underColumns = new Set(
    columnar
      ? shown.flatMap((column) =>
          column.aggregate === undefined || column.defaultHidden || column.field === undefined
            ? []
            : [column.field],
        )
      : [],
  );
  const { piles, bucketAt } = pilesOf(
    groups.buckets,
    groups.levels,
    meta,
    locale,
    groups.rowsOf,
    groups.brings,
    underColumns,
  );
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => setOpened(new Set()), [groups.buckets]);
  const collapsed = [...bucketAt.keys()].filter((key) => !opened.has(key));
  const toggle = (key: string) => {
    const next = new Set(opened);
    if (next.has(key)) next.delete(key);
    else {
      next.add(key);
      const bucket = bucketAt.get(key);
      const deepest = bucket !== undefined && (bucket.groups ?? []).length === 0;
      if (deepest && groups.rowsOf(bucket) === undefined) groups.open(bucket);
    }
    setOpened(next);
  };
  const failure =
    grouped && groups.status === "failed" ? explain(groups.error) : grouped ? null : failed;
  const grouping = grouped
    ? {
        group: {
          levels: groups.levels,
          of: (row: T, level: { field: string }) => String(row[level.field] ?? ""),
          piles,
          collapsed,
          onToggle: toggle,
          // «See N more» inside an open group: its next page, on the server's cursor (web-ui 1.4).
          onMore: (pile: Pile<T>) => {
            const bucket = bucketAt.get(pathKey(pile.path));
            if (bucket !== undefined) groups.more(bucket);
          },
        },
      }
    : {};
  const records = groups.buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  // The foot adds up what the model says adds up (`total`) — over the rows in hand, never a
  // grouped set (each group says its own, counted by the server). While the rows are not the
  // whole set the list says the figures are this page's (`pageTotals`): the server's total over
  // everything filtered waits on a reading of measures (sincpro_framework, PRD_09).
  const partial =
    listing.paging === "pages"
      ? page.hasPrev || page.hasNext
      : listing.hasMore || listing.capped;
  // Inside a record or a panel a list is its rows: a page's sum there reads as THE total, so an
  // embedded list adds up only when every row is in hand.
  const totalled =
    !grouped &&
    !(embedded && partial) &&
    listing.rows.length > 0 &&
    shown.some((column) => column.aggregate !== undefined && !column.defaultHidden);

  // A row's actions: the entity's Commands, then whatever else the screen offers.
  // The trash (`trashOf`): each row is brought back from where it is, with the entity's own
  // `restore` — it can be undone, so it runs on the click; the list reads again after.
  const restoring =
    listing.definition?.trash === true && listing.entity.restore !== undefined;
  const offered = useMemo(
    () =>
      restoring
        ? [
            ...commands,
            {
              command: RESTORE,
              label: frameworkCopy().record.restore,
              icon: RotateCcw,
            } as unknown as RowCommand<T, C>,
          ]
        : commands,
    [restoring, commands],
  );
  const rowCommands = useRowCommands(listing, offered);
  const rowActions =
    offered.length === 0 && askedRowActions === undefined
      ? undefined
      : (row: T) => [...rowCommands.rowActions(row), ...(askedRowActions?.(row) ?? [])];
  const refused = rowCommands.error === null ? null : explain(rowCommands.error);

  // The way through the set. Inside a record or a panel, only while there is more than what is
  // on screen: «1–5 / 5» repeats the rows.
  const fits = embedded && !partial;
  const through = grouped ? (
    groups.status !== "ready" ? null : (
      <span className="text-meta text-muted">
        {groups.capped
          ? copy.groupsCapped(groups.buckets.length)
          : copy.groups(groups.buckets.length, records)}
      </span>
    )
  ) : fits ? null : listing.paging === "pages" ? (
    page.from === 0 ? null : (
      <Pagination
        from={page.from}
        to={page.to}
        total={count?.value ?? page.to}
        {...(page.hasPrev ? { onPrev: listing.prev } : {})}
        {...(page.hasNext ? { onNext: listing.next } : {})}
      />
    )
  ) : (
    <>
      {count === null ? null : (
        <span className="text-meta text-muted">
          {copy.shown(listing.rows.length, count.value, count.exact)}
        </span>
      )}
      {listing.capped ? (
        <span className="text-meta text-muted">{copy.capped(listing.rows.length)}</span>
      ) : listing.hasMore ? (
        <Button
          size="sm"
          role="secondary"
          disabled={listing.status === "loadingMore"}
          onClick={listing.more}
        >
          {listing.status === "loadingMore" ? copy.loading : copy.loadMore}
        </Button>
      ) : null}
    </>
  );
  const pageTotals = totalled && partial && present === "table";
  // Written only when it says something: web-ui draws an embedded list's bar for any slot
  // written, an empty one too. Its parts side by side and apart: the slot does not space them,
  // and «Totales de esta página» read glued to «1–50 / 112».
  const paging =
    !pageTotals && dropped.length === 0 && through === null ? null : (
      <span className="flex items-center gap-3">
        {pageTotals ? <span className="text-meta text-muted">{copy.pageTotals}</span> : null}
        {dropped.length === 0 ? null : (
          <Tag tone="warn" title={copy.dropped(dropped)}>
            {copy.dropped(dropped)}
          </Tag>
        )}
        {through}
      </span>
    );

  return (
    <List<T>
      items={listing.rows}
      keyOf={idOf}
      embedded={embedded}
      present={present}
      onPresentChange={setPresent}
      {...grouping}
      // The whole order, as web-ui 1.7 shows and sets it: ⇧-click on a header adds a field,
      // the sort menu reorders them — the same list the criteria builder writes.
      sort={sortStates}
      // The faces with no headers (rows, board) sort too, by the fields the model marks
      // sortable — on the server, so no `value` is given. Not inside a record or a panel: a
      // handful of rows has no «Ordenar» to offer, and the table's headers still sort.
      {...(embedded ? {} : { sortable })}
      onSortChange={(next) =>
        listing.orderBy(
          next.map((one) => ({ field: one.key, descending: one.direction === "desc" })),
        )
      }
      state={{
        // Only the FIRST reading shows the skeleton. Refining (typing, a filter, the next
        // page) keeps the rows on screen until the server answers: web-ui swaps the body for
        // a skeleton while `loading`, and a row that vanished under the pointer lost a click.
        // Meanwhile `refreshing` (web-ui 1.4) draws a quiet bar over the rows: asking, not gone.
        loading: grouped
          ? groups.status === "loading" && groups.buckets.length === 0
          : listing.status === "loading" && listing.rows.length === 0,
        refreshing: grouped
          ? groups.status === "loading" && groups.buckets.length > 0
          : listing.status === "loading" && listing.rows.length > 0,
        error:
          failure === null
            ? null
            : [failure.heading, failure.sentence].filter(Boolean).join(". "),
      }}
      filtered={listing.selection !== undefined || listing.text !== ""}
      empty={{
        sentence: empty ?? copy.empty,
        whenFiltered: { sentence: copy.emptyFiltered },
      }}
      {...(selection === undefined ? {} : { selection })}
      {...(opening === undefined ? {} : { onOpen: opening })}
      {...(peeking === undefined ? {} : { onPeek: peeking, rowClick: "open" as const })}
    >
      <List.Bar>
        {trail === undefined || trail.length === 0 ? null : <List.Crumbs crumbs={trail} />}
        {embedded ? null : (
          <List.Identity
            title={title ?? nameOf(meta, locale)}
            {...(description === undefined ? {} : { description })}
          />
        )}
        {search === "bar" ? (
          <List.Search>
            <EntitySearchBar
              listing={listing}
              filters={filters}
              groups={groups}
              {...(groupable === undefined ? {} : { groupable })}
              {...(facets === undefined ? {} : { facets })}
              {...(asked === "" ? {} : { seed: asked })}
            />
          </List.Search>
        ) : null}
        {search === "box" && meta?.search != null ? (
          <List.Search>
            <SearchField
              value={draft}
              onChange={(next) => {
                setDraft(next);
                // Emptied (or cleared with ×): the whole set again, at once.
                if (next === "" && listing.text !== "") listing.search("", { now: true });
              }}
              onSubmit={(text) => listing.search(text, { now: true })}
              placeholder={copy.search}
              aria-label={copy.search}
            />
          </List.Search>
        ) : null}
        {started.drawn === null ? null : (
          <List.Actions>
            {started.drawn}
            {creating === undefined ? null : (
              <Button role="primary" size="sm" onClick={creating}>
                {frameworkCopy().record.create}
              </Button>
            )}
          </List.Actions>
        )}
        {startDock.length === 0 && forChosen.dock.length === 0 ? null : (
          <List.Dock
            {...(startDock.length === 0 ? {} : { actions: startDock })}
            {...(forChosen.dock.length === 0 ? {} : { selection: forChosen.dock })}
          />
        )}
        {paging === null ? null : <List.Pagination>{paging}</List.Pagination>}
      </List.Bar>
      {views.includes("table") ? (
        <List.Table<T>
          columns={shown}
          // On the table, as its row actions: on the root a spread drops it silently.
          {...(totalled ? { totals: true } : {})}
          {...(rowActions === undefined ? {} : { rowActions })}
        />
      ) : null}
      {/* Always written, even when not asked for: web-ui draws a NARROW list — a window, a side
          panel, a phone — as rows whatever was asked, and a list with no rows face draws nothing
          there. */}
      <List.Rows<T> row={rowOf} />
      {views.includes("sheet") ? (
        <List.Sheet<T>
          columns={sheetColumns}
          cell={(row, column) => {
            const value = row[column.id];
            return value === null || value === undefined
              ? null
              : (textOf(meta, column.id, value, locale) ?? String(value));
          }}
        />
      ) : null}
      {views.includes("pivot") ? (
        <List.Pivot<T>
          folded={
            folded ??
            pivotOf({
              crossed: [],
              byColumn: [],
              rows: { field: "" },
              columns: { field: "" },
              measures: [],
              meta,
              locale,
            })
          }
        />
      ) : null}
      {views.includes("board") ? (
        <List.Board<T> {...(cardOfRow === undefined ? {} : { card: cardOfRow })} />
      ) : null}
      {(faces ?? []).map((face) => (
        <List.Present<T>
          key={face.id}
          id={face.id}
          label={face.label}
          icon={face.icon}
          {...(face.wide === undefined ? {} : { wide: face.wide })}
        >
          {face.render}
        </List.Present>
      ))}
      {refused === null ? null : (
        <Callout tone="bad" title={refused.heading}>
          {refused.sentence}
        </Callout>
      )}
    </List>
  );
}
