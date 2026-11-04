"use client";

import type { Meta } from "@sincpro/criteria";
import {
  Composer,
  type ComposerSkin,
  installComposerCopy,
  type ResourceRef,
  SPANISH_COMPOSER_COPY,
  useWorkspace,
  type ViewSpec,
  type WorkspaceStore,
} from "@sincpro/web-composer";
import { createRegistry } from "@sincpro/web-composer/domain";
import { cachedTransport, type CacheOptions } from "@sincpro/web-framework/core/cache";
import {
  installFrameworkCopy,
  SPANISH_FRAMEWORK_COPY,
} from "@sincpro/web-framework/core/copy";
import type { Entity } from "@sincpro/web-framework/core/entity";
import type { Transport } from "@sincpro/web-framework/core/transport";
import { FrameworkProvider } from "@sincpro/web-framework/react/context";
import { webUiSkin } from "@sincpro/web-framework/web/workspace/skin";
import { installCopy, SPANISH_COPY, ToastProvider } from "@sincpro/web-ui";
import { type ReactNode, useEffect, useMemo, useState } from "react";

/**
 * The application context in one place: who answers (the transport), in which language, which
 * model definitions are already known, the toasts, and the workspace with its views, ⌘K and
 * shortcuts.
 *
 * Context: forge's `main.tsx` + `console.tsx` installed three copy tables, a toast provider, a
 * context of its own and a composer by hand. This is that, once. It is a convenience, not the
 * only door: everything it mounts is exported, and an app with its own shell mounts them itself.
 * What it does NOT own: the session (the app builds the transport with its headers) and what the
 * application bar says. The bar is the app's (`bar`), drawn above the workspace inside every
 * provider; a menu in it opens views through the workspace the app holds (`workspace`, from
 * composer's `useWorkspace()`) — a workspace owned in here could not be reached from outside.
 *
 *     const workspace = useWorkspace();
 *     <SincproApp workspace={workspace} bar={<Menu onOpen={(ref) => workspace.push(ref)} />} … />
 */
export function SincproApp({
  transport,
  views,
  start,
  language = "es",
  metas,
  entities,
  empty,
  skin = webUiSkin,
  cache = {},
  workspace: given,
  bar,
}: {
  transport: Transport;
  /** The entities as composer views — `entityView(…)` — and any other view of the app. */
  views: readonly ViewSpec[];
  /** The application's entities: a form draws a many2one of any of them without being told. */
  entities?: readonly Entity[];
  /** What opens first: a list, usually — `invoices.ref()`. */
  start?: ResourceRef;
  /** The interface's language: web-ui's, the composer's and the framework's words. */
  language?: "es" | "en";
  /** Definitions known before any request, by entity key. */
  metas?: Readonly<Record<string, Meta>>;
  /** Drawn when nothing is open. */
  empty?: ReactNode;
  /** How the workspace looks. web-ui's by default (`webUiSkin`); any piece can be replaced. */
  skin?: ComposerSkin;
  /**
   * Repeated reads served from memory — the list gone back to, the record reopened — and
   * forgotten the moment a write touches their entity (`cachedTransport`). 30 s by default;
   * `false` asks the server every time.
   */
  cache?: CacheOptions | false;
  /** The workspace, when the app needs to reach it (a menu of its bar): composer's
   *  `useWorkspace()`. Without it, the app keeps one of its own. */
  workspace?: WorkspaceStore;
  /** The application's bar, above the workspace and inside the providers: its menus may read
   *  the framework (`useFramework`) and open views through `workspace`. */
  bar?: ReactNode;
}) {
  // Installed once, before anything draws: the three tables are module state of their packages.
  useState(() => {
    if (language === "es") {
      installCopy(SPANISH_COPY);
      installComposerCopy(SPANISH_COMPOSER_COPY);
      installFrameworkCopy(SPANISH_FRAMEWORK_COPY);
    }
    return null;
  });
  const cached = useMemo(
    () =>
      cache === false
        ? transport
        : cachedTransport(transport, {
            ...(entities === undefined ? {} : { entities }),
            ...cache,
          }),
    // The options are read once: a cache that changes shape mid-session forgets everything.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transport],
  );
  const own = useWorkspace();
  const workspace = given ?? own;
  const registry = useMemo(() => createRegistry(views), [views]);
  useEffect(() => {
    if (start !== undefined) workspace.push(start);
    // The first screen only: a re-render must not push it again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace]);

  return (
    <FrameworkProvider
      transport={cached}
      locale={language}
      {...(metas === undefined ? {} : { metas })}
      {...(entities === undefined ? {} : { entities })}
    >
      <ToastProvider>
        <div className="flex h-dvh min-h-0 flex-col bg-ground">
          {bar}
          <div className="flex min-h-0 flex-1 flex-col">
            <Composer
              workspace={workspace}
              registry={registry}
              skin={skin}
              {...(empty === undefined ? {} : { empty })}
            />
          </div>
        </div>
      </ToastProvider>
    </FrameworkProvider>
  );
}
