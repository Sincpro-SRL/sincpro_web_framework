"use client";

import type { Meta } from "@sincpro/criteria";
import { type MetaStore, metaStore } from "@sincpro/web-framework/core/metas";
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
};

const FrameworkContext = createContext<FrameworkContextValue | null>(null);

export function FrameworkProvider({
  transport,
  locale,
  metas: seed,
  children,
}: {
  transport: Transport;
  /** The language labels and values are read in (`"es"`); the model's `default` without it. */
  locale?: string;
  /** Definitions known before any request, by entity key: the preload. */
  metas?: Readonly<Record<string, Meta>>;
  children: ReactNode;
}) {
  // One store for the provider's life: a new seed object on a re-render must not forget what
  // the screens already learned.
  const [metas] = useState(() => metaStore(seed));
  const value = useMemo(() => ({ transport, locale, metas }), [transport, locale, metas]);
  return <FrameworkContext.Provider value={value}>{children}</FrameworkContext.Provider>;
}

export function useFramework(): FrameworkContextValue {
  const value = useContext(FrameworkContext);
  if (value === null) throw new Error("useFramework outside a FrameworkProvider");
  return value;
}
