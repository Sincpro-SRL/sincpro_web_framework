"use client";

import {
  type CommandBodies,
  PICK_PARAM,
  QUERY_PARAM,
  TRAIL_PARAM,
} from "@sincpro/client-framework";
import { type AnyRecord, type Criteria, nameOf } from "@sincpro/criteria";
import { RecordLink, useCrumbs, type WorkspaceApi } from "@sincpro/web-composer";
import { frameworkCopy } from "@sincpro/web-framework/core/copy";
import { explain } from "@sincpro/web-framework/core/explain";
import type { GroupLevel, NamedFilter } from "@sincpro/web-framework/core/list";
import { textOf, viewOf } from "@sincpro/web-framework/core/present";
import { useFramework } from "@sincpro/web-framework/react/context";
import { useGroups } from "@sincpro/web-framework/react/useGroups";
import type { Listing } from "@sincpro/web-framework/react/useListing";
import { usePivot } from "@sincpro/web-framework/react/usePivot";
import { columnsOf } from "@sincpro/web-framework/web/list/columns";
import { EntitySearchBar } from "@sincpro/web-framework/web/list/EntitySearchBar";
import { pilesOf } from "@sincpro/web-framework/web/list/groups";
import { OpenInMenu, openOptions, targetsFor } from "@sincpro/web-framework/web/list/openIn";
import { pivotOf } from "@sincpro/web-framework/web/list/pivot";
import { over, presentationOf } from "@sincpro/web-framework/web/list/presentation";
import { type RowCommand, useRowCommands } from "@sincpro/web-framework/web/list/rowCommands";
import {
  Button,
  Callout,
  type CardWays,
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
  actions?: ReactNode;
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
  /**
   * Rows can be ticked. With `api`, what is ticked is PUBLISHED to the workspace
   * (`api.select`): a panel beside it follows the selection without knowing this list.
   */
  selectable?: boolean;
  /** What to do with what is ticked: drawn in the bar while something is. */
  selectionActions?: ReactNode;
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
  selectable = false,
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
  const columns = askedColumns ?? definition?.columns;
  const views =
    askedViews ??
    definition?.views ??
    (embedded ? ["table"] : pivotAsked === undefined ? EVERY_VIEW : [...EVERY_VIEW, "pivot"]);
  const filters = askedFilters ?? definition?.filters ?? [];
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
  // The record opened from a row knows the page it came from: «3 / 64» and its neighbours.
  const { trails } = useFramework();
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
  const linked: typeof cells =
    choosing ||
    cells?.[identity] !== undefined ||
    (api === undefined && elsewhere.length === 0)
      ? cells
      : {
          ...cells,
          [identity]: (row: T) => (
            <span className="inline-flex items-center gap-1">
              {api === undefined ? (
                idOf(row)
              ) : (
                <RecordLink api={api} resource={refOf(row)}>
                  {idOf(row)}
                </RecordLink>
              )}
              {openInOf(row)}
            </span>
          ),
        };
  // `useCrumbs`, not `api.crumbs()`: the crumb must follow a name given later (`setTitle`).
  // Without a workspace it reads a trail that never changes — a hook cannot be skipped.
  const following = useCrumbs(api ?? NO_WORKSPACE);
  const trail = crumbs ?? (embedded || api === undefined ? undefined : following);

  const [ticked, setTicked] = useState<ReadonlySet<string>>(() => new Set());
  const tick = (next: ReadonlySet<string>) => {
    setTicked(next);
    api?.select([...next].map((id) => listing.entity.ref(id)));
  };
  const selection = selectable
    ? {
        has: (id: string) => ticked.has(id),
        toggle: (id: string) => {
          const next = new Set(ticked);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          tick(next);
        },
        count: ticked.size,
        clear: () => tick(new Set()),
        ...(selectionActions === undefined ? {} : { actions: selectionActions }),
      }
    : undefined;

  // Rebuilt only when what it reads changes: a new set of columns on every render redraws
  // every cell of the table. `columns` is compared by content (it is usually a literal);
  // `cells` by identity, since its functions may close over state — memoise it to keep this.
  const names = columns?.join("\u0000");
  const shown = useMemo(
    () => columnsOf<T>(meta, columns, { locale, ...(linked ? { cells: linked } : {}) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meta, locale, names, cells, api, elsewhere.join(), openingIn === undefined],
  );

  // A row and a card read the record by its display and the first fields shown beside it.
  const display = meta?.display || identity;
  const facts = shown
    .filter((c) => c.id !== display && c.id !== identity && !c.defaultHidden)
    .slice(0, 3);
  // The entity's own look of a row and a card (`presented`) goes over these defaults.
  const look = presentationOf(listing.entity);
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
          ...(display === identity ? [] : [idOf(row)]),
          ...facts.map((c) => textOf(meta, c.id, row[c.id], locale)).filter(Boolean),
        ].join(" · "),
        ...(elsewhere.length === 0 ? {} : { actions: openInOf(row) }),
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
  const { piles, bucketAt } = pilesOf(
    groups.buckets,
    groups.levels,
    meta,
    locale,
    groups.rowsOf,
    groups.brings,
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

  // A row's actions: the entity's Commands, then whatever else the screen offers.
  const rowCommands = useRowCommands(listing, commands);
  const rowActions =
    commands.length === 0 && askedRowActions === undefined
      ? undefined
      : (row: T) => [...rowCommands.rowActions(row), ...(askedRowActions?.(row) ?? [])];
  const refused = rowCommands.error === null ? null : explain(rowCommands.error);

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
      // sortable — on the server, so no `value` is given.
      sortable={sortable}
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
      filtered={listing.where !== undefined || listing.text !== ""}
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
        {actions === undefined && creating === undefined ? null : (
          <List.Actions>
            {actions}
            {creating === undefined ? null : (
              <Button role="primary" size="sm" onClick={creating}>
                {frameworkCopy().record.create}
              </Button>
            )}
          </List.Actions>
        )}
        <List.Pagination>
          {dropped.length === 0 ? null : (
            <Tag tone="warn" title={copy.dropped(dropped)}>
              {copy.dropped(dropped)}
            </Tag>
          )}
          {grouped ? (
            groups.status !== "ready" ? null : (
              <span className="text-meta text-muted">
                {groups.capped
                  ? copy.groupsCapped(groups.buckets.length)
                  : copy.groups(groups.buckets.length, records)}
              </span>
            )
          ) : listing.paging === "pages" ? (
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
                <span className="text-meta text-muted">
                  {copy.capped(listing.rows.length)}
                </span>
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
          )}
        </List.Pagination>
      </List.Bar>
      {views.includes("table") ? (
        <List.Table<T>
          columns={shown}
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
