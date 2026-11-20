import { reportError } from "@sincpro/client-framework";

/**
 * What nobody caught in the browser — an error thrown in an event handler outside a use case, a
 * promise nobody waited for —, reported through the process's reporter like everything else:
 *
 *     configureProcess({ identity: { release }, reporter: glitchtipReporter({ dsn, release }) });
 *     reportUncaught();                                   // entrypoints/main.tsx, opt-in
 *
 * Context: it listens to `window`'s `error` and `unhandledrejection` and hands each over to
 * client-framework's `reportError`, so the process's rules apply: whichever reporter it has
 * (GlitchTip or another), a cancellation or a refusal the server explained is not a fault, and
 * an error already reported — a use case's, the one that also went unhandled — is not reported
 * again. A script of another origin says only «Script error.», with nothing to find it by: it
 * is skipped, as is anything thrown without an error. On the server there is no `window` and it
 * does nothing. Called again, it answers the same stop; nothing else is registered.
 */
export function reportUncaught(): () => void {
  const target = (globalThis as { window?: EventTarget }).window;
  if (target === undefined) return () => undefined;
  return (listening ??= listen(target));
}

let listening: (() => void) | undefined;

function listen(target: EventTarget): () => void {
  const onError = (event: Event) => {
    const error = (event as { error?: unknown }).error;
    if (error === undefined || error === null) return;
    reportError(error, "uncaught error");
  };
  const onRejection = (event: Event) => {
    reportError((event as { reason?: unknown }).reason, "unhandled rejection");
  };
  target.addEventListener("error", onError);
  target.addEventListener("unhandledrejection", onRejection);
  return () => {
    target.removeEventListener("error", onError);
    target.removeEventListener("unhandledrejection", onRejection);
    listening = undefined;
  };
}
