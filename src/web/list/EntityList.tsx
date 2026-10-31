"use client";

import { type AnyRecord, nameOf } from "@sincpro/criteria";
import { RecordLink, type WorkspaceApi } from "@sincpro/web-composer";
import { frameworkCopy } from "@sincpro/web-framework/core/copy";
import { textOf, viewOf } from "@sincpro/web-framework/core/present";
import { explain } from "@sincpro/web-framework/core/transport";
import type { Listing } from "@sincpro/web-framework/react/useListing";
import { columnsOf } from "@sincpro/web-framework/web/list/columns";
import {
  EntitySearchBar,
  type NamedFilter,
} from "@sincpro/web-framework/web/list/EntitySearchBar";
import { Button, List, type ListCrumb, Pagination, SearchField, Tag } from "@sincpro/web-ui";
import { type ReactNode, useMemo, useState } from "react";

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
 * Where a record opens is the composer's question: with `api`, a row opens the page and the
 * identity column is the composer's `RecordLink` (peek, side panel, window); without it, the
 * screen passes `onOpen`.
 */
export type { NamedFilter };

export type EntityListProps<T extends AnyRecord> = {
  listing: Listing<T>;
  /**
   * The workspace this list is a view of. With it, a row opens its record as a page, the
   * identity column is the composer's `RecordLink` (peek, side panel, window on hover) and the
   * breadcrumb is the composer's — nothing for the screen to write.
   */
  api?: WorkspaceApi;
  /** The fields shown, in order. Without it, every scalar field of the model. */
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
};

type View = "table" | "rows" | "board";

export function EntityList<T extends AnyRecord>({
  listing,
  api,
  columns,
  cells,
  views = ["table"],
  title,
  description,
  crumbs,
  actions,
  onOpen,
  onPeek,
  empty,
  search = "bar",
  filters = [],
  selectable = false,
  selectionActions,
  embedded = false,
}: EntityListProps<T>) {
  const copy = frameworkCopy().list;
  const { meta, locale, count, page } = listing;
  const identity = meta?.identity ?? "id";
  const idOf = (row: T) => String(row[identity]);
  const failed = listing.status === "failed" ? explain(listing.error) : null;
  const dropped = listing.dropped.map((d) => viewOf(meta, d.field, locale).label);
  const [present, setPresent] = useState<View>(views[0] ?? "table");

  const opening =
    onOpen ?? (api ? (row: T) => api.open(listing.entity.ref(idOf(row))) : undefined);
  // A row click opens the page — the composer's one predictable gesture. web-ui's table turns a
  // row click into a PEEK whenever `onPeek` is given, so the list never passes one by itself:
  // the peek, the side panel and the window are the composer's `RecordLink` on the identity.
  const linked: typeof cells =
    api === undefined || cells?.[identity] !== undefined
      ? cells
      : {
          ...cells,
          [identity]: (row: T) => (
            <RecordLink api={api} resource={listing.entity.ref(idOf(row))}>
              {idOf(row)}
            </RecordLink>
          ),
        };
  const trail = crumbs ?? (embedded ? undefined : api?.crumbs());

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

  return (
    <List<T>
      items={listing.rows}
      keyOf={idOf}
      embedded={embedded}
      present={present}
      onPresentChange={(next) => setPresent(next as View)}
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
        loading: listing.status === "loading",
        error:
          failed === null
            ? null
            : [failed.heading, failed.sentence].filter(Boolean).join(". "),
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
            <EntitySearchBar listing={listing} filters={filters} />
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
        {actions === undefined ? null : <List.Actions>{actions}</List.Actions>}
        <List.Pagination>
          {dropped.length === 0 ? null : (
            <Tag tone="warn" title={copy.dropped(dropped)}>
              {copy.dropped(dropped)}
            </Tag>
          )}
          {listing.paging === "pages" ? (
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
      {views.includes("table") ? <List.Table<T> columns={shown} /> : null}
      {views.includes("rows") ? <List.Rows<T> row={rowOf} /> : null}
      {views.includes("board") ? <List.Board<T> /> : null}
    </List>
  );
}
