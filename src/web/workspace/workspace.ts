"use client";

import type { AnyRecord } from "@sincpro/criteria";
import type { WorkspaceApi } from "@sincpro/web-composer";
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
 *     const invoice = useRecord(invoices, resource.id);
 *     useRecordInWorkspace(api, invoice);
 */
export function useRecordInWorkspace<T extends AnyRecord>(
  api: WorkspaceApi,
  record: RecordReading<T>,
): void {
  const display = record.meta?.display || record.meta?.identity || "";
  const title =
    record.status === "ready" && display !== ""
      ? textOf(record.meta, display, (record.record as AnyRecord)[display], record.locale)
      : null;
  const dirty = record.edit.dirty;

  useEffect(() => {
    api.setTitle(title);
  }, [api, title]);
  useEffect(() => {
    api.setDirty(dirty);
    return () => api.setDirty(false);
  }, [api, dirty]);
}
