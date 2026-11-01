"use client";

import type { Meta } from "@sincpro/criteria";
import type { Entity } from "@sincpro/web-framework/core/entity";
import { type MetaStore, metaStore } from "@sincpro/web-framework/core/metas";
import { entityFor } from "@sincpro/web-framework/core/relation";
import type { Trail } from "@sincpro/web-framework/core/trail";
import type { Transport } from "@sincpro/web-framework/core/transport";
import { createContext, type ReactNode, useContext, useMemo, useState } from "react";

/**
 * Who answers, in which language a screen reads, and which model definitions are already
 * known — for everything under it.
 *
 * Context: a view receives its record reference and nothing else — the composer hands it no
 * client on purpose — so the transport reaches it through context, set once where the
 * application starts.
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
  children: ReactNode;
}) {
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
