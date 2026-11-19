"use client";

import {
  type CommandAnswers,
  type CommandBodies,
  type Entity,
  type RetryKeys,
  retryKeys,
  type WriteRoute,
} from "@sincpro/client-framework";
import type { AnyRecord } from "@sincpro/criteria";
import { sendRoute } from "@sincpro/web-framework/core/command";
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
 * One at a time: `busy` turns the button off, because a payment sent twice is two payments. And
 * once sent, the same gesture keeps its `Idempotency-Key` until the server answers: a retry
 * after a dropped request is the same payment, never a second one (`retryKeys`).
 *
 * A typed entity (`entity<Issue, { send: { message: string } }>`) gets its names and bodies
 * checked: `useCommand(issues, "send").run(id, { mesage })` does not compile. TypeScript infers
 * that only when no type argument is written — `useCommand<Issue, Answer>(…)` stays loose.
 */
export type Rehearsal = { text: string; data: Record<string, unknown> };

export type CommandState<R, B extends AnyRecord = AnyRecord> = {
  /** Without a body, an empty one: the route may name everything. A body given is checked. */
  run: (id?: string, body?: B) => Promise<R | undefined>;
  /** The dry run: what it would do, nothing touched. */
  rehearse: (id?: string, body?: B) => Promise<Rehearsal | undefined>;
  busy: boolean;
  error: unknown;
  /** The last dry run's answer, until `reset`. */
  rehearsal: Rehearsal | null;
  reset: () => void;
};

/**
 * What a Command answers: `R` when the screen writes it, else what its entity says the Command
 * answers (`CommandAnswers`), else `unknown`.
 */
export type AnswerOf<R, A, N> = unknown extends R ? (N extends keyof A ? A[N] : unknown) : R;

export function useCommand<
  T extends AnyRecord,
  R = unknown,
  C extends CommandBodies = CommandBodies,
  N extends keyof C & string = keyof C & string,
  A extends CommandAnswers = CommandAnswers,
>(entity: Entity<T, C, A>, name: N): CommandState<AnswerOf<R, A, N>, C[N]> {
  // A name outside the declared ones still reaches here from untyped code: say which.
  const route: WriteRoute | undefined = entity.commands[name];
  if (route === undefined) throw new Error(`${entity.key} declares no command "${name}"`);
  return useRouteCommand<AnswerOf<R, A, N>, C[N]>(route, entity.key);
}

/**
 * One write route of an entity run as a Command — what `useCommand` runs for a declared Command,
 * and `useRecordLifecycle` for the record's own `delete`. `route` may be absent (an entity that
 * declares none): the hook is still called, and running it is refused naming the entity.
 */
export function useRouteCommand<R, B extends AnyRecord = AnyRecord>(
  route: WriteRoute | undefined,
  owner: string,
): CommandState<R, B> {
  const { transport } = useFramework();
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

  // One key per gesture, kept while it goes unanswered: «retry» after a dropped request must
  // not run it twice. A dry run touches nothing, so each one gets a key of its own.
  const keys = useRef(retryKeys());

  const send = useCallback(
    async <A>(
      id: string | undefined,
      body: AnyRecord,
      gesture: RetryKeys,
    ): Promise<A | undefined> => {
      if (route === undefined) throw new Error(`${owner} declares no route for this`);
      setBusy(true);
      setError(null);
      const idempotencyKey = gesture.keyFor({ id, body });
      try {
        const answer = await sendRoute<A>(transport, route, id, body, { idempotencyKey });
        gesture.settle(null);
        return answer;
      } catch (failure) {
        gesture.settle(failure);
        if (mounted.current) setError(failure);
        return undefined;
      } finally {
        if (mounted.current) setBusy(false);
      }
    },
    [transport, route, owner],
  );

  return {
    run: (id, body) => send<R>(id, body ?? {}, keys.current),
    rehearse: async (id, body) => {
      const answer = await send<Rehearsal>(id, { ...body, dry_run: true }, retryKeys());
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
