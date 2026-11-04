"use client";

import type { Meta } from "@sincpro/criteria";
import type { Entity } from "@sincpro/web-framework/core/entity";
import { type MetaStore, metaStore } from "@sincpro/web-framework/core/metas";
import { entityFor } from "@sincpro/web-framework/core/relation";
import type { Trail } from "@sincpro/web-framework/core/trail";
import type { Transport } from "@sincpro/web-framework/core/transport";
import { installTimeZone } from "@sincpro/web-framework/core/zone";
import { createContext, type ReactNode, useContext, useMemo, useRef, useState } from "react";

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
 * transport's `headers` — the backend's `sincpro-context` header is read by every entrance.
 */
type FrameworkContextValue = {
  transport: Transport;
  locale: string | undefined;
  metas: MetaStore;
  /** The application's entities: what a relation of a model is resolved to. */
  entities: readonly Entity[];
  /** Where each open record came from (`Trail`), by the key its reference carries. */
  trails: Map<string, Trail>;
};

const FrameworkContext = createContext<FrameworkContextValue | null>(null);

export function FrameworkProvider({
  transport,
  locale,
  metas: seed,
  entities = NO_ENTITIES,
  timeZone,
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
  const value = useMemo(
    () => ({ transport, locale, metas, entities, trails }),
    [transport, locale, metas, entities, trails],
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
