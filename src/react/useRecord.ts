"use client";

import type { AnyRecord, Meta } from "@sincpro/criteria";
import {
  changesOf,
  errorsByField,
  type FieldState,
  fieldStateOf,
  type FieldStates,
  missingOf,
} from "@sincpro/web-framework/core/edit";
import { type Entity, pathFor } from "@sincpro/web-framework/core/entity";
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
  /** Store the current edit as a draft — only when the entity declares where. */
  keep?: () => Promise<void>;
};

export type RecordReading<T> = RecordState<T> & {
  entity: Entity<T & AnyRecord>;
  locale: string | undefined;
  reload: () => void;
  edit: Editing;
};

type Preview = { values?: AnyRecord; fields?: FieldStates; advice?: Advice[] };

/** How long typing has to pause before the server is asked what the record becomes. */
const PREVIEW_PAUSE = 300;

export function useRecord<T extends AnyRecord>(
  entity: Entity<T>,
  id: string,
): RecordReading<T> {
  const { transport, locale, metas } = useFramework();
  const [state, setState] = useState<RecordState<T>>({
    status: "loading",
    record: null,
    meta: null,
    error: null,
  });
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
    transport.one<T>(entity.one(id), aborter.signal).then(
      (answer) => {
        if (answer.meta) metas.set(entity.key, answer.meta);
        if (aborter.signal.aborted) return;
        forget();
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
        if (!aborter.signal.aborted)
          setState((now) => ({ status: "failed", record: null, meta: now.meta, error }));
      },
    );
    return () => aborter.abort();
    // `forget` only resets this hook's own state; listing it would reload the record on every
    // render. What reloads it is the transport, the entity, the id or an explicit `reload()`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transport, metas, entity, id, round]);
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
          pathFor(preview, id),
          { id, values: changesOf(record, next), changed: [name] },
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
    ...(entity.draft === undefined
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

  return { ...state, entity, locale, reload, edit };
}
