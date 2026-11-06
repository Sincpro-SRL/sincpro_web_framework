"use client";

import { type Entity, listRoute } from "@sincpro/client-framework";
import type { AnyRecord } from "@sincpro/criteria";
import { lookupOf } from "@sincpro/web-framework/core/lookup";
import { useFramework } from "@sincpro/web-framework/react/context";
import { useEffect, useState } from "react";

/**
 * The name of one record of an entity, by its key — what a field shows when it holds only the
 * key (`EntityID[Tenant]`) and not the record it points at.
 *
 * Context: asked ONCE by key, the way `useLookup` names a chosen record it never saw: a page
 * narrowed to that key, one row, read with the definition the application knows. Unnamed is no
 * error — the field shows the key — and an entity listed under another record
 * (`/tenants/{tenant_id}/members`) has no list to ask by key, so it stays unnamed.
 *
 *     const name = useNameOf(tenants, record.tenant_id) ?? record.tenant_id;
 */
export function useNameOf(entity: Entity | undefined, id: string): string | undefined {
  const { transport, metas, context } = useFramework();
  const [named, setNamed] = useState<{ id: string; name: string } | undefined>(undefined);
  useEffect(() => {
    if (entity === undefined || id === "") return;
    let route: string;
    try {
      route = listRoute(entity.list);
    } catch {
      return;
    }
    const known = metas.get(entity.key);
    const key = known?.get_id || known?.identity || "id";
    const aborter = new AbortController();
    transport
      .list<AnyRecord>(
        route,
        { selection: { field: key, operator: "=", value: id }, pagination: { limit: 1 } },
        aborter.signal,
      )
      .then((page) => {
        const [one] = lookupOf(page.meta ?? known ?? null, page.rows, entity.summary);
        if (one !== undefined) setNamed({ id, name: one.label });
      })
      .catch(() => undefined);
    return () => aborter.abort();
  }, [transport, metas, entity, id, context]);
  return named?.id === id ? named.name : undefined;
}
