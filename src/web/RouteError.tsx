"use client";

import { reportError } from "@sincpro/client-framework";
import { routeCopy } from "@sincpro/web-framework/core/copy";
import { Button, ButtonLink, Failed } from "@sincpro/web-ui";
import { useEffect } from "react";

export type RouteErrorProps = {
  /**
   * What broke, as the route's error boundary hands it: Next's `error.tsx` and TanStack
   * Router's `errorComponent` give it as a prop, React Router's `useRouteError()` returns it.
   * Its `digest`, when there is one, is the code the server logged the failure with.
   */
  error: unknown;
  /** Draws the page again — the boundary's `reset`. None: no «try again». */
  reset?: () => void;
  /** Where it broke, for the report («portal», «admin»): the name the report goes by. */
  where?: string;
  /** Where «back to the start» leads: the application's own start. None: no link. */
  home?: string;
};

/** The code a server gave the failure — Next's `digest` — when it gave one. */
function digestOf(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("digest" in error)) return undefined;
  const digest = error.digest;
  return typeof digest === "string" && digest !== "" ? digest : undefined;
}

/**
 * What a person sees when a page broke while drawing, instead of the framework's generic page:
 * what happened in plain words, the code that finds it in the server's logs, a way to try again
 * and a way to the start. The failure is reported once, through the process
 * (`reportError`): to GlitchTip when the application reports.
 *
 *     // Next — app/(portal)/error.tsx; the boundary is the framework's, the screen this one
 *     "use client";
 *     type Props = { error: Error & { digest?: string }; reset: () => void };
 *     export default function PortalError({ error, reset }: Props) {
 *       return <RouteError error={error} reset={reset} where="portal" home="/panel" />;
 *     }
 *
 * Context: no router is imported here — Next, TanStack Start and React Router each hand their
 * boundary's error (and a way to reset it), and the application passes them on. A server render
 * that fails reaches the browser without its message — only the `digest` the server logged it
 * with —, so the code is what is shown: what the person quotes is what support searches for
 * (web-ui's `Failed` draws it as data and copies it with «Copiar el error»). The message itself
 * is never drawn: it is the system's, not the person's. The words are the copy table's
 * (`route`); `reportError` reports an error once, however many times this renders.
 */
export function RouteError({ error, reset, where = "route", home }: RouteErrorProps) {
  useEffect(() => reportError(error, where), [error, where]);
  const copy = routeCopy();
  const digest = digestOf(error);
  const actions =
    reset === undefined && home === undefined ? undefined : (
      <div className="flex flex-wrap items-center gap-3">
        {reset === undefined ? null : (
          <Button role="primary" onClick={() => reset()}>
            {copy.retry}
          </Button>
        )}
        {home === undefined ? null : (
          <ButtonLink role="secondary" href={home}>
            {copy.home}
          </ButtonLink>
        )}
      </div>
    );
  return (
    <div role="alert" className="mx-auto flex max-w-prose flex-col px-4 py-10">
      <Failed
        heading={copy.broke}
        sentence={copy.sentence}
        detail={digest === undefined ? undefined : copy.code(digest)}
        action={actions}
      />
    </div>
  );
}
