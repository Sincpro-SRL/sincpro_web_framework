"use client";
import { touches } from "@sincpro/web-framework/core/changes";
import { useFramework } from "@sincpro/web-framework/react/context";
import { useEffect, useState } from "react";

/**
 * How many times what lies at `route` was written since this screen started reading it — a
 * dependency that makes a reading read again.
 *
 *     const writes = useWrites(listRoute(entity.list));
 *     useEffect(() => { … transport.list(…) … }, [transport, route, writes]);
 *
 * Context: a screen must show what is true now, whoever wrote it — its own save, a use case run
 * from a button, a panel beside it. Every write a transport of the framework sends is announced
 * on the process's change feed (`processChanges`, @sincpro/client-framework); this follows it and
 * counts the ones that touch `route` (`touches`: the collections a write names, and an entity's
 * history). A reading adds the count to what it reads by, as it adds the company it reads in: the
 * framework's own readings do (`useListing`, `useRecord`, `useHistory`, `useGroups`, `usePivot`,
 * `useNameOf`), and so may a screen's own. It reads again on the next render, when the cache under
 * it — following the same feed — has already forgotten the old answer.
 *
 * `undefined`: nothing is read yet, and nothing is counted.
 */
export function useWrites(route: string | undefined): number {
  const { changes, entities } = useFramework();
  const [writes, setWrites] = useState(0);
  useEffect(() => {
    if (route === undefined) return;
    return changes.follow((change) => {
      if (touches(change, route, entities)) setWrites((count) => count + 1);
    });
  }, [changes, entities, route]);
  return writes;
}
