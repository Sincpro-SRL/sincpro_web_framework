"use client";

import type { AnyRecord } from "@sincpro/criteria";
import { type Entity, pathFor } from "@sincpro/web-framework/core/entity";
import { useFramework } from "@sincpro/web-framework/react/context";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * One Command of an entity: run it, or ask first what it would do.
 *
 * Context: sincpro_framework runs a Command dry when it carries `dry_run: true` (a
 * `DryRunnable`): the handler's `preview` answers what it WOULD do — «provider odoo deletes
 * env-42; its record and history stay» — and nothing is touched. That is the confirmation a
 * destructive action deserves: not «are you sure?», but what is about to happen. forge's
 * console had the backend for it and no screen that asked.
 *
 * One at a time: `busy` turns the button off, because a payment sent twice is two payments.
 */
export type Rehearsal = { text: string; data: Record<string, unknown> };

export type CommandState<R> = {
  run: (id?: string, body?: AnyRecord) => Promise<R | undefined>;
  /** The dry run: what it would do, nothing touched. */
  rehearse: (id?: string, body?: AnyRecord) => Promise<Rehearsal | undefined>;
  busy: boolean;
  error: unknown;
  /** The last dry run's answer, until `reset`. */
  rehearsal: Rehearsal | null;
  reset: () => void;
};

export function useCommand<T extends AnyRecord, R = unknown>(
  entity: Entity<T>,
  name: string,
): CommandState<R> {
  const { transport } = useFramework();
  const route = entity.commands[name];
  if (route === undefined) throw new Error(`${entity.key} declares no command "${name}"`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [rehearsal, setRehearsal] = useState<Rehearsal | null>(null);
  // A Command is never aborted once sent — the server may have done it — but its answer must
  // not land on a screen that left.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => void (mounted.current = false);
  }, []);

  const send = useCallback(
    async <A>(id: string | undefined, body: AnyRecord): Promise<A | undefined> => {
      setBusy(true);
      setError(null);
      try {
        return await transport.send<A>(route.method, pathFor(route, id), body);
      } catch (failure) {
        if (mounted.current) setError(failure);
        return undefined;
      } finally {
        if (mounted.current) setBusy(false);
      }
    },
    [transport, route],
  );

  return {
    run: (id, body = {}) => send<R>(id, body),
    rehearse: async (id, body = {}) => {
      const answer = await send<Rehearsal>(id, { ...body, dry_run: true });
      if (answer !== undefined && mounted.current) setRehearsal(answer);
      return answer;
    },
    busy,
    error,
    rehearsal,
    reset: () => {
      setRehearsal(null);
      setError(null);
    },
  };
}
