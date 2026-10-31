"use client";

import type { AnyRecord, Criteria } from "@sincpro/criteria";
import { nameOf } from "@sincpro/criteria";
import { frameworkCopy } from "@sincpro/web-framework/core/copy";
import type { Entity } from "@sincpro/web-framework/core/entity";
import { isList, type ListDefinition } from "@sincpro/web-framework/core/list";
import { useListing } from "@sincpro/web-framework/react/useListing";
import { useLookup } from "@sincpro/web-framework/react/useLookup";
import { EntityList } from "@sincpro/web-framework/web/list/EntityList";
import { Dialog, IconButton, Picker } from "@sincpro/web-ui";
import { TextSearch } from "lucide-react";
import { useState } from "react";

/**
 * A many2one: pick ONE record of an entity — web-ui's `Picker` fed by `useLookup`, with a way
 * into the whole set however big it is.
 *
 * Context: two ways to choose, for two sizes. The picker holds the first page of choices and
 * narrows it as you type — instant for a set of tens. For a set of millions, «browse
 * everything» opens a chooser: the entity's full list, searched, ordered and paged by the
 * SERVER, where clicking a row answers the field. web-ui's `Picker` keeps what is typed to
 * itself and cannot ask the server by text; the chooser is how this scales without it.
 *
 * Inside a workspace, «open» and the chooser can be the composer's instead (`api.open`,
 * `api.pick`): pass `onOpen` / `onBrowseAll` and they replace the defaults — `chooserIn(api,
 * entity, onChange)` is that `onBrowseAll`.
 *
 * `criteria` narrows what may be chosen — the contacts of the chosen customer — in the picker
 * and in its chooser alike; the server applies it, and a new one starts the choices over. A
 * named list (`defineList`) does the same declared once: «active customers» brings its cut, its
 * columns and its title to the chooser.
 *
 * The chooser is ALWAYS one click away (`browse`, on by default): web-ui's `Picker` offers
 * «see all…» only while it holds rows it does not draw, so with a short first page there was no
 * way to the server's literal search. The chooser is a table — the columns the list declares,
 * or `columns` — searched by the entity's literal search on the server.
 *
 *     <EntityPicker entity={customers} value={id} onChange={set} />
 *     <EntityPicker entity={activeCustomers} columns={["name", "tax_id", "city"]} … />
 */
export function EntityPicker<T extends AnyRecord>({
  entity,
  value,
  onChange,
  onOpen,
  onBrowseAll,
  criteria,
  columns,
  browse = true,
  placeholder,
  disabled,
  "aria-label": ariaLabel,
}: {
  /** What is chosen from: an entity, or a named list of it (its cut, columns and title). */
  entity: Entity<T> | ListDefinition<T>;
  /** The chooser's columns. Without it, the named list's, or every scalar field. */
  columns?: readonly string[];
  /** A button beside the field that opens the chooser: the server's literal search, as a table. */
  browse?: boolean;
  /** Which records may be chosen at all: applied by the server under what is typed. */
  criteria?: Criteria<T>;
  value?: string;
  onChange: (id: string) => void;
  /** Open the chosen record — in composer, `(id) => api.open(entity.ref(id), { to: "window" })`. */
  onOpen?: (id: string) => void;
  /** Replace the built-in chooser — in composer, `api.pick(entity.ref(), …)`. */
  onBrowseAll?: () => void;
  placeholder?: string;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const lookup = useLookup(entity, criteria === undefined ? {} : { criteria });
  const [choosing, setChoosing] = useState(false);
  const browseAll = onBrowseAll ?? (() => setChoosing(true));
  const picker = (
    <Picker
      items={lookup.options.map((one) => ({
        id: one.id,
        name: one.label,
        ...(one.detail === undefined ? {} : { meta: one.detail, haystack: one.detail }),
      }))}
      {...(value === undefined ? {} : { value })}
      onChange={onChange}
      loading={lookup.loading}
      // No «load more»: web-ui's Picker offers «see all…» only while it holds rows it does not
      // draw, and an incremental list never does. Past the first page, the chooser is the way.
      {...(onOpen === undefined ? {} : { onOpen })}
      onBrowseAll={browseAll}
      {...(placeholder === undefined ? {} : { placeholder })}
      {...(disabled === undefined ? {} : { disabled })}
      {...(ariaLabel === undefined ? {} : { "aria-label": ariaLabel })}
    />
  );
  return (
    <>
      {browse ? (
        <span className="flex min-w-0 items-start gap-1">
          <span className="min-w-0 flex-1">{picker}</span>
          <IconButton
            icon={TextSearch}
            label={frameworkCopy().picker.browse}
            onClick={browseAll}
            {...(disabled === undefined ? {} : { disabled })}
          />
        </span>
      ) : (
        picker
      )}
      {choosing ? (
        <Chooser
          entity={entity}
          {...(columns === undefined ? {} : { columns })}
          {...(criteria === undefined ? {} : { criteria })}
          onChoose={(id) => {
            onChange(id);
            setChoosing(false);
          }}
          onClose={() => setChoosing(false)}
        />
      ) : null}
    </>
  );
}

/** The whole set in a window, as a table: literal search and pages on the server, a row
 *  answers the field. */
function Chooser<T extends AnyRecord>({
  entity,
  columns,
  criteria,
  onChoose,
  onClose,
}: {
  entity: Entity<T> | ListDefinition<T>;
  columns?: readonly string[];
  criteria?: Criteria<T>;
  onChoose: (id: string) => void;
  onClose: () => void;
}) {
  const listing = useListing(entity, {
    pageSize: 20,
    ...(criteria === undefined ? {} : { criteria }),
  });
  const key = listing.meta?.get_id || listing.meta?.identity || "id";
  return (
    <Dialog
      open
      width="lg"
      title={
        (isList(entity) ? entity.title : nameOf(listing.meta, listing.locale)) ||
        listing.entity.kind
      }
      onClose={onClose}
    >
      <EntityList
        listing={listing}
        embedded
        search="box"
        {...(columns === undefined ? {} : { columns })}
        onOpen={(row) => onChoose(String(row[key]))}
      />
    </Dialog>
  );
}
