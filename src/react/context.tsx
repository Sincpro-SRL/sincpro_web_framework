"use client";

import {
  type ChangeFeed,
  type Entity,
  installTimeZone,
  type MetaStore,
  metaStore,
  processChanges,
  processContext,
  screensTransport,
  type Transport,
} from "@sincpro/client-framework";
import type { Meta } from "@sincpro/criteria";
import { type NameBook, nameBook } from "@sincpro/web-framework/core/names";
import { entityFor } from "@sincpro/web-framework/core/relation";
import type { Trail } from "@sincpro/web-framework/core/trail";
import { useContextValues } from "@sincpro/web-framework/react/useContextValues";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * Who answers, in which language a screen reads, and which model definitions are already
 * known — for everything under it.
 *
 * Context: a view receives its record reference and nothing else — the composer hands it no
 * client on purpose — so the transport reaches it through context, set once where the
 * application starts.
 *
 * This is the GLOBAL part, and only that. What an OPENING carries is the composer's, and it
 * already has it: `params` on the reference (a company, a filter, a default — survives a reload
 * and a link), `api.over` (in a modal, the record it covers), `pick(…, { question })` +
 * `api.choosing` (what a chooser was asked, in memory) and `api.context` (what the user is on,
 * what is selected). Read `~/dev/sincpro_web_composer/README.md` before writing a second one
 * here. A value the backend must see on every request (the active company) goes in the
 * process's context (`processContext.set({ company_id })`, @sincpro/client-framework): every
 * request under this provider carries it in `sincpro-context` (`screensTransport`), and a change
 * reads every screen again.
 *
 * What was written is the process's too (`processChanges`, @sincpro/client-framework): every write
 * a transport of the framework sends is announced there, whoever sent it — a screen, or a use
 * case's generated client. A reading on screen follows it (`useWrites`) and reads again when a
 * write touches what it shows; the names in cells (`useNameOf`) are asked through one book per
 * transport and company (`nameBook`), and forget what a write touches.
 */
type FrameworkContextValue = {
  transport: Transport;
  locale: string | undefined;
  metas: MetaStore;
  /** The application's entities: what a relation of a model is resolved to. */
  entities: readonly Entity[];
  /** Where each open record came from (`Trail`), by the key its reference carries. */
  trails: Map<string, Trail>;
  /** The process's context now: a reading reads again when it changes (another company). */
  context: Readonly<Record<string, unknown>>;
  /** Where writes are announced: a reading reads again when one touches it (`useWrites`). */
  changes: ChangeFeed;
  /** The names of records by key, asked one request per entity (`useNameOf`). */
  names: NameBook;
};

const FrameworkContext = createContext<FrameworkContextValue | null>(null);

export function FrameworkProvider({
  transport,
  locale,
  metas: seed,
  entities = NO_ENTITIES,
  timeZone,
  changes = processChanges,
  children,
}: {
  transport: Transport;
  /** The language labels and values are read in (`"es"`); the model's `default` without it. */
  locale?: string;
  /** Definitions known before any request, by entity key: the preload. */
  metas?: Readonly<Record<string, Meta>>;
  /** The entities of the application: a form draws a many2one as a picker of the one its
   *  model points at (`relation: "Cliente"`) without being told. */
  entities?: readonly Entity[];
  /** Where the business is (IANA: `"America/La_Paz"`) — the application's, or the company's
   *  the user works in: every date and time reads and is typed on its wall clock. Without it,
   *  the browser's. */
  timeZone?: string;
  /** Where writes are announced — the process's (`processChanges`) unless a test gives another. */
  changes?: ChangeFeed;
  children: ReactNode;
}) {
  // Installed before the children draw, and again when it changes (another company): the
  // formatters read it, so it cannot wait for an effect.
  const zoned = useRef<string | undefined | null>(null);
  if (zoned.current !== timeZone) {
    installTimeZone(timeZone);
    zoned.current = timeZone;
  }
  // One store for the provider's life: a new seed object on a re-render must not forget what
  // the screens already learned.
  const [metas] = useState(() => metaStore(seed));
  const [trails] = useState(() => new Map<string, Trail>());
  // What the screens read and write is a use case of `screens` (`screensTransport`,
  // client-framework): each request traced, carrying the process's context (the company, the
  // tenant) read at the moment it is sent, and reported when it failed unexpectedly.
  const screens = useMemo(() => screensTransport(transport), [transport]);
  // When the context changes, every reading on screen reads its same question again — a list
  // keeps its filter, order and page, a record what was typed (`useListing`, `useRecord`). The
  // transport stays the same one: a new one would start every reading over.
  const context = useContextValues(processContext);
  // One book per transport and company: another company's names are not this one's.
  const names = useMemo(
    () => nameBook(screens, metas, entities),
    // `context` renews it: what was named in one company is asked again in the next.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [screens, metas, entities, context],
  );
  useEffect(() => changes.follow((change) => names.changed(change)), [changes, names]);
  const value = useMemo(
    () => ({ transport: screens, locale, metas, entities, trails, context, changes, names }),
    [screens, locale, metas, entities, trails, context, changes, names],
  );
  return <FrameworkContext.Provider value={value}>{children}</FrameworkContext.Provider>;
}

const NO_ENTITIES: readonly Entity[] = [];

export function useFramework(): FrameworkContextValue {
  const value = useContext(FrameworkContext);
  if (value === null) throw new Error("useFramework outside a FrameworkProvider");
  return value;
}

/** The declared entity a relation points at (`"Cliente"`), or `undefined`. */
export function useEntityFor(target: string | undefined): Entity | undefined {
  const { entities, metas } = useFramework();
  return target === undefined ? undefined : entityFor(entities, target, metas.get);
}
