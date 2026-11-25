"use client";

import { type AnyRecord, type Expression, matching } from "@sincpro/criteria";
import { frameworkCopy } from "@sincpro/web-framework/core/copy";
import type { GroupLevel, NamedFilter } from "@sincpro/web-framework/core/list";
import type { Groups } from "@sincpro/web-framework/react/useGroups";
import type { Listing } from "@sincpro/web-framework/react/useListing";
import { groupableOf } from "@sincpro/web-framework/web/list/groups";
import {
  useLoadModel,
  useRecordsBrowser,
  useSearchRecords,
} from "@sincpro/web-framework/web/list/records";
import { facetsOf, modelOf } from "@sincpro/web-framework/web/list/search";
import {
  type BuiltFilter,
  CriteriaBuilder,
  describeFilter,
  Dialog,
  fillCopy,
  filterCriteria,
  GroupingLevels,
  hasNamed,
  SearchBar,
  type SearchCriteria,
  selectionOf,
  toggleNamed,
  useGroupingControl,
  useSearchSettings,
  useUiCopy,
} from "@sincpro/web-ui";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * web-ui's search bar and criteria builder, bound to a `Listing`.
 *
 * Context: this is the «search over a set» every collection screen needs — a list, the lines
 * of a record, a chooser — so it is a piece of its own, not something only `EntityList` can do.
 * A screen that writes its own `List` drops it in `List.Search` and gets the same behaviour:
 *
 *   - a free text is the entity's LITERAL search — its whole template, every field at once
 *     (sincpro_framework's `LiteralSearch`, the same question a many2one and ⌘K ask): it is
 *     what Enter puts, unless the model reads the text as a question of its own;
 *   - «search by name»: facets are the fields the screen names (`facets`), else the ones the
 *     entity's search template names — never every text field;
 *   - a typed question («total > 5000») is checked against each field's operators;
 *   - a relation unfolds into its RECORDS that match what was typed — «andres» → the customers
 *     —, chosen by key and read by name («Cliente: Andrés Pérez»), and an enum into its words
 *     («Estado: Pagada», sent as `paid`): the related entity's literal search
 *     (`useSearchRecords`), unless the application put its own in a web-ui `SearchProvider`;
 *     inside a workspace, «Buscar más…» under them opens the entity's list to choose
 *     (`useRecordsBrowser`) — the bar's, never the builder's: the builder is a modal dialog, and
 *     what opens outside one cannot be used;
 *   - the builder walks relations — «Cliente › País» — through the models along the path
 *     (`useLoadModel`), and picks the related records themselves;
 *   - a named filter is one click; the builder writes what nobody foresaw (all/any/not);
 *   - everything put becomes ONE `selection` the SERVER answers (`listing.filter`) — web-ui
 *     writes it in criteria's own shape, a filter through a relation included;
 *   - with `groups`, «Group by» offers the fields the model says may split the set, and the
 *     SERVER counts the groups (`useGroups`).
 *
 *     <List.Search><EntitySearchBar listing={listing} filters={…} /></List.Search>
 */
export type { NamedFilter };

/** No grouping: one constant, so the control is not handed a new array on every render. */
const NO_LEVELS: readonly GroupLevel[] = [];

export function EntitySearchBar<T extends AnyRecord>({
  listing,
  filters = [],
  groups,
  groupable: only,
  facets: named,
  seed,
  recentKey,
}: {
  listing: Listing<T>;
  /** The cuts this set offers by name: «sólo pagadas», «vencidas». */
  filters?: readonly NamedFilter<T>[];
  /** The grouping of the same set (`useGroups(listing)`): offers «Group by». */
  groups?: Groups<T>;
  /** The fields «Group by» offers, in this order — among those the model lets split the set.
   *  Without it, every one it does. */
  groupable?: readonly string[];
  /** The fields a typed text is offered to be looked up in, in order. Without it, the ones the
   *  entity's search template names, else its display (`facetsOf`). */
  facets?: readonly string[];
  /** A text to start on, put as the literal search chip — what was typed in a picker whose
   *  «Buscar más…» opened this list. */
  seed?: string;
  /** Under which name this bar remembers, in this browser, the last searches put — offered
   *  when the empty bar takes the focus («Recientes», web-ui 2.14). Without it nothing is
   *  remembered: what was searched may name a customer, and only the application knows
   *  whether its browsers may keep that. */
  recentKey?: string;
}) {
  const copy = frameworkCopy().list;
  const { meta, locale } = listing;
  const [put, setPut] = useState<SearchCriteria[]>([]);
  const [building, setBuilding] = useState(false);
  const model = useMemo(() => (meta ? modelOf(meta, locale) : undefined), [meta, locale]);
  // Compared by content: a screen usually writes the list inline.
  const naming = named?.join("\u0000");
  const facets = useMemo(
    () => (meta ? facetsOf(meta, locale, named) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meta, locale, naming],
  );
  // The bar's model: its text fields are only the facets — every other one is the builder's.
  const asked = useMemo(
    () =>
      meta
        ? modelOf(
            meta,
            locale,
            facets.map((one) => one.id),
          )
        : undefined,
    [meta, locale, facets],
  );
  const groupable = useMemo(() => groupableOf(meta, locale, only), [meta, locale, only]);
  const ui = useUiCopy();
  // The application's own search of records wins; the framework's is the default.
  const framework = useSearchRecords();
  const searchRecords = useSearchSettings().searchRecords ?? framework;
  const browseRecords = useRecordsBrowser();
  const loadModel = useLoadModel(meta);
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || seed === undefined || seed === "" || meta?.search == null) return;
    seeded.current = true;
    const literal = matching(meta, seed).selection as BuiltFilter | undefined;
    if (literal === undefined) return;
    const chip = filterCriteria(literal, fillCopy(ui.search.literalChip, { text: seed }));
    setPut([chip]);
    listing.filter(selectionOf([chip]) as Expression<T> | undefined);
    // Once the definition is known; what the person changes afterwards is theirs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, seed]);
  const control = useGroupingControl({
    levels: groups?.levels ?? NO_LEVELS,
    onLevelsChange: (next) => groups?.group(next),
  });

  if (model === undefined) return null;

  const place = (next: SearchCriteria[]) => {
    setPut(next);
    listing.filter(selectionOf(next) as Expression<T> | undefined);
  };
  // What the bar holds, as one selection: what the builder opens on.
  const current = selectionOf(put);

  return (
    <>
      <SearchBar
        facets={facets}
        model={asked ?? model}
        criteria={put}
        onCriteriaChange={place}
        placeholder={copy.searchBar}
        searchRecords={searchRecords}
        {...(browseRecords === null ? {} : { browseRecords })}
        {...(filters.length === 0
          ? {}
          : {
              filters: [
                {
                  options: filters.map((one) => ({
                    id: one.id,
                    label: one.label,
                    checked: hasNamed(put, one.id),
                  })),
                },
              ],
              onFilterSelect: (id: string) => {
                const named = filters.find((one) => one.id === id);
                if (named !== undefined)
                  place(
                    toggleNamed(put, {
                      id: named.id,
                      label: named.label,
                      selection: named.selection as BuiltFilter,
                    }),
                  );
              },
            })}
        {...(groups === undefined || groupable.length === 0
          ? {}
          : { grouping: <GroupingLevels fields={groupable} control={control} /> })}
        onOpenBuilder={() => setBuilding(true)}
        {...(recentKey === undefined ? {} : { recentKey })}
        {...(meta?.search == null
          ? {}
          : {
              literal: (text: string) =>
                (matching(meta, text).selection as BuiltFilter | undefined) ?? null,
            })}
      />
      {building ? (
        <Dialog open width="lg" title={copy.builder} onClose={() => setBuilding(false)}>
          <CriteriaBuilder
            model={model}
            searchRecords={searchRecords}
            {...(loadModel === undefined ? {} : { loadModel })}
            // What is on: the filter AND the order, by as many fields as were asked — the
            // builder writes `order: [...]` and it goes to the server whole.
            {...(current === undefined && listing.order.length === 0
              ? {}
              : {
                  initial: {
                    ...(current === undefined ? {} : { selection: current }),
                    ...(listing.order.length === 0
                      ? {}
                      : {
                          order: listing.order.map((one) => ({
                            field: String(one.field),
                            ...(one.descending === true ? { descending: true } : {}),
                          })),
                        }),
                  },
                })}
            // The chip reads as the builder says it — a chosen record by its name, never its key.
            onApply={(built, said) => {
              place(
                built?.selection === undefined
                  ? []
                  : [
                      filterCriteria(
                        built.selection,
                        said ?? describeFilter(built.selection, model),
                      ),
                    ],
              );
              listing.orderBy(
                (built?.order ?? []).map((one) => ({
                  field: one.field,
                  ...(one.descending === true ? { descending: true } : {}),
                })) as never,
              );
              setBuilding(false);
            }}
            onCancel={() => setBuilding(false)}
          />
        </Dialog>
      ) : null}
    </>
  );
}
