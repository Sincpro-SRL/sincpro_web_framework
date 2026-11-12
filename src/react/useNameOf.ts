"use client";

import { type Entity, listRoute } from "@sincpro/client-framework";
import { useFramework } from "@sincpro/web-framework/react/context";
import { useWrites } from "@sincpro/web-framework/react/useWrites";
import { useEffect, useState } from "react";

/**
 * The name of one record of an entity, by its key — what a field shows when it holds only the
 * key (`EntityID[Tenant]`) and not the record it points at.
 *
 * Context: every name on screen is asked through the provider's book (`nameBook`): the keys asked
 * in the same moment — a page of 50 rows naming 50 tenants — go in ONE request per entity, and a
 * name already known is shared by every place that shows it. A write to the entity (a rename)
 * asks again. Unnamed is no error — the field shows the key — and an entity listed under another
 * record (`/tenants/{tenant_id}/members`) has no list to ask by key, so it stays unnamed.
 *
 *     const name = useNameOf(tenants, record.tenant_id) ?? record.tenant_id;
 */
export function useNameOf(entity: Entity | undefined, id: string): string | undefined {
  const { names, context } = useFramework();
  const [named, setNamed] = useState<{ id: string; name: string } | undefined>(undefined);
  const writes = useWrites(entity === undefined ? undefined : routeOf(entity));
  useEffect(() => {
    if (entity === undefined || id === "") return;
    let current = true;
    void names.nameOf(entity, id).then((name) => {
      if (current && name !== undefined) setNamed({ id, name });
    });
    return () => void (current = false);
    // `context` and `writes` ask again: another company, or a write to the entity (a rename).
  }, [names, entity, id, context, writes]);
  return named?.id === id ? named.name : undefined;
}

/** Where `entity` is listed — or nothing to follow when it is listed only under a record. */
function routeOf(entity: Entity): string | undefined {
  try {
    return listRoute(entity.list);
  } catch {
    return undefined;
  }
}
