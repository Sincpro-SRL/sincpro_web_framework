"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * What a screen keeps of running one of the application's use cases.
 *
 * `run` answers what the use case answered, or `undefined` when it failed — the failure is in
 * `error`, for the screen to say (`explain`, `Refused`); it never throws at the screen.
 */
export type ServiceState<A extends unknown[], R> = {
  run: (...args: A) => Promise<R | undefined>;
  /** A run is on its way. */
  busy: boolean;
  /** What the last run answered, until another one starts or `reset`. */
  answer: R | undefined;
  error: unknown;
  reset: () => void;
};

/** A use case as a screen runs it: a method of a service, read from its bounded context. */
type UseCase<A extends unknown[], R> = (...args: A) => R | Promise<R>;

/**
 * One of the application's use cases, run from a screen.
 *
 *     const close = useService(project.Issues.close);
 *     <Button disabled={close.busy} onPress={() => close.run({ issue_id })}>Cerrar</Button>
 *     {close.error ? <Refused error={close.error} /> : null}
 *
 * Context: all of an application's logic lives in its services (@sincpro/client-framework's
 * `Feature` and `ApplicationService`, reached through their bounded context), traced and reported
 * by its interceptors; what a screen adds is the state of running one — busy, the answer, the
 * failure. Written by hand, that state is the 300-line context every mobile screen repeats; here
 * it is one hook, the same for every use case. The span and the report are the service's: this
 * hook neither opens one nor reports. A bounded context answers the same function every time a
 * method is read, so `project.Issues.close` can be handed as it is.
 *
 * The last run wins: an answer that arrives after a newer run started is dropped, so a slow first
 * click never overwrites the second. A run is never aborted — the server may have done it — but
 * its answer does not land on a screen that left.
 */
export function useService<A extends unknown[], R>(
  useCase: UseCase<A, R>,
): ServiceState<A, Awaited<R>> {
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<Awaited<R> | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  // The use case as the latest render gave it: a run started from an old callback still runs
  // the one the screen holds now (`project.scoped(…)` changed, say).
  const latest = useRef(useCase);
  latest.current = useCase;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => void (mounted.current = false);
  }, []);
  const runs = useRef(0);

  const run = useCallback(async (...args: A): Promise<Awaited<R> | undefined> => {
    const mine = ++runs.current;
    const current = () => mounted.current && runs.current === mine;
    setBusy(true);
    setError(null);
    try {
      const answered = (await latest.current(...args)) as Awaited<R>;
      if (current()) setAnswer(answered);
      return answered;
    } catch (failure) {
      if (current()) {
        setAnswer(undefined);
        setError(failure);
      }
      return undefined;
    } finally {
      if (current()) setBusy(false);
    }
  }, []);

  const reset = useCallback(() => {
    runs.current += 1;
    setBusy(false);
    setAnswer(undefined);
    setError(null);
  }, []);

  return { run, busy, answer, error, reset };
}
