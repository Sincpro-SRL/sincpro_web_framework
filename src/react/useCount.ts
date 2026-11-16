"use client";

import type { CommandBodies, Entity } from "@sincpro/client-framework";
import type { AnyRecord, Count, Criteria } from "@sincpro/criteria";
import type { ListDefinition } from "@sincpro/web-framework/core/list";
import { useListing } from "@sincpro/web-framework/react/useListing";

/**
 * How many records of an entity a criteria holds, counted by the SERVER: «this member's
 * payments (2)», the number of a smart button. `null` until it answers — and while it fails —,
 * which web-ui's `SmartButton` reads as «—», never as 0.
 *
 *     const pagos = useCount(payments, { selection: { field: "member_id", value: member.id } });
 *     <SmartButton icon={Wallet} label="Pagos" count={pagos?.value} onClick={…} />
 *
 * Context: an application counted «this member's payments» with a hook of its own over a list
 * reference it built by hand. It is a listing of one row: the count is the one the server sends
 * with every page (a floor, `exact: false`, when it stopped counting at its cap), and it follows
 * the context and every write to the entity as any list does — a payment saved in a modal moves
 * the number behind it. Never a page fetched to be counted here.
 */
export function useCount<T extends AnyRecord, C extends CommandBodies = CommandBodies>(
  given: Entity<T, C> | ListDefinition<T>,
  criteria?: Criteria<T>,
): Count | null {
  const listing = useListing(given, {
    pageSize: 1,
    ...(criteria === undefined ? {} : { criteria }),
  });
  return listing.status === "failed" ? null : listing.count;
}
