"use client";

import type { Expression } from "@sincpro/criteria";
import { createContext, type ReactNode, useContext } from "react";

/**
 * A cut that every list of ONE entity reads under, given by whoever holds the screen.
 *
 * Context: a chooser opened by a picker (`chooserRef(query, scope)`) is the entity's own list
 * view — the application's or the default — and that view builds its listing itself
 * (`useListing(entity)`): nothing between the reference and the listing could narrow it, so
 * the chooser offered records the picker excluded. The view that holds the list says the cut
 * (`entityView`, from the reference) and `useListing` ANDs it under the list's own scope for
 * that entity only — a list of another entity inside the same view is not touched. Like any
 * scope it narrows what is offered; the server still decides what may be stored.
 */
export type ListScope = { key: string; where: Expression };

const Scope = createContext<ListScope | null>(null);

export function ListScopeProvider({
  value,
  children,
}: {
  value: ListScope;
  children: ReactNode;
}) {
  return <Scope.Provider value={value}>{children}</Scope.Provider>;
}

/** The cut the screen gave for the lists of `key`, or none. */
export function useListScope(key: string): Expression | undefined {
  const scope = useContext(Scope);
  return scope !== null && scope.key === key ? scope.where : undefined;
}
