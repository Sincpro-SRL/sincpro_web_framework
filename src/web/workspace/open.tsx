"use client";

import type { AnyRecord, Meta } from "@sincpro/criteria";
import type { OpenOptions, ResourceRef, WorkspaceApi } from "@sincpro/web-composer";
import type { Entity } from "@sincpro/web-framework/core/entity";
import { useSummaryOf } from "@sincpro/web-framework/react/useSummary";
import { relationOf } from "@sincpro/web-framework/web/record/summary";
import { type OpenTarget, RelationValue } from "@sincpro/web-ui";
import type { ReactNode } from "react";

/**
 * Where a record opens, in the words of web-ui (`OpenTarget`) and the workspace of composer.
 *
 * Context: web-ui only SAYS where the person asked to open something — the name of a many2one
 * opens in the first of its `openTargets`, «Abrir en…» offers the rest — and composer decides
 * what each place is. This is the one translation between them, so every screen agrees:
 *
 * - a related record opens in a MODAL over the surface that asked: the person was doing
 *   something here, and comes back to exactly where they were;
 * - from INSIDE a modal it opens beside or as a preview, never a modal over a modal (a second
 *   one would replace the first, and what was typed in it is lost) — composer says where a
 *   view is (`api.over`), so no screen has to;
 * - a modal is the size of a record unless the caller says otherwise.
 *
 * The phone is composer's: a modal becomes a sheet, a side panel the page. No view asks.
 */

/** A record's form fits; a short task (register a payment) passes its own size. */
export const RECORD_SIZE = { w: 760, h: 560 } as const;

const IN_PLACE: readonly OpenTarget[] = ["modal", "peek", "side", "page"];
const FROM_A_MODAL: readonly OpenTarget[] = ["side", "peek", "page"];

/** Where a related record may open from this view, the default first. */
export function targetsFor(api: Pick<WorkspaceApi, "over">): readonly OpenTarget[] {
  return api.over === null ? IN_PLACE : FROM_A_MODAL;
}

/** web-ui's target as composer's options. Destinations share their names, so only the size is
 *  added — to the two that have one. */
export function openOptions(
  to: OpenTarget,
  size: { w: number; h: number } = RECORD_SIZE,
): OpenOptions {
  return to === "modal" || to === "window" ? { to, size } : { to };
}

/**
 * Open a record where it was asked, or where it belongs from here.
 *
 *     <RelationValue onOpenIn={(to) => openIn(api, clientes.ref(id), to)} />
 *     openIn(api, pagoRef, "modal", { w: 640, h: 460 })   // a short task, at its own size
 */
export function openIn(
  api: Pick<WorkspaceApi, "open" | "over">,
  ref: ResourceRef,
  to?: OpenTarget,
  size?: { w: number; h: number },
): void {
  const targets = targetsFor(api);
  const where = to === undefined || !targets.includes(to) ? targets[0] : to;
  api.open(ref, openOptions(where ?? "page", size));
}

/**
 * A record this one points at — the customer of an invoice — read and opened: its name as a
 * link, its face and what it is, the summary that floats from the name, and «Abrir en…».
 *
 * `value` is what the server sent for the many2one: the record it points at (expanded), or its
 * key alone. Its model is the one this application knows for `entity`, unless given.
 *
 *     <RelatedRecord api={api} entity={clientes} value={factura.record.customer} />
 */
export function RelatedRecord<T extends AnyRecord>({
  api,
  entity,
  value,
  meta,
  editor,
}: {
  api: WorkspaceApi;
  entity: Entity<T>;
  value: AnyRecord | string | null | undefined;
  meta?: Meta | null;
  /** The control that edits the relation — an `EntityPicker` — drawn in a form's edit mode. */
  editor?: ReactNode;
}) {
  const summarize = useSummaryOf(entity);
  const extra = editor === undefined ? {} : { editor };
  if (value === null || value === undefined || value === "")
    return <RelationValue name={null} {...extra} />;
  const summary = summarize(typeof value === "string" ? { id: value } : value, meta);
  return (
    <RelationValue
      {...relationOf(summary)}
      onOpenIn={(to) => openIn(api, entity.ref(summary.id), to)}
      openTargets={targetsFor(api)}
      {...extra}
    />
  );
}
