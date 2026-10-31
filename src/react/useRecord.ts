"use client";

import type { AnyRecord, Meta } from "@sincpro/criteria";
import {
  changesOf,
  creationOf,
  defaultsOf,
  errorsByField,
  type FieldState,
  fieldStateOf,
  type FieldStates,
  missingOf,
} from "@sincpro/web-framework/core/edit";
import { type Entity, pathFor } from "@sincpro/web-framework/core/entity";
import { retryKeys } from "@sincpro/web-framework/core/retry";
import { type Draft, TransportError } from "@sincpro/web-framework/core/transport";
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
 *   - **creating** — with no id it is a record that does not exist yet: it starts from the
 *     defaults the model publishes, previews like any other, and `save()` sends it to the
 *     entity's `create` route with an `Idempotency-Key` (a retry never creates two). When the
 *     answer carries the new identity, the hook becomes that record; otherwise `edit.created`
 *     holds the answer and the screen decides where to go.
 *
 *     const invoice = useRecord(invoices, "");          // a new one
 *     const invoice = useRecord(invoices, "F-2026-7");  // an existing one
 */
export type RecordState<T> =
  | { status: "loading"; record: null; meta: Meta | null; error: null }
  | { status: "ready"; record: T; meta: Meta | null; error: null }
  | { status: "failed"; record: null; meta: Meta | null; error: unknown };

export type Advice = { field?: string; text: string };

export type Editing = {
  /** The record as on screen: what was read, what the server computed, what was typed. */
  values: AnyRecord;
  changed: AnyRecord;
  dirty: boolean;
  set: (name: string, value: unknown) => void;
  state: (name: string) => FieldState;
  /** The server's word on fields that did not validate, by field. */
  errors: Record<string, string>;
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
  /** Store the current edit as a draft — only when the entity declares where, and the record
   *  exists: a draft is kept against a record. */
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

type Preview = { values?: AnyRecord; fields?: FieldStates; advice?: Advice[] };

/** How long typing has to pause before the server is asked what the record becomes. */
const PREVIEW_PAUSE = 300;

export function useRecord<T extends AnyRecord>(
  entity: Entity<T>,
  given: string,
): RecordReading<T> {
  const { transport, locale, metas } = useFramework();
  // A create that answered its identity turns this into that record — until the screen asks
  // for another one.
  const [born, setBorn] = useState<{ from: string; id: string } | null>(null);
  const id = born !== null && born.from === given ? born.id : given;
  const isNew = id === "";
  const [created, setCreated] = useState<unknown>(null);
  const creating = useRef(retryKeys());
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
          setState({
            status: "ready",
            record: defaultsOf(meta) as T,
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
        if (answer.draft) setTyped(answer.draft.values);
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
  }, [transport, metas, entity, id, isNew, round]);
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

  const ask = (next: AnyRecord, name: string) => {
    const preview = entity.preview;
    if (preview === undefined) return;
    cancelPreview();
    pause.current = setTimeout(() => {
      const aborter = new AbortController();
      asking.current = aborter;
      transport
        .send<Preview>(
          preview.method,
          pathFor(preview, isNew ? undefined : id),
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
            setComputed(answer.values ?? {});
            setFromServer(answer.fields ?? {});
            setAdvice(answer.advice ?? []);
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
    errors: failure instanceof TransportError ? errorsByField(failure.problem?.errors) : {},
    advice,
    missing: missingOf(state.meta, values, fromServer),
    saving,
    failure,
    conflict,
    restored: draft !== null && Object.keys(changed).length > 0,
    draft,
    save: async () => {
      if (isNew) return create();
      const route = entity.save;
      if (route === undefined) throw new Error(`${entity.key} declares no save route`);
      cancelPreview();
      setSaving(true);
      setFailure(null);
      try {
        await transport.send(route.method, pathFor(route, id), {
          ...changed,
          ...(version === undefined ? {} : { version }),
        });
        setDraft(null);
        reload();
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
    discard: forget,
    created,
    ...(entity.draft === undefined || isNew
      ? {}
      : {
          keep: async () => {
            const route = entity.draft!;
            try {
              const kept = await transport.send<Draft>(route.method, pathFor(route, id), {
                values: changed,
                expected: draft?.version ?? 0,
              });
              setDraft(kept);
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
        pathFor(route),
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
