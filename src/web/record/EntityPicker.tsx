"use client";

import type { AnyRecord } from "@sincpro/criteria";
import { nameOf } from "@sincpro/criteria";
import type { Entity } from "@sincpro/web-framework/core/entity";
import { useListing } from "@sincpro/web-framework/react/useListing";
import { useLookup } from "@sincpro/web-framework/react/useLookup";
import { EntityList } from "@sincpro/web-framework/web/list/EntityList";
import { Dialog, Picker } from "@sincpro/web-ui";
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
 * `api.pick`): pass `onOpen` / `onBrowseAll` and they replace the defaults.
 */
export function EntityPicker<T extends AnyRecord>({
  entity,
  value,
  onChange,
  onOpen,
  onBrowseAll,
  placeholder,
  disabled,
  "aria-label": ariaLabel,
}: {
  entity: Entity<T>;
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
  const lookup = useLookup(entity);
  const [choosing, setChoosing] = useState(false);
  return (
    <>
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
        onBrowseAll={onBrowseAll ?? (() => setChoosing(true))}
        {...(placeholder === undefined ? {} : { placeholder })}
        {...(disabled === undefined ? {} : { disabled })}
        {...(ariaLabel === undefined ? {} : { "aria-label": ariaLabel })}
      />
      {choosing ? (
        <Chooser
          entity={entity}
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

/** The whole set in a window: search and pages on the server, a row answers the field. */
function Chooser<T extends AnyRecord>({
  entity,
  onChoose,
  onClose,
}: {
  entity: Entity<T>;
  onChoose: (id: string) => void;
  onClose: () => void;
}) {
  const listing = useListing(entity, { pageSize: 20 });
  const key = listing.meta?.get_id || listing.meta?.identity || "id";
  return (
    <Dialog
      open
      width="lg"
      title={nameOf(listing.meta, listing.locale) || entity.kind}
      onClose={onClose}
    >
      <EntityList
        listing={listing}
        embedded
        search="box"
        onOpen={(row) => onChoose(String(row[key]))}
      />
    </Dialog>
  );
}
