"use client";

import { type Entity, keysOf, listRoute, type Selection } from "@sincpro/client-framework";
import type { AnyRecord, Criteria } from "@sincpro/criteria";
import { isList, type ListDefinition } from "@sincpro/web-framework/core/list";
import type { LookupOption } from "@sincpro/web-framework/core/lookup";
import { useFramework } from "@sincpro/web-framework/react/context";
import { BATCH_LIMIT } from "@sincpro/web-framework/react/useBatchCommand";
import { excluding, useLookup } from "@sincpro/web-framework/react/useLookup";
import { presentationOf } from "@sincpro/web-framework/web/list/presentation";
import { refusalNotice } from "@sincpro/web-framework/web/list/records";
import { chooserScopeOf, useRecordOpening } from "@sincpro/web-framework/web/record/opening";
import { type OpenTarget, type TagOption, TagsField, useToastIfAny } from "@sincpro/web-ui";
import { useRef } from "react";

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
 * Inside a workspace, opening a chip and «Buscar más…» are the workspace's (`RecordOpening`),
 * as for a many2one: a chip opens where the workspace puts it, and «Buscar más…» is the
 * entity's list opened to choose SEVERAL (`chooseMany`), offering neither what `criteria` leaves
 * out nor the chips already on — what was ticked there, or every record it matches («Elegir los
 * 37 que coinciden»), is added, at most `BATCH_LIMIT` at once (past it nothing is added and a
 * notice says why). A workspace that cannot choose several adds the one answered (`choose`).
 * `onOpen` / `onBrowseAll` replace either.
 * Without a workspace a chip is a value.
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
  const { metas, transport } = useFramework();
  const opening = useRecordOpening();
  const toast = useToastIfAny();
  const base = isList(entity) ? entity.entity : entity;
  // «Buscar más…» answers after the chooser closes: it adds to the chips on screen THEN.
  const now = useRef(value);
  now.current = value;
  const opens =
    onOpen ??
    (opening === null
      ? undefined
      : (id: string, to: OpenTarget) => opening.open(base.ref(id), to));
  /** Added after the chips on screen THEN, each once, in the order they came. */
  const add = (keys: readonly string[]) => {
    const fresh = keys.filter((key) => !now.current.includes(key));
    if (fresh.length > 0) onChange([...now.current, ...fresh]);
  };
  /** The keys of what a chooser of several answered — in hand, or read once with a ceiling. */
  const addChosen = (selection: Selection) => {
    const meta = metas.get(base.key);
    keysOf(selection, {
      transport,
      route: listRoute(base.list),
      identity: meta?.get_id || meta?.identity || "id",
      limit: BATCH_LIMIT,
    }).then(add, (failure: unknown) => toast?.show(refusalNotice(failure)));
  };
  const scope = () => chooserScopeOf(entity, excluding(criteria, value, metas.get(base.key)));
  const { choose, chooseMany } = opening ?? {};
  const browseAll =
    onBrowseAll ??
    (chooseMany !== undefined
      ? (query: string) => chooseMany(base, addChosen, query, scope())
      : choose === undefined
        ? undefined
        : (query: string) => choose(base, (id) => add([id]), query, scope()));
  const lookup = useLookup(entity, {
    ...(criteria === undefined ? {} : { criteria }),
    values: value,
  });
  const person = base.summary.person === true;
  const look = presentationOf(entity).option;
  // A chip says a name and shows a face; the list under it also the datum that tells two apart
  // (web-ui 1.5 `TagOption.meta`, never on the chip). Of the entity's look of a choice, those
  // three — as text: a tag option is plain.
  const asTag = (one: LookupOption): TagOption => {
    const own = look === undefined || one.record === undefined ? {} : look(one.record as T);
    const avatar = own.avatar ?? (person ? (one.image ?? true) : undefined);
    const meta = typeof own.meta === "string" ? own.meta : one.detail;
    return {
      value: one.id,
      label: own.name ?? one.label,
      ...(avatar === undefined ? {} : { avatar }),
      ...(meta === undefined || meta === "" ? {} : { meta }),
    };
  };
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
      {...(opens === undefined ? {} : { onOpen: opens })}
      {...(openTarget === undefined ? {} : { openTarget })}
      {...(browseAll === undefined ? {} : { onBrowseAll: browseAll })}
      {...(placeholder === undefined ? {} : { placeholder })}
      {...(disabled === undefined ? {} : { disabled })}
      {...(ariaLabel === undefined ? {} : { "aria-label": ariaLabel })}
    />
  );
}
