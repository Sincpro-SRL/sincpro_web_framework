"use client";

import type { Context, ContextValues } from "@sincpro/client-framework";
import { useSyncExternalStore } from "react";

/**
 * The values of one level of the context, drawn again whenever they change.
 *
 *     const { company_id } = useContextValues(processContext);   // the company picker changed it
 *     const own = useContextValues(project.context);              // only what «project» runs with
 *
 * Context: the context is @sincpro/client-framework's — what every use case runs with and sends
 * to the server — and where it lives is the platform's (`ContextStore`, chosen in `main` with
 * `configureProcess`). A screen only reads it: a level's `values` is the same object until it
 * changes and its `watch` is bound, which is exactly what React's external stores ask for. Writing
 * stays the level's (`processContext.set({ company_id })`), so a screen, a service and a test
 * change it the same way and nothing here is a second store.
 */
export function useContextValues<C extends object = ContextValues>(
  context: Context<C>,
): Readonly<Partial<C>> {
  const values = () => context.values;
  return useSyncExternalStore(context.watch, values, values);
}
