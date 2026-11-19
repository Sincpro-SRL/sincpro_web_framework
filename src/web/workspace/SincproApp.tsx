"use client";

import {
  type ChangeFeed,
  type Entity,
  processChanges,
  processContext,
  reportError,
  type Transport,
} from "@sincpro/client-framework";
import type { Meta } from "@sincpro/criteria";
import {
  Composer,
  type ComposerSkin,
  installComposerCopy,
  type OnViewError,
  type ResourceRef,
  SPANISH_COMPOSER_COPY,
  useWorkspace,
  type ViewSpec,
  type WorkspaceStore,
} from "@sincpro/web-composer";
import { createRegistry, formatRef, PHONE_WIDTH } from "@sincpro/web-composer/domain";
import {
  type CachedTransport,
  cachedTransport,
  type CacheOptions,
} from "@sincpro/web-framework/core/cache";
import {
  installFrameworkCopy,
  SPANISH_FRAMEWORK_COPY,
} from "@sincpro/web-framework/core/copy";
import type { DateStyle } from "@sincpro/web-framework/core/present";
import { FrameworkProvider } from "@sincpro/web-framework/react/context";
import { useSearchRecords } from "@sincpro/web-framework/web/list/records";
import { webUiSkin } from "@sincpro/web-framework/web/workspace/skin";
import {
  installCopy,
  SearchProvider,
  SPANISH_COPY,
  ToastProvider,
  useSearchSettings,
} from "@sincpro/web-ui";
import { type ReactNode, useEffect, useMemo, useState, useSyncExternalStore } from "react";

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
/** Narrower than composer's phone (`PHONE_WIDTH`): the workspace fills the window here, so the
 *  window's width is the workspace's. */
const PHONE = `(max-width: ${PHONE_WIDTH - 1}px)`;

function onPhone(changed: () => void): () => void {
  if (typeof window === "undefined" || window.matchMedia === undefined)
    return () => undefined;
  const query = window.matchMedia(PHONE);
  query.addEventListener("change", changed);
  return () => query.removeEventListener("change", changed);
}

const isPhone = () =>
  typeof window !== "undefined" && window.matchMedia !== undefined
    ? window.matchMedia(PHONE).matches
    : false;

/**
 * The framework's search of a relation's records for every web-ui bar and builder below — a
 * screen's own `SearchBar` included —, unless the application put its own around the app.
 * Inside the `FrameworkProvider`: it searches through the screens' transport.
 */
function FrameworkSearch({ children }: { children: ReactNode }) {
  const framework = useSearchRecords();
  const outer = useSearchSettings();
  return (
    <SearchProvider searchRecords={outer.searchRecords ?? framework}>
      {children}
    </SearchProvider>
  );
}

/** A view that broke while drawing, told to the process's error reporter: `view <ref>`. */
const reportViewError: OnViewError = (error, { resource }) =>
  reportError(error, `view ${formatRef(resource)}`);

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
  timeZone,
  dateStyle,
  currency,
  events,
  workspace: given,
  bar,
  onViewError = reportViewError,
  changes = processChanges,
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
  /** Where the business is (`"America/La_Paz"`): every date and time on its wall clock.
   *  Without it, the browser's. */
  timeZone?: string;
  /** How dates are written. Without it, numeric — «16/11/2026» — and the month in words on a
   *  phone, where a word reads better than a column of digits. */
  dateStyle?: DateStyle;
  /** The business's currency (`"BOB"`): an amount the model draws as money is written in it. */
  currency?: string;
  /** Each domain event's definition by its wire name (`eventMetasOf(contract)`): a history
   *  names each fact's own fields in its words. */
  events?: Readonly<Record<string, Meta>>;
  /** The workspace, when the app needs to reach it (a menu of its bar): composer's
   *  `useWorkspace()`. Without it, the app keeps one of its own. */
  workspace?: WorkspaceStore;
  /** The application's bar, above the workspace and inside the providers: its menus may read
   *  the framework (`useFramework`) and open views through `workspace`. */
  bar?: ReactNode;
  /**
   * Told when a view breaks while drawing. By default it reaches the process's error reporter
   * (`reportError`, @sincpro/client-framework) — the one the use cases report to — as
   * `view <ref>`; without a reporter configured, nothing is sent.
   */
  onViewError?: OnViewError;
  /**
   * Where writes are announced — the process's (`processChanges`, @sincpro/client-framework),
   * which every transport of the framework writes to, whoever sends: a screen, or a use case's
   * generated client. The cache forgets what each write touches, and the screens read it again.
   */
  changes?: ChangeFeed;
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
  // What was read in one company is not the other's, and what anyone wrote is no longer what was
  // read: a change of context forgets every answer, a write what it touched — whoever wrote it, a
  // use case's client as much as a screen — before the screens read again.
  useEffect(() => {
    if (cache === false) return;
    const forgetting = cached as CachedTransport;
    const unwatch = processContext.watch(() => forgetting.invalidate());
    const unfollow = changes.follow((change) => forgetting.changed(change));
    return () => {
      unwatch();
      unfollow();
    };
    // The cache is read once, as `cached` is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cached, changes]);
  const phone = useSyncExternalStore(onPhone, isPhone, () => false);
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
      changes={changes}
      {...(metas === undefined ? {} : { metas })}
      {...(entities === undefined ? {} : { entities })}
      {...(timeZone === undefined ? {} : { timeZone })}
      dateStyle={dateStyle ?? (phone ? "literal" : "numeric")}
      {...(currency === undefined ? {} : { currency })}
      {...(events === undefined ? {} : { events })}
    >
      <FrameworkSearch>
        <ToastProvider>
          <div className="flex h-dvh min-h-0 flex-col bg-ground">
            {bar}
            <div className="flex min-h-0 flex-1 flex-col">
              <Composer
                workspace={workspace}
                registry={registry}
                skin={skin}
                onViewError={onViewError}
                {...(empty === undefined ? {} : { empty })}
              />
            </div>
          </div>
        </ToastProvider>
      </FrameworkSearch>
    </FrameworkProvider>
  );
}
