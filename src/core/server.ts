import {
  describeFailure,
  type Draft,
  type Entity,
  logger,
  outcomeOf,
  type ResourceRef,
  screensTransport,
  type Transport,
} from "@sincpro/client-framework";
import type { AnyRecord, Meta } from "@sincpro/criteria";

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
    notRead(options.what ?? (useCase.name || "a use case"), error);
    return undefined;
  }
}

/** The one line a read on the server that failed leaves on the process's log (WARN: it always
 *  speaks): what was not read, and the failure's type and kind — a refusal never its message. */
function notRead(what: string, error: unknown): void {
  const failure = describeFailure(error, outcomeOf(error));
  logger.warn("read on the server failed: the page is drawn without it", {
    what,
    "error.type": failure.type,
    "error.kind": failure.kind,
    ...(failure.message === undefined ? {} : { "error.message": failure.message }),
  });
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

/**
 * One record of an entity and its model, as the server that renders a page read it: what
 * `useRecord(entity, opened, { initial })` starts from — `readRecordOnServer`'s answer.
 *
 * Context: plain JSON, as everything that crosses from the server to the browser. It says what
 * it was read FOR — the entity's key and the record's id — because a screen must never show it
 * under another: `useRecord` takes it only when it opens that same record.
 */
export type RecordRead<T> = {
  /** The entity's key (`entity.key`) it was read for. */
  entity: string;
  /** The record's key it was read for — `""` for a record that does not exist yet. */
  id: string;
  /** The record as the server answered it — `null` for a new one: the screen starts it from
   *  its model's defaults (and what its reference carries), as in the browser. */
  record: T | null;
  /** Its model's definition, when the server published one. */
  meta: Meta | null;
  /** What the caller kept of an edit between requests (sincpro_framework's `Drafts`). */
  draft: Draft | null;
};

/**
 * One record and its model, read on the server that renders the page — the same question
 * `useRecord` asks in the browser, through the same transport the `FrameworkProvider` is given —,
 * so its screen arrives FILLED in the HTML, not as a skeleton, and the browser does not ask
 * again on mount.
 *
 *     // a route's loader or a Server Component — plain logic, no screen loaded
 *     const invoice = await readRecordOnServer(transport, invoices, params.id);
 *     return <InvoicePage id={params.id} initial={invoice} />;
 *
 *     // the page, rendered there and hydrated in the browser
 *     const invoice = useRecord(invoices, id, { initial });
 *
 * `opened` is what the screen opens: a record's id, `""` for a new one — only its model is read,
 * as `useRecord` reads it (the list, one row) — or the reference the screen receives.
 *
 * Context: it asks through the screens' use case (`screensTransport`), as `useRecord` and
 * `readListing` do — traced like the browser's reads, with the process's context — and answers
 * plain JSON (`RecordRead`): a Client Component is handed data, never instances. A read that
 * fails never refuses the page, as `readOnServer`: it answers `undefined` and one WARN line on
 * the process's log — `what` (the entity's key when not given), the failure's type and kind, and
 * never a refusal's message (a 404, a permission) —, the page is drawn without it and the
 * browser reads the record on mount, as a single-page application does. A read the caller
 * aborted (`signal`: nobody waits for the page any more) answers `undefined` without a line.
 *
 * Plain logic, without React or the DOM (`core/`): a route's loader, a Server Component and a
 * script import it from `@sincpro/web-framework/core` without loading any screen.
 */
export async function readRecordOnServer<T extends AnyRecord>(
  transport: Transport,
  entity: Entity<T>,
  opened: string | ResourceRef,
  options: { what?: string; signal?: AbortSignal } = {},
): Promise<RecordRead<T> | undefined> {
  const id = typeof opened === "string" ? opened : (opened.id ?? "");
  const screens = screensTransport(transport);
  try {
    if (id === "") {
      // Nothing to read but the model: asked of the list with no rows, as `useRecord` asks it.
      const page = await screens.list<T>(
        entity.list,
        { pagination: { limit: 1 } },
        options.signal,
      );
      return plain<T>({
        entity: entity.key,
        id,
        record: null,
        meta: page.meta ?? null,
        draft: null,
      });
    }
    const answer = await screens.one<T>(entity.one(id), options.signal);
    return plain({
      entity: entity.key,
      id,
      record: answer.record,
      meta: answer.meta ?? null,
      draft: answer.draft ?? null,
    });
  } catch (error) {
    if (options.signal?.aborted !== true) notRead(options.what ?? entity.key, error);
    return undefined;
  }
}

/** Written and read back as JSON: what a server hands a page crosses that way. */
function plain<T>(read: RecordRead<T>): RecordRead<T> {
  return JSON.parse(JSON.stringify(read)) as RecordRead<T>;
}
