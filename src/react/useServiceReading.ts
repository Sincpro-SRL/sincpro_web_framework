"use client";

import { type Entity, listRoute } from "@sincpro/client-framework";
import { touches } from "@sincpro/web-framework/core/changes";
import { useFramework } from "@sincpro/web-framework/react/context";
import { useCallback, useEffect, useRef, useState } from "react";

/** What a screen shows of a use case that reads: the answer to the arguments it asks with NOW. */
export type ServiceReading<R> = {
  /** `loading` until the answer to these arguments arrives — never another's answer. */
  status: "loading" | "ready" | "failed";
  answer: R | undefined;
  error: unknown;
  /** Read again with the same arguments; the answer stays on screen until the new one. */
  reload: () => void;
};

/** A use case as a screen reads with it: a method of a service, read from its bounded context. */
type UseCase<A extends unknown[], R> = (...args: A) => R | Promise<R>;

type Answered<R> = {
  key: string;
  status: "ready" | "failed";
  answer: R | undefined;
  error: unknown;
};

/** Where `entity` is listed — or nothing to follow when it is listed only under a record. */
function routeOf(entity: Entity): string | undefined {
  try {
    return listRoute(entity.list);
  } catch {
    return undefined;
  }
}

/**
 * A use case that READS, run by the screen that shows it: on mount, again whenever its
 * arguments change, when the process's context changes (another company), and when a write
 * touches an entity it follows.
 *
 *     const balance = useServiceReading(members.Accounts.balance, [{ member_id }], {
 *       follows: [payments],
 *     });
 *     balance.status === "ready" ? <Stat value={text.money(balance.answer)} /> : <Skeleton />
 *
 * Context: `useService` is an ACTION's — it runs when a person presses, never on mount — and a
 * screen that read with it re-ran it by hand when a route param changed: easy to miss, and the
 * screen kept showing the answer of the tab it left. Here a reading is keyed by its arguments
 * (as JSON): the answer of other arguments is never shown — another member starts as `loading`,
 * as `useRecord` does for another id — while reading the same ones again keeps the answer on
 * screen until the new one lands. The last question wins: an answer to arguments no longer on
 * screen is dropped. The use case is the latest the screen gave (a bounded context answers a new
 * function per `scoped(…)`); its trace and report are the service's, never this hook's.
 */
export function useServiceReading<A extends unknown[], R>(
  useCase: UseCase<A, R>,
  args: A,
  options: { follows?: readonly Entity[] } = {},
): ServiceReading<Awaited<R>> {
  const { context, changes, entities } = useFramework();
  const key = JSON.stringify(args);
  const latest = useRef({ useCase, args });
  latest.current = { useCase, args };
  const [answered, setAnswered] = useState<Answered<Awaited<R>> | null>(null);
  const [again, setAgain] = useState(0);

  // A write anyone sends — a save, another use case, a panel beside — to what it follows.
  const followed = (options.follows ?? [])
    .map(routeOf)
    .filter((route): route is string => route !== undefined)
    .join("\n");
  useEffect(() => {
    if (followed === "") return;
    const routes = followed.split("\n");
    return changes.follow((change) => {
      if (routes.some((route) => touches(change, route, entities))) setAgain((n) => n + 1);
    });
  }, [changes, entities, followed]);

  useEffect(() => {
    let current = true;
    const { useCase: read, args: now } = latest.current;
    // Through the promise: a use case that throws before it answers is a failure like any other.
    Promise.resolve()
      .then(() => read(...now))
      .then(
        (answer) => {
          if (current)
            setAnswered({ key, status: "ready", answer: answer as Awaited<R>, error: null });
        },
        (error: unknown) => {
          if (current) setAnswered({ key, status: "failed", answer: undefined, error });
        },
      );
    return () => void (current = false);
    // `context` and `again` read again: another company, a followed write, a `reload()`.
  }, [key, context, again]);

  const reload = useCallback(() => setAgain((n) => n + 1), []);
  if (answered === null || answered.key !== key)
    return { status: "loading", answer: undefined, error: null, reload };
  return { status: answered.status, answer: answered.answer, error: answered.error, reload };
}
