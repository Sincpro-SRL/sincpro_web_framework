"use client";

import { type AnyRecord, type Meta, nameOf } from "@sincpro/criteria";
import {
  type ResourceRef,
  useWorkspaceContext,
  type WorkspaceApi,
} from "@sincpro/web-composer";
import { frameworkCopy } from "@sincpro/web-framework/core/copy";
import type { Entity } from "@sincpro/web-framework/core/entity";
import { textOf } from "@sincpro/web-framework/core/present";
import type { RecordReading } from "@sincpro/web-framework/react/useRecord";
import { useEffect } from "react";

/**
 * A record told to the workspace it is open in: its real name and whether it holds unsaved work.
 *
 * Context: the composer 1.0 lets a view say both (`setTitle`, `setDirty`). The name replaces the
 * reference in the breadcrumb, the panel frame and ⌘K once the record is read — «Globex Bolivia»
 * instead of «C-004». «Dirty» makes a crumb, a close or the browser's Back ask before throwing
 * away what was typed. The record already knows both (its `display`, its `edit.dirty`), so the
 * screen only has to connect them — one line.
 *
 * A NEW record (opened with `entity.newRef()`) reads «Facturas · nuevo» until it exists; the
 * moment its create answers, the surface is REPLACED by the record it became (`api.replace`):
 * no crumb leads back to an empty form, and the window, peek or page it was in stays.
 *
 *     const invoice = useRecord(invoices, resource.id ?? "");
 *     useRecordInWorkspace(api, invoice);
 */
export function useRecordInWorkspace<T extends AnyRecord>(
  api: WorkspaceApi,
  record: RecordReading<T>,
): void {
  const display = record.meta?.display || record.meta?.identity || "";
  const title = record.isNew
    ? newTitle(record.meta, record.locale)
    : record.status === "ready" && display !== ""
      ? textOf(record.meta, display, (record.record as AnyRecord)[display], record.locale)
      : null;
  const dirty = record.edit.dirty;
  const opened = api.self.id ?? "";
  const { entity, id } = record;

  // Created here: show what it became, in place of the form.
  useEffect(() => {
    if (opened === "" && id !== "") api.replace(entity.ref(id));
  }, [api, opened, entity, id]);

  useEffect(() => {
    api.setTitle(title);
  }, [api, title]);
  useEffect(() => {
    api.setDirty(dirty);
    return () => api.setDirty(false);
  }, [api, dirty]);
}

function newTitle(meta: Meta | null, locale: string | undefined): string {
  return frameworkCopy().record.creating(nameOf(meta, locale) || "");
}

/**
 * «Browse everything» of an `EntityPicker` as the composer's chooser: the entity's own list
 * opens in a window and the row clicked there answers the field.
 *
 *     <EntityPicker entity={customers} onChange={set} onBrowseAll={chooserIn(api, customers, set)} />
 */
export function chooserIn<T extends AnyRecord>(
  api: WorkspaceApi,
  entity: Entity<T>,
  onChange: (id: string) => void,
  options?: Parameters<WorkspaceApi["pick"]>[2],
): () => void {
  return () =>
    api.pick(entity.chooserRef(), (ref) => ref.id === undefined || onChange(ref.id), options);
}

/**
 * The record of an entity the person is on right now — what a detail panel beside a list
 * follows, without knowing the list.
 *
 * Context: a list publishes what is ticked (`api.select`) and the workspace knows what is
 * focused; both are references (`domain:kind/id`). A panel that shows «the invoice I am on»
 * only needs the last one of ITS entity: the last ticked, else the focused record. It redraws
 * when either changes (composer's `useWorkspaceContext`), and is `undefined` when the person is
 * on none — the panel says so.
 *
 *     function Detail({ api }: ViewProps) {
 *       const id = useFollowed(api, invoices);
 *       const invoice = useRecord(invoices, id ?? "");   // or «tick an invoice»
 *     }
 */
export function useFollowed<T extends AnyRecord>(
  api: WorkspaceApi,
  entity: Entity<T>,
): string | undefined {
  const { focused, selection } = useWorkspaceContext(api);
  const mine = (ref: ResourceRef | null | undefined): ref is ResourceRef =>
    ref != null &&
    ref.domain === entity.domain &&
    ref.kind === entity.kind &&
    ref.id !== undefined;
  const ticked = [...selection].reverse().find(mine);
  return ticked?.id ?? (mine(focused) ? focused.id : undefined);
}
