import { describeFailure, logger, outcomeOf } from "@sincpro/client-framework";

/**
 * A use case's answer read on the server that renders a page, before it is drawn — the very use
 * case the page reads with in the browser (`useServiceReading`), so the page arrives with its
 * data in the HTML (what a search engine, a crawler and a shared link read) and the browser does
 * not ask again.
 *
 *     // the server: a route's loader, a Server Component
 *     const balance = await readOnServer(project.Accounts.balance, [{ member_id }]);
 *     <Balance member={member_id} initial={balance} />
 *
 *     // the page, rendered there and hydrated in the browser: the same use case, the same args
 *     type Props = { member: string; initial?: ServerRead<typeof project.Accounts.balance> };
 *     function Balance({ member, initial }: Props) {
 *       const balance = useServiceReading(project.Accounts.balance, [{ member_id: member }], {
 *         initial,
 *       });
 *     }
 *
 * Context: what crosses from the server to the browser is plain JSON — a Client Component is
 * handed data, never instances, and a `Date` arrives as its text —, so the answer is written and
 * read back as JSON here: a framework that refuses a class instance as a prop never sees one.
 *
 * A read that fails never refuses the page: it answers `undefined`, the page is drawn without
 * it, and the browser reads it on mount, as a single-page application does. The failure is one
 * line on the process's log (client-framework's `logger`, WARN: it always speaks) saying `what`
 * was not read — the use case's own name when not given. A use case run through its bounded
 * context already traced and reported its failure, so nothing is reported twice here; and, as
 * there, a refusal (a 404, a permission) says its type and kind, never its message. A use case
 * that answers nothing stays nothing, without a line.
 *
 * Plain logic, without React or the DOM (`core/`): a route's loader, a Server Component and a
 * script import it from `@sincpro/web-framework/core` without loading any screen.
 */
export async function readOnServer<A extends unknown[], R>(
  useCase: (...args: A) => R | Promise<R>,
  args: A,
  options: { what?: string } = {},
): Promise<Awaited<R> | undefined> {
  // A use case, not a hook: the linter reads any call to `use…` as one.
  const run = useCase;
  try {
    const answer = await run(...args);
    if (answer === undefined) return undefined;
    return JSON.parse(JSON.stringify(answer)) as Awaited<R>;
  } catch (error) {
    const failure = describeFailure(error, outcomeOf(error));
    logger.warn("read on the server failed: the page is drawn without it", {
      what: options.what ?? (useCase.name || "a use case"),
      "error.type": failure.type,
      "error.kind": failure.kind,
      ...(failure.message === undefined ? {} : { "error.message": failure.message }),
    });
    return undefined;
  }
}

/**
 * What `readOnServer` answers for a use case — its answer, or `undefined` when it could not be
 * read —: the type of a page's `initial`, handed to `useServiceReading(useCase, args, {
 * initial })` as it is.
 *
 *     type Props = { initial?: ServerRead<typeof project.Accounts.balance> };
 */
export type ServerRead<U extends (...args: never[]) => unknown> =
  Awaited<ReturnType<U>> | undefined;
