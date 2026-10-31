"use client";

import { type AnyRecord, nameOf } from "@sincpro/criteria";
import { RecordLink, useCrumbs, type WorkspaceApi } from "@sincpro/web-composer";
import { frameworkCopy } from "@sincpro/web-framework/core/copy";
import { PICK_PARAM } from "@sincpro/web-framework/core/entity";
import type { NamedFilter } from "@sincpro/web-framework/core/list";
import { textOf, viewOf } from "@sincpro/web-framework/core/present";
import { explain } from "@sincpro/web-framework/core/transport";
import { useGroups } from "@sincpro/web-framework/react/useGroups";
import type { Listing } from "@sincpro/web-framework/react/useListing";
import { columnsOf } from "@sincpro/web-framework/web/list/columns";
import { EntitySearchBar } from "@sincpro/web-framework/web/list/EntitySearchBar";
import { pilesOf } from "@sincpro/web-framework/web/list/groups";
import { type RowCommand, useRowCommands } from "@sincpro/web-framework/web/list/rowCommands";
import {
  Button,
  Callout,
  List,
  type ListCrumb,
  Pagination,
  type RowAction,
  SearchField,
  Tag,
} from "@sincpro/web-ui";
import { type ReactNode, useEffect, useMemo, useState } from "react";

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
 * when it is opened. Grouped, the list shows rows: web-ui's table groups the page it holds.
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

export type EntityListProps<T extends AnyRecord> = {
  listing: Listing<T>;
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
   * its facts, what a narrow panel wants) and `board` (cards). The same set, the same search,
   * the same page in each.
   */
  views?: readonly ("table" | "rows" | "board")[];
  /** Without it, the model's own name. */
  title?: string;
  description?: string;
  crumbs?: readonly ListCrumb[];
  actions?: ReactNode;
  onOpen?: (row: T) => void;
  onPeek?: (row: T) => void;
  /** What an empty list says. */
  empty?: string;
  /**
   * `"bar"` (the default) is the full search bar with the criteria builder; `"box"` is one
   * text box over the entity's search template — a chooser, a narrow panel; `false` is none.
   */
  search?: "bar" | "box" | false;
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
  commands?: readonly RowCommand<T>[];
  /** Any other action of a row — or the commands built by hand with `useRowCommands`. */
  rowActions?: (row: T) => readonly RowAction[];
};

/** No commands: one constant, so the hook is not handed a new array on every render. */
const NO_COMMANDS: readonly never[] = [];

type View = "table" | "rows" | "board";

export function EntityList<T extends AnyRecord>({
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
  empty,
  search = "bar",
  filters: askedFilters,
  selectable = false,
  selectionActions,
  embedded = false,
  create = true,
  commands = NO_COMMANDS,
  rowActions: askedRowActions,
}: EntityListProps<T>) {
  // A named list (`defineList`) brings its own columns, filters, faces and words; what the
  // screen passes wins.
  const definition = listing.definition;
  const columns = askedColumns ?? definition?.columns;
  const views = askedViews ?? definition?.views ?? ["table"];
  const filters = askedFilters ?? definition?.filters ?? [];
  const title = askedTitle ?? definition?.title;
  const description = askedDescription ?? definition?.description;
  const copy = frameworkCopy().list;
  const { meta, locale, count, page } = listing;
  const identity = meta?.identity ?? "id";
  const idOf = (row: T) => String(row[identity]);
  const failed = listing.status === "failed" ? explain(listing.error) : null;
  const dropped = listing.dropped.map((d) => viewOf(meta, d.field, locale).label);
  const [present, setPresent] = useState<View>(views[0] ?? "table");

  // Opened by `api.pick` (`entity.chooserRef()`): a row ANSWERS whoever asked, it does not open.
  const choosing = api?.self.params?.[PICK_PARAM] !== undefined;
  const opening =
    onOpen ??
    (api === undefined
      ? undefined
      : choosing
        ? (row: T) => api.answer(listing.entity.ref(idOf(row)))
        : (row: T) => api.open(listing.entity.ref(idOf(row))));
  const creating =
    create &&
    api !== undefined &&
    !choosing &&
    !embedded &&
    listing.entity.create !== undefined
      ? () => api.open(listing.entity.newRef())
      : undefined;
  // A row click opens the page — the composer's one predictable gesture. web-ui's table turns a
  // row click into a PEEK whenever `onPeek` is given, so the list never passes one by itself:
  // the peek, the side panel and the window are the composer's `RecordLink` on the identity.
  const linked: typeof cells =
    api === undefined || choosing || cells?.[identity] !== undefined
      ? cells
      : {
          ...cells,
          [identity]: (row: T) => (
            <RecordLink api={api} resource={listing.entity.ref(idOf(row))}>
              {idOf(row)}
            </RecordLink>
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
    [meta, locale, names, cells, api],
  );

  // A row and a card read the record by its display and the first fields shown beside it.
  const display = meta?.display || identity;
  const facts = shown
    .filter((c) => c.id !== display && c.id !== identity && !c.defaultHidden)
    .slice(0, 3);
  const rowOf = (row: T) => ({
    name: textOf(meta, display, row[display], locale) ?? idOf(row),
    meta: [
      ...(display === identity ? [] : [idOf(row)]),
      ...facts.map((c) => textOf(meta, c.id, row[c.id], locale)).filter(Boolean),
    ].join(" · "),
  });

  // Grouped: the SERVER counts the groups; a group's rows are read when it is opened, so every
  // group starts closed. web-ui's table groups the rows it holds — the page — so a grouped list
  // shows rows, the face that draws the piles it is given.
  const groups = useGroups(listing);
  const grouped = groups.levels.length > 0;
  const { piles, bucketAt } = pilesOf(
    groups.buckets,
    groups.levels,
    meta,
    locale,
    groups.rowsOf,
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
      present={grouped ? "rows" : present}
      onPresentChange={(next) => setPresent(next as View)}
      {...grouping}
      sort={
        listing.order === null
          ? null
          : { key: listing.order.field, direction: listing.order.descending ? "desc" : "asc" }
      }
      onSortChange={(next) =>
        listing.orderBy(
          next === null ? null : { field: next.key, descending: next.direction === "desc" },
        )
      }
      state={{
        loading: grouped ? groups.status === "loading" : listing.status === "loading",
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
      {...(onPeek === undefined ? {} : { onPeek })}
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
            <EntitySearchBar listing={listing} filters={filters} groups={groups} />
          </List.Search>
        ) : null}
        {search === "box" && meta?.search != null ? (
          <List.Search>
            <SearchField
              value={listing.text}
              onChange={listing.search}
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
          there. It is also the face that shows groups the server counted. */}
      <List.Rows<T> row={rowOf} />
      {views.includes("board") ? <List.Board<T> /> : null}
      {refused === null ? null : (
        <Callout tone="bad" title={refused.heading}>
          {refused.sentence}
        </Callout>
      )}
    </List>
  );
}
