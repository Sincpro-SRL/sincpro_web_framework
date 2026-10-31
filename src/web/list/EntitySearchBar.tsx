"use client";

import type { AnyRecord, Expression } from "@sincpro/criteria";
import { frameworkCopy } from "@sincpro/web-framework/core/copy";
import type { Listing } from "@sincpro/web-framework/react/useListing";
import { facetsOf, modelOf } from "@sincpro/web-framework/web/list/search";
import {
  type BuiltFilter,
  CriteriaBuilder,
  describeFilter,
  Dialog,
  filterCriteria,
  hasNamed,
  SearchBar,
  type SearchCriteria,
  toggleNamed,
  whereOf,
} from "@sincpro/web-ui";
import { useMemo, useState } from "react";

/**
 * web-ui's search bar and criteria builder, bound to a `Listing`.
 *
 * Context: this is the «search over a set» every collection screen needs — a list, the lines
 * of a record, a chooser — so it is a piece of its own, not something only `EntityList` can do.
 * A screen that writes its own `List` drops it in `List.Search` and gets the same behaviour:
 *
 *   - «search by name»: facets are the fields the entity's search template names first;
 *   - a typed question («total > 5000») is checked against each field's operators;
 *   - a named filter is one click; the builder writes what nobody foresaw (all/any/not);
 *   - everything put becomes ONE `where` the SERVER answers (`listing.filter`).
 *
 *     <List.Search><EntitySearchBar listing={listing} filters={…} /></List.Search>
 */
export type NamedFilter<T> = {
  id: string;
  label: string;
  where: Expression<T>;
};

export function EntitySearchBar<T extends AnyRecord>({
  listing,
  filters = [],
}: {
  listing: Listing<T>;
  /** The cuts this set offers by name: «sólo pagadas», «vencidas». */
  filters?: readonly NamedFilter<T>[];
}) {
  const copy = frameworkCopy().list;
  const { meta, locale } = listing;
  const [put, setPut] = useState<SearchCriteria[]>([]);
  const [building, setBuilding] = useState(false);
  const model = useMemo(() => (meta ? modelOf(meta, locale) : undefined), [meta, locale]);
  const facets = useMemo(() => (meta ? facetsOf(meta, locale) : []), [meta, locale]);

  if (model === undefined) return null;

  const place = (next: SearchCriteria[]) => {
    setPut(next);
    listing.filter(whereOf(next) as Expression<T> | undefined);
  };

  return (
    <>
      <SearchBar
        facets={facets}
        model={model}
        criteria={put}
        onCriteriaChange={place}
        placeholder={copy.searchBar}
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
                  place(toggleNamed(put, { ...named, where: named.where as BuiltFilter }));
              },
            })}
        onOpenBuilder={() => setBuilding(true)}
      />
      {building ? (
        <Dialog open width="lg" title={copy.builder} onClose={() => setBuilding(false)}>
          <CriteriaBuilder
            model={model}
            {...(whereOf(put) === undefined ? {} : { initial: { where: whereOf(put)! } })}
            onApply={(built) => {
              place(
                built?.where === undefined
                  ? []
                  : [filterCriteria(built.where, describeFilter(built.where, model))],
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
