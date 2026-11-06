"use client";

import {
  type Draft,
  type Entity,
  type EntityRef,
  newEntityId,
  pathFor,
  retryKeys,
  startingValuesOf,
  TransportError,
  WITH_PARAM,
} from "@sincpro/client-framework";
import type { AnyRecord, Meta } from "@sincpro/criteria";
import {
  type Advice,
  changesOf,
  computedLocally,
  creationOf,
  defaultsOf,
  errorsByField,
  type FieldState,
  fieldStateOf,
  type FieldStates,
  lineStatesOf,
  missingOf,
  needsPreview,
} from "@sincpro/web-framework/core/edit";
import { linesAnswered } from "@sincpro/web-framework/core/lines";
import { useFramework } from "@sincpro/web-framework/react/context";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * ONE record of an entity, with the definition of its model — read, and edited.
 *
 * Context: forge's console wrote the reading as `useAnswer` and never edited at all, though its
 * backend had an update route: editing by hand (dirty state, save, discard, conflicts) cost more
 * than the screen was worth. Here it is the same object:
 *
 *   - **reading** — the record and its meta travel together (sincpro_framework's
 *     `ResponseRecord`); an answer that arrives after the view moved on is dropped.
 *   - **editing** — `set` keeps what is typed apart from the record; each field's state comes
 *     from the model's hints evaluated over what is on screen (`fieldStateOf`), refined by the
 *     server's `Preview` when the entity has one (computed values, states, advice).
 *   - **saving** — only what changed travels, with the version that was read: if someone saved
 *     in between, the server answers 409 and the screen says so instead of overwriting.
 *   - **drafts** — an edit kept between requests (sincpro_framework's `Drafts`) comes back with
 *     the record and is shown as restored; `keep()` stores the current one.
 *   - **`Edit`** — an entity that declares `edit` speaks sincpro_framework's `Edit` on it for all
 *     three: `keep()` is `save_draft`, `save()` is `save` — the record whole, the fields changed,
 *     the draft version read and the stored version it started from — and `discard()` is
 *     `discard`, which drops the draft on the server too. Without it, a save sends the changed
 *     fields and the version to `save`.
 *   - **creating** — with no id it is a record that does not exist yet: it starts from the
 *     defaults the model publishes, previews like any other, and `save()` sends it to the
 *     entity's `create` route with an `Idempotency-Key` (a retry never creates two). When the
 *     answer carries the new identity, the hook becomes that record; otherwise `edit.created`
 *     holds the answer and the screen decides where to go. Given the REFERENCE it was opened
 *     with, a new record starts with what the reference carries over the defaults
 *     (`newRef(values)`): an invoice created from its customer starts with that customer.
 *   - **creating by `Edit`** — sincpro_framework creates a new record under the id the CLIENT
 *     mints (a UUID v7), and its draft shares it from the first draft save. So a new record of
 *     an entity that declares `edit`, keyed by `id`, gets its key HERE (`newEntityId`), once:
 *     `keep()` stores its draft and `save()` stores it through the same `Edit` route, under
 *     that key — a retry names the same record, never a second one — and the hook becomes it.
 *     Its `id` stays `""` until it is stored: until then it does not exist.
 *
 *     const invoice = useRecord(invoices, "");          // a new one
 *     const invoice = useRecord(invoices, "F-2026-7");  // an existing one
 *     const invoice = useRecord(invoices, resource);    // what the workspace opened
 */
export type RecordState<T> =
  | { status: "loading"; record: null; meta: Meta | null; error: null }
  | { status: "ready"; record: T; meta: Meta | null; error: null }
  | { status: "failed"; record: null; meta: Meta | null; error: unknown };

export type Editing = {
  /** The record as on screen: what was read, what the server computed, what was typed. */
  values: AnyRecord;
  changed: AnyRecord;
  dirty: boolean;
  set: (name: string, value: unknown) => void;
  state: (name: string) => FieldState;
  /** A cell of a list of records — line `index` of `name`, its `field`: the line model's hints
   *  over that line, refined by what the server's preview said of it (`items`, by the line's
   *  identity, by its position when it has none). */
  cell: (name: string, index: number, field: string) => FieldState;
  /** The server's word on what did not validate, by where it points (`pathOf`): `discount`,
   *  `lines/1/qty`. Read a field's — its lines' included — with `errorAt`. */
  errors: Record<string, string>;
  /** What the server's preview warned about, each with where it points; `adviceAt` places it. */
  advice: Advice[];
  /** Required, visible, editable and empty: what blocks a save. */
  missing: string[];
  saving: boolean;
  /** The last save's refusal, when it was not a conflict. */
  failure: unknown;
  /** Someone saved after this was read: nothing was overwritten. */
  conflict: boolean;
  /** The values came back from a kept draft. */
  restored: boolean;
  /** The draft this caller keeps on the server, when there is one. */
  draft: Draft | null;
  save: () => Promise<boolean>;
  discard: () => void;
  /** Store the current edit as a draft — only when the entity declares where (`draft` or
   *  `edit`), and the record exists or is born by `Edit` under the key minted for it. */
  keep?: () => Promise<void>;
  /** What the last create answered, when it did not say the new record's identity. */
  created: unknown;
};

export type RecordReading<T> = RecordState<T> & {
  entity: Entity<T & AnyRecord>;
  /** The record's key — `""` while it is new, its identity once created. */
  id: string;
  /** It does not exist on the server yet. */
  isNew: boolean;
  locale: string | undefined;
  reload: () => void;
  edit: Editing;
};

/** sincpro_framework's `ResponsePreviewEntity` (3.28.2): computed values, each field's state
 *  (`states`, a list's lines in `items`), and what the domain warned (`warnings`). */
type Preview = { values?: AnyRecord; states?: FieldStates; warnings?: Advice[] };

/** sincpro_framework's `ResponseEdit`, as far as a kept draft needs it: the version it is now. */
type Edited = { draft?: { version: number; origin_version?: number } | null };

/** How long typing has to pause before the server is asked what the record becomes. */
const PREVIEW_PAUSE = 300;

export function useRecord<T extends AnyRecord>(
  entity: Entity<T>,
  opened: string | EntityRef,
): RecordReading<T> {
  const { transport, locale, metas } = useFramework();
  const given = typeof opened === "string" ? opened : (opened.id ?? "");
  // As written in the reference: a text compares by value, so a new render with the same
  // reference is not a new start.
  const start = typeof opened === "string" ? undefined : opened.params?.[WITH_PARAM];
  // A create that answered its identity turns this into that record — until the screen asks
  // for another one.
  const [born, setBorn] = useState<{ from: string; id: string } | null>(null);
  const id = born !== null && born.from === given ? born.id : given;
  const isNew = id === "";
  const [created, setCreated] = useState<unknown>(null);
  const creating = useRef(retryKeys());
  // The key a new record is born under when it is created by `Edit`: minted once per new
  // record, on the first gesture that needs it, and kept for every draft save and the save.
  const minted = useRef<{ from: string; key: string } | null>(null);
  const [state, setState] = useState<RecordState<T>>({
    status: "loading",
    record: null,
    meta: null,
    error: null,
  });
  // Which record `state` was read for: the render after the id changed — a create that answered,
  // another record asked — must not show the previous one under the new id.
  const [readFor, setReadFor] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [typed, setTyped] = useState<AnyRecord>({});
  const [computed, setComputed] = useState<AnyRecord>({});
  const [fromServer, setFromServer] = useState<FieldStates>({});
  const [advice, setAdvice] = useState<Advice[]>([]);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const [conflict, setConflict] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const pause = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The preview in flight. A newer one cancels it, and so do a save, a discard and leaving:
  // an answer about values that are no longer on screen must never land on them.
  const asking = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const cancelPreview = () => {
    if (pause.current) clearTimeout(pause.current);
    asking.current?.abort();
    asking.current = null;
  };

  const forget = () => {
    cancelPreview();
    setTyped({});
    setComputed({});
    setFromServer({});
    setAdvice([]);
    setFailure(null);
    setConflict(false);
  };

  useEffect(() => {
    const aborter = new AbortController();
    // Read again — after a save, a reload — the record on screen STAYS until the answer: a form
    // that blinked through a skeleton lost its focus, its scroll and the click that landed then.
    // Only a record not shown yet (another id, the first read) starts as «loading».
    const again = !isNew && readFor === id;
    if (!again)
      setState((now) => ({ status: "loading", record: null, meta: now.meta, error: null }));
    if (isNew) {
      // Nothing to read but the model: known already, or asked of the list with no rows.
      const known = metas.get(entity.key);
      const asked = known
        ? Promise.resolve(known)
        : transport
            .list<T>(entity.list, { pagination: { limit: 1 } }, aborter.signal)
            .then((page) => page.meta);
      asked.then(
        (meta) => {
          if (meta) metas.set(entity.key, meta);
          if (aborter.signal.aborted) return;
          forget();
          setDraft(null);
          setReadFor(id);
          const starting =
            start === undefined ? {} : startingValuesOf({ params: { [WITH_PARAM]: start } });
          setState({
            status: "ready",
            record: { ...defaultsOf(meta), ...starting } as T,
            meta: meta ?? null,
            error: null,
          });
        },
        (error: unknown) => {
          if (aborter.signal.aborted) return;
          setReadFor(id);
          setState((now) => ({ status: "failed", record: null, meta: now.meta, error }));
        },
      );
      return () => aborter.abort();
    }
    transport.one<T>(entity.one(id), aborter.signal).then(
      (answer) => {
        if (answer.meta) metas.set(entity.key, answer.meta);
        if (aborter.signal.aborted) return;
        forget();
        setReadFor(id);
        setDraft(answer.draft);
        // A server that answers the record FROM the draft (sincpro_framework) sends no values
        // apart: the record is the draft. One that sends them apart, they are what was typed.
        if (answer.draft?.values) setTyped(answer.draft.values);
        setState({
          status: "ready",
          record: answer.record,
          meta: answer.meta ?? metas.get(entity.key) ?? null,
          error: null,
        });
      },
      (error: unknown) => {
        if (aborter.signal.aborted) return;
        setReadFor(id);
        setState((now) => ({ status: "failed", record: null, meta: now.meta, error }));
      },
    );
    return () => aborter.abort();
    // `forget` only resets this hook's own state; listing it would reload the record on every
    // render. What reloads it is the transport, the entity, the id or an explicit `reload()`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transport, metas, entity, id, isNew, start, round]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelPreview();
    };
  }, []);

  const reload = useCallback(() => setRound((n) => n + 1), []);
  const record = useMemo(() => (state.record ?? {}) as AnyRecord, [state.record]);
  const values = useMemo(
    () => ({ ...record, ...computed, ...typed }),
    [record, computed, typed],
  );
  const changed = useMemo(() => changesOf(record, typed), [record, typed]);
  const version = record["version"];
  // sincpro_framework's `Edit` names a record by `id`; a model keyed by another field (an
  // invoice's number, the server's to give) is still created through `create`.
  const byEdit =
    isNew &&
    entity.edit !== undefined &&
    (state.meta?.get_id || state.meta?.identity || "id") === "id";
  /** The record's key for a write: its own, or the one minted for it while it is new. */
  const keyNow = (): string => {
    if (!byEdit) return id;
    if (minted.current?.from !== given) minted.current = { from: given, key: newEntityId() };
    return minted.current.key;
  };

  const ask = (next: AnyRecord, name: string) => {
    const preview = entity.preview;
    const field = name.split(".")[0] ?? name;
    // What the server wrote down is computed here, as it would: a change whose every reach has
    // a formula needs the server only for a rule that judges it.
    const local = Array.isArray(next[field])
      ? undefined
      : computedLocally(state.meta, { ...record, ...next }, field);
    if (local !== undefined) setComputed((now) => ({ ...now, ...local }));
    const judged = (state.meta?.fields[field]?.judged_by?.length ?? 0) > 0;
    // A change that reaches nothing — no computation, no rule — has nothing to ask the server.
    if (preview === undefined || !needsPreview(state.meta, field)) return;
    if (local !== undefined && !judged) return;
    cancelPreview();
    pause.current = setTimeout(() => {
      // A key of the route (`{tenant_id}`) is a field of the record on screen. One it lacks is
      // a preview not asked — never an error thrown out of a timer.
      let path: string;
      try {
        path = pathFor(preview, isNew ? undefined : id, { ...record, ...next });
      } catch {
        return;
      }
      const aborter = new AbortController();
      asking.current = aborter;
      transport
        .send<Preview>(
          preview.method,
          path,
          {
            id: isNew ? null : id,
            values: isNew ? { ...record, ...next } : changesOf(record, next),
            changed: [name],
          },
          aborter.signal,
        )
        .then(
          (answer) => {
            if (aborter.signal.aborted || !mounted.current) return;
            // A list the form sent (the lines) comes back computed — subtotals — as a whole:
            // it takes the place of what was typed, each line keeping its key by position (a
            // new line has no id to be found by). Typing again cancels an answer in flight, so
            // `next` is still what is on screen.
            const fresh = answer.values ?? {};
            const lists = Object.keys(fresh).filter(
              (key) => Array.isArray(fresh[key]) && Array.isArray(next[key]),
            );
            if (lists.length > 0)
              setTyped((now) => {
                const out = { ...now };
                for (const key of lists)
                  out[key] = linesAnswered(
                    next[key] as AnyRecord[],
                    fresh[key] as AnyRecord[],
                  );
                return out;
              });
            setComputed(
              Object.fromEntries(
                Object.entries(fresh).filter(([key]) => !lists.includes(key)),
              ),
            );
            setFromServer(answer.states ?? {});
            setAdvice(answer.warnings ?? []);
          },
          () => undefined, // a preview that fails is a preview not shown; the save still decides
        );
    }, PREVIEW_PAUSE);
  };

  const refused = (error: unknown) => {
    if (error instanceof TransportError && error.problem?.kind === "conflict")
      setConflict(true);
    else setFailure(error);
  };

  // sincpro_framework's `Edit`: the record as the form holds it, whole; the fields changed; the
  // draft version read (`0`: none) — another tab that kept first wins —, and the stored version
  // the edit started from. Without an `action` it is the server's default, `save_draft`.
  const editOf = (action?: "save_draft" | "save" | "discard"): AnyRecord => ({
    id: keyNow(),
    // A new record carries what a person may write — never a field the framework writes (its
    // id, its stamps), which `Edit` refuses.
    values: isNew ? creationOf(state.meta, values) : values,
    changed: Object.keys(changed),
    version: draft?.version ?? 0,
    ...(typeof version === "number" ? { origin_version: version } : {}),
    ...(action === undefined ? {} : { action }),
  });

  const edit: Editing = {
    values,
    changed,
    dirty: Object.keys(changed).length > 0,
    set: (name, value) => {
      const next = { ...typed, [name]: value };
      setTyped(next);
      ask(next, name);
    },
    state: (name) => fieldStateOf(state.meta, name, values, fromServer),
    cell: (name, index, field) => {
      const line = (Array.isArray(values[name]) ? values[name] : [])[index] as
        AnyRecord | undefined;
      const definition = state.meta?.fields[name]?.definition;
      return fieldStateOf(
        definition,
        field,
        line ?? {},
        lineStatesOf(fromServer, name, line, index, definition?.identity || "id"),
      );
    },
    errors: failure instanceof TransportError ? errorsByField(failure.problem?.errors) : {},
    advice,
    missing: missingOf(state.meta, values, fromServer),
    saving,
    failure,
    conflict,
    // Restored: the draft's values were put back over the record (they came apart), or the
    // record itself was answered from the draft (sincpro_framework: no values apart).
    restored:
      draft !== null && (draft.values === undefined || Object.keys(changed).length > 0),
    draft,
    save: async () => {
      if (isNew && !byEdit) return create();
      const route = entity.edit ?? entity.save;
      if (route === undefined) throw new Error(`${entity.key} declares no save route`);
      cancelPreview();
      setSaving(true);
      setFailure(null);
      const key = keyNow();
      try {
        await transport.send(
          route.method,
          pathFor(route, key, values),
          entity.edit === undefined
            ? { ...changed, ...(version === undefined ? {} : { version }) }
            : editOf("save"),
        );
        setDraft(null);
        // Stored under the key it was born with: the hook becomes that record and reads it.
        if (isNew) {
          if (mounted.current) {
            forget();
            setBorn({ from: given, id: key });
          }
        } else reload();
        return true;
      } catch (error) {
        // A write is never aborted — the server may have done it — but an answer that comes
        // back after the screen left lands nowhere.
        if (mounted.current) refused(error);
        return false;
      } finally {
        if (mounted.current) setSaving(false);
      }
    },
    discard: () => {
      forget();
      // The draft lives on the server: discarding only here would bring it back on the next read.
      const route = entity.edit;
      if (route === undefined || draft === null) return;
      setDraft(null);
      // Through the promise: a route key the record lacks is refused like any failure.
      Promise.resolve()
        .then(() =>
          transport.send(route.method, pathFor(route, keyNow(), values), editOf("discard")),
        )
        .then(() => mounted.current && reload())
        .catch((error: unknown) => mounted.current && refused(error));
    },
    created,
    // A draft is kept against a record: a stored one, or a new one born by `Edit` under its key.
    ...((entity.edit ?? entity.draft) === undefined || (isNew && !byEdit)
      ? {}
      : {
          keep: async () => {
            const route = (entity.edit ?? entity.draft)!;
            try {
              const kept = await transport.send<Edited>(
                route.method,
                pathFor(route, keyNow(), values),
                entity.edit === undefined ? editOf() : editOf("save_draft"),
              );
              const now = kept.draft;
              if (now)
                setDraft({
                  values: changed,
                  version: now.version,
                  ...(now.origin_version === undefined
                    ? {}
                    : { origin_version: now.origin_version }),
                });
            } catch (error) {
              refused(error);
            }
          },
        }),
  };

  async function create(): Promise<boolean> {
    const route = entity.create;
    if (route === undefined) throw new Error(`${entity.key} declares no create route`);
    cancelPreview();
    setSaving(true);
    setFailure(null);
    setCreated(null);
    const body = creationOf(state.meta, values);
    const idempotencyKey = creating.current.keyFor(body);
    try {
      const answer = await transport.send<unknown>(
        route.method,
        pathFor(route, undefined, body),
        body,
        undefined,
        { idempotencyKey },
      );
      creating.current.settle(null);
      if (!mounted.current) return true;
      const key = state.meta?.get_id || state.meta?.identity || "id";
      const made =
        typeof answer === "object" && answer !== null
          ? (answer as AnyRecord)[key]
          : undefined;
      forget();
      if (typeof made === "string" || typeof made === "number")
        setBorn({ from: given, id: String(made) });
      else setCreated(answer);
      return true;
    } catch (error) {
      creating.current.settle(error);
      if (mounted.current) refused(error);
      return false;
    } finally {
      if (mounted.current) setSaving(false);
    }
  }

  const shown: RecordState<T> =
    readFor === id
      ? state
      : { status: "loading", record: null, meta: state.meta, error: null };
  return { ...shown, entity, id, isNew, locale, reload, edit };
}
