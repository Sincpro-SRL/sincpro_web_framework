"use client";

import type { AnyRecord, Criteria } from "@sincpro/criteria";
import type { Entity } from "@sincpro/web-framework/core/entity";
import { isList, type ListDefinition } from "@sincpro/web-framework/core/list";
import type { LookupOption } from "@sincpro/web-framework/core/lookup";
import { useLookup } from "@sincpro/web-framework/react/useLookup";
import { type OpenTarget, type TagOption, TagsField } from "@sincpro/web-ui";

/**
 * A many2many: put SEVERAL records of an entity on this one — the followers of an invoice,
 * the products of a promotion — as web-ui's `TagsField` chips, fed by `useLookup`.
 *
 * Context: the same literal search as a many2one, for N. The field opens on the first ten in
 * the entity's order, and what is typed is asked of the SERVER (`TagsField onSearch`): a
 * product among three thousand is found by its code though no chip shows it. The chosen never
 * come back as options, and they keep their names wherever they lie — remembered, or asked
 * once by their keys. A person or a company (`entity(…, { summary: { person: true } })`) is
 * chosen by their face.
 *
 * Opening a chip is the composer's (`onOpen` — a preview by default: a chip is a glance at one
 * of many), and «Buscar más…» is the list that adds (`onBrowseAll`, `api.pick` with the list in
 * its choosing mode). Without a workspace a chip is a value.
 *
 *     <EntityTags entity={people} value={followers} onChange={setFollowers} />
 */
export function EntityTags<T extends AnyRecord>({
  entity,
  value,
  onChange,
  criteria,
  onOpen,
  openTarget,
  onBrowseAll,
  placeholder,
  disabled,
  "aria-label": ariaLabel,
}: {
  /** What is chosen from: an entity, or a named list of it. */
  entity: Entity<T> | ListDefinition<T>;
  /** The keys chosen, in the order they were added — what the backend stores. */
  value: readonly string[];
  onChange: (next: string[]) => void;
  /** Which records may be put at all: applied by the server under what is typed. */
  criteria?: Criteria<T>;
  /** Open the record behind a chip — in composer, `(id, to) => openIn(api, entity.ref(id), to)`. */
  onOpen?: (id: string, to: OpenTarget) => void;
  openTarget?: OpenTarget;
  /** «Buscar más…»: the list that adds several at once, opened on what was typed. */
  onBrowseAll?: (query: string) => void;
  placeholder?: string;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const lookup = useLookup(entity, {
    ...(criteria === undefined ? {} : { criteria }),
    values: value,
  });
  const person = (isList(entity) ? entity.entity : entity).summary.person === true;
  const asTag = (one: LookupOption): TagOption => ({
    value: one.id,
    label: one.label,
    ...(person ? { avatar: one.image ?? true } : {}),
  });
  const offered = new Set(lookup.options.map((one) => one.id));
  // The chosen ride along for their labels; the field never offers them again.
  const options = [
    ...lookup.options.map(asTag),
    ...lookup.chosenAll.filter((one) => !offered.has(one.id)).map(asTag),
  ];
  return (
    <TagsField
      value={value}
      onChange={onChange}
      options={options}
      {...(lookup.searchable ? { onSearch: lookup.search } : {})}
      {...(onOpen === undefined ? {} : { onOpen })}
      {...(openTarget === undefined ? {} : { openTarget })}
      {...(onBrowseAll === undefined ? {} : { onBrowseAll })}
      {...(placeholder === undefined ? {} : { placeholder })}
      {...(disabled === undefined ? {} : { disabled })}
      {...(ariaLabel === undefined ? {} : { "aria-label": ariaLabel })}
    />
  );
}
