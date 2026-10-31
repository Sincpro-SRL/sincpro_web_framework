"use client";

import { type AnyRecord, type Expression, matches } from "@sincpro/criteria";
import { pathFor } from "@sincpro/web-framework/core/entity";
import { retryKeys } from "@sincpro/web-framework/core/retry";
import { useFramework } from "@sincpro/web-framework/react/context";
import type { Listing } from "@sincpro/web-framework/react/useListing";
import type { RowAction } from "@sincpro/web-ui";
import type { LucideIcon } from "lucide-react";
import { useCallback, useState } from "react";

/**
 * An entity's Commands as the actions of a row: «Confirmar» on each invoice, without opening it.
 *
 * Context: web-ui draws a row's actions (`rowActions`) and knows nothing of what they do; the
 * entity knows its Commands and their routes. This joins them, with the rules a Command keeps
 * everywhere: sent once per gesture with its `Idempotency-Key` (a retry is the same Command),
 * the row's action disabled while it runs, and the list read again when it is done — the server
 * says what the row became. `when` is a condition over the row, evaluated the way the server's
 * hints are (`matches`): «Confirmar» only on drafts.
 *
 * Only Commands that can be undone belong on a row. One that destroys is confirmed by its dry
 * run, and that is the record's `CommandButton`, where the consequence has room to be read.
 *
 *     const commands = useRowCommands(listing, [
 *       { command: "confirmar", label: "Confirmar", icon: Check,
 *         when: { field: "state", operator: "=", value: "draft" } },
 *     ]);
 *     <EntityList listing={listing} rowActions={commands.rowActions} />
 */
export type RowCommand<T> = {
  /** A Command the entity declares (`entity({ commands })`). */
  command: string;
  label: string;
  icon: LucideIcon;
  tone?: RowAction["tone"];
  /** Offered only on rows that hold it — a hint, not protection: the server decides. */
  when?: Expression<T>;
  /** What the Command is sent with. Without it, an empty body: the route names the row. */
  body?: (row: T) => AnyRecord;
};

export type RowCommands<T> = {
  rowActions: (row: T) => readonly RowAction[];
  /** The last refusal, until `dismiss`. */
  error: unknown;
  dismiss: () => void;
};

export function useRowCommands<T extends AnyRecord>(
  listing: Listing<T>,
  commands: readonly RowCommand<T>[],
): RowCommands<T> {
  const { transport } = useFramework();
  const [running, setRunning] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<unknown>(null);
  // One key per row and Command, kept while it goes unanswered: retrying is the same gesture.
  const [keys] = useState(() => new Map<string, ReturnType<typeof retryKeys>>());
  const { entity, meta } = listing;
  const key = meta?.get_id || meta?.identity || "id";

  const run = useCallback(
    async (one: RowCommand<T>, row: T) => {
      const route = entity.commands[one.command];
      if (route === undefined)
        throw new Error(`${entity.key} declares no command "${one.command}"`);
      const id = String(row[key]);
      const gesture = `${one.command}\u0000${id}`;
      const retry = keys.get(gesture) ?? retryKeys();
      keys.set(gesture, retry);
      const body = one.body?.(row) ?? {};
      setRunning((now) => new Set(now).add(gesture));
      setError(null);
      try {
        await transport.send(route.method, pathFor(route, id), body, undefined, {
          idempotencyKey: retry.keyFor(body),
        });
        retry.settle(null);
        listing.reload();
      } catch (failure) {
        retry.settle(failure);
        setError(failure);
      } finally {
        setRunning((now) => {
          const next = new Set(now);
          next.delete(gesture);
          return next;
        });
      }
    },
    [transport, entity, key, keys, listing],
  );

  const rowActions = (row: T): readonly RowAction[] =>
    commands
      .filter(
        (one) => meta === null || one.when === undefined || matches(row, one.when, meta),
      )
      .map((one) => ({
        id: one.command,
        label: one.label,
        icon: one.icon,
        ...(one.tone === undefined ? {} : { tone: one.tone }),
        disabled: running.has(`${one.command}\u0000${String(row[key])}`),
        onSelect: () => void run(one, row),
      }));

  return { rowActions, error, dismiss: () => setError(null) };
}
