"use client";

import {
  type BatchResult,
  type CommandAnswers,
  type CommandBodies,
  type Entity,
  keysOf,
  listRoute,
  type RetryKeys,
  retryKeys,
  runBatch,
  type Selection,
  type WriteRoute,
} from "@sincpro/client-framework";
import type { AnyRecord } from "@sincpro/criteria";
import { sendRoute } from "@sincpro/web-framework/core/command";
import { useFramework } from "@sincpro/web-framework/react/context";
import type { AnswerOf } from "@sincpro/web-framework/react/useCommand";
import { useCallback, useEffect, useRef, useState } from "react";

/** The most records a Command runs on at once from a screen, unless the screen says otherwise. */
export const BATCH_LIMIT = 200;

export type BatchCommandState<
  R,
  B extends AnyRecord = AnyRecord,
  T extends AnyRecord = AnyRecord,
> = {
  /** Runs the Command once per chosen record. Without a body, an empty one. */
  run: (selection: Selection<T>, body?: B) => Promise<BatchResult<string, R> | undefined>;
  /** Again, only for the records it failed for — each with the key it went with, so a record
   *  the server did run after all is not run twice. */
  retry: () => Promise<BatchResult<string, R> | undefined>;
  /** What has not started does not; what runs finishes — the server may be doing it. */
  stop: () => void;
  running: boolean;
  /** How far it is while it runs. */
  progress: { settled: number; total: number } | null;
  /** One outcome per record, once it ended. */
  result: BatchResult<string, R> | null;
  /** Why it did not start: too many chosen (`SelectionTooLarge`), the keys could not be read. */
  error: unknown;
  reset: () => void;
};

/**
 * One Command of an entity, run once per record of a selection — «Confirmar» on the invoices
 * ticked, «Aprobar» on every payment a filter shows —, one outcome per record.
 *
 *     const confirm = useBatchCommand(invoices, "confirm");
 *     <Button onPress={() => confirm.run(chosen.selection)}>Confirmar</Button>
 *     <BatchProgress batch={confirm} />      // «2 de 3», then «2 hechos · 1 falló: F-7 — …»
 *
 * Context: `for rec in self` from a screen. The keys come from the selection (`keysOf`: in
 * hand, or read once as references — never more than `limit`); each record is the Command sent
 * through the screens' transport — a use case of its own, traced — with an idempotency key of
 * its own, kept while it goes unanswered (`retryKeys`): a retry after a dropped request is the
 * same confirmation, never a second one. A failure is that record's (`runBatch`); the lists
 * follow every write as they do for one.
 *
 * In order, one at a time, by default: a server is not asked for two hundred writes at once
 * because a person ticked them. `concurrency` changes that.
 *
 * Not here: a batch the server runs in one request («everything matching» as a criteria) —
 * sincpro_framework#185.
 */
export function useBatchCommand<
  T extends AnyRecord,
  R = unknown,
  C extends CommandBodies = CommandBodies,
  N extends keyof C & string = keyof C & string,
  A extends CommandAnswers = CommandAnswers,
>(
  entity: Entity<T, C, A>,
  name: N,
  options: { limit?: number; concurrency?: number } = {},
): BatchCommandState<AnswerOf<R, A, N>, C[N], T> {
  const route: WriteRoute | undefined = entity.commands[name];
  if (route === undefined) throw new Error(`${entity.key} declares no command "${name}"`);
  const { limit = BATCH_LIMIT, concurrency = 1 } = options;
  const { transport, metas } = useFramework();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ settled: number; total: number } | null>(null);
  const [result, setResult] = useState<BatchResult<string, AnswerOf<R, A, N>> | null>(null);
  const [error, setError] = useState<unknown>(null);
  // The answers must not land on a screen that left; the Commands themselves go on.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => void (mounted.current = false);
  }, []);
  /** One gesture per record, kept across a retry: what went unanswered keeps its key. */
  const gestures = useRef(new Map<string, RetryKeys>());
  const last = useRef<{ body: AnyRecord } | null>(null);
  const stopping = useRef<AbortController | null>(null);

  const execute = useCallback(
    async (keys: readonly string[], body: AnyRecord) => {
      const stopper = new AbortController();
      stopping.current = stopper;
      last.current = { body };
      setRunning(true);
      setResult(null);
      setProgress({ settled: 0, total: keys.length });
      const done = await runBatch(
        keys,
        async (key) => {
          const gesture = gestures.current.get(key) ?? retryKeys();
          gestures.current.set(key, gesture);
          try {
            const answer = await sendRoute<AnswerOf<R, A, N>>(transport, route, key, body, {
              idempotencyKey: gesture.keyFor({ id: key, body }),
            });
            gesture.settle(null);
            return answer;
          } catch (failure) {
            gesture.settle(failure);
            throw failure;
          }
        },
        {
          concurrency,
          // Never handed to the send: a Command sent is not taken back, only the next ones.
          signal: stopper.signal,
          onOutcome: (_, now) => {
            if (mounted.current) setProgress(now);
          },
        },
      );
      if (mounted.current) {
        setResult(done);
        setRunning(false);
      }
      return done;
    },
    [transport, route, concurrency],
  );

  return {
    run: async (selection, body) => {
      setError(null);
      const meta = metas.get(entity.key);
      let keys: readonly string[];
      try {
        keys = await keysOf(selection, {
          transport,
          route: listRoute(entity.list),
          identity: meta?.get_id || meta?.identity || "id",
          limit,
        });
      } catch (failure) {
        if (mounted.current) setError(failure);
        return undefined;
      }
      return execute(keys, body ?? {});
    },
    retry: async () => {
      const failed = (result?.outcomes ?? [])
        .filter((one) => one.status !== "done")
        .map((one) => one.item);
      if (failed.length === 0 || last.current === null) return undefined;
      return execute(failed, last.current.body);
    },
    stop: () => stopping.current?.abort(),
    running,
    progress,
    result,
    error,
    reset: () => {
      setResult(null);
      setError(null);
      setProgress(null);
    },
  };
}
