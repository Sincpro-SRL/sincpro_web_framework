# PRD_02 · Research: what supports the framework of work

Done on 2026-11-05: the code of Sincpro's repos read directly, and the industry with sources
(versions from `npm view` that day). What a source did not confirm is marked. The decisions that
come out of here are in [`../ARCHITECTURE.md`](../ARCHITECTURE.md) and the plan in
[`PRD_02_how-an-application-is-built.md`](PRD_02_how-an-application-is-built.md).

## 1. What we have at home

### sincpro_framework (Python) — the most mature reference

- `Feature` and `ApplicationService` (`sincpro_abstractions.py`) over a bus per bounded context
  (`UseFramework`); the ApplicationService runs Features with `self.feature_bus(...)`.
- Each execution opens a `"<bounded_context>/<DTO>"` span
  (`observability/tracing/span_execution.py`) with `sincpro.layer`, `sincpro.use_case`,
  `sincpro.outcome` and the context's keys; the unexpected goes to GlitchTip through
  `sentry-sdk`.
- It continues a trace from `traceparent` (`with_trace`, `with_parent_trace`); the FastAPI
  gateway also copies `tracestate`, the Starlette one does not. Problem responses carry
  `trace_id`.
- The context is a tree (`GLOBAL → … → FEATURE`) with standard keys (`user_id`, `tenant_id`,
  `correlation_id`…) and `to_client()`: what a frontend sends back in the `sincpro-context`
  header. The caller's identity lives apart and cannot be written from the context.
- Middleware = interceptors (`@bus.interceptor`), plus `on_start`/`on_completion`/`on_failure`.
- There is **no** channel toward the client (neither SSE nor WebSocket); the client contract
  publishes no events (`introspection/metamodel.py` excludes them) and nothing about traces. CORS
  belongs to the project.
- The `sincpro_framework_use_cases` guide: reusing a use case is executing its Command on the
  bus; a helper that wraps the bus skips Sentry and the trace — «the incident with nothing in
  Sentry».

### @sincpro/mobile — interceptors, no bus

- `Feature<Deps>` returns a Proxy (`interceptInstance`) that passes each public method through
  `before`/`after`/`onError` hooks; `tracingHooks` opens a `Class.method` span.
  `ApplicationService` receives its Features already built (`framework/feature.ts`, commit
  `e4607a1`, already in `main`).
- The active span lives in a **global stack** (`infrastructure/context_manager`): with two async
  calls at once, the parents cross and a pop removes another call's entry.
- `createAppShell` does not call `initTelemetry`: in the applications the spans do nothing.
- `Stream`, `RuntimeContext` and `ServiceRuntime` do not exist; the `UIEventBus` (mitt, 300 ms
  debounce) and the `EventBus` persisted in SQLite do.
- The pure pieces (Feature, interceptors, context, `DomainModule`, `UIEventBus`) run in a
  browser; the rest drags Expo in (`DomainEvent` uses `expo-crypto`, `Entity` uses SQLite).

### sincpro_mobile_distribution — mobile's reference application

One bounded context, 9 aggregates, some 285 files: `entrypoints/` (41: the module and the shell,
29 screens in `AppRoutes`, 29 subscribers, 2 crons, migrations), `domain/` (40, with
`domain/common` for the shared language), `adapters/` (23), `services/` (13, some 3 900 lines),
`ui/` (168: screens with their `*.context.tsx`, wizards, atomic components).

- The screen pattern: a Provider with the state, the calls to services and the subscriptions to
  the `UIEventBus`; a component that assembles mobile-ui's views; components that read their
  screen's context.
- **What not to repeat**: a global context of 34 members (session, geo, settings, route, zone,
  format, scanner, server…); wizard contexts of 483 and 506 lines; one service per aggregate
  (`SaleOrderService`: 615 lines, some 28 methods); `UIEventBus.on/off` by hand in each screen —
  its own roadmap notes that `off()` never finds the wrapped handler.
- **What does not come to web**: SQLite as the truth, syncing with subscribers and crons, one
  screen at a time without a URL, full-screen wizards.

### sincpro_web_composer

- `WorkspaceStore`: page, panels, peek, modals, focus, selection; the state in the URL's hash.
- The view receives `api` **only as a prop** (there is no `useApi()`), with `context.focused()`,
  `context.selection()`, `over`, `choosing`, `surface` and the `ResourceRef`'s `params`.
- There are **no** events between views or between tabs; `ViewHost`'s `ErrorBoundary` only does
  `console.error`; `StoreOptions.onChange` exists «for telemetry» and nobody uses it.

### sincpro_forge/web — the only consumer

- It mounts `SincproApp` with the transport (`Authorization` and `X-Forge-Tenant`), the views
  from `entityView` and five entities; the metas come from the discovery document.
- Almost everything goes through the framework; there is no raw `fetch`. But: views of 789/462/354
  lines, no `services/` or `components/`, entities with their TSX in `adapters/`, a
  `record_screen` that repeats `EntityRecord`, permissions (`useAccess`) in the views, no
  telemetry or errors, without the generated client (it uses 1.0.0).

### @sincpro/web-framework

- No traces, no error reporting, no real time.
- `cachedTransport` forgets on write but **does not notify**: each component reloads its own list
  (`rowCommands.ts`, `RelatedList.tsx`); saving in a modal does not refresh the page.
- `useRecord` (530 lines) mixes 25 calls to React hooks with 5 calls to the transport: a use
  case that can only be run from a screen.

## 2. Telemetry and errors in the browser

- **OpenTelemetry JS 3.0.0** (20 Oct 2026) removed `sdk-trace-web`/`sdk-trace-base`; the package
  is `@opentelemetry/sdk-trace` (3.1.0) with `StackContextManager`. The classic fetch/XHR
  instrumentations are deprecated and the new ones (`opentelemetry-browser`) are experimental
  0.x; the official guide still says «experimental and mostly unspecified».
  [releases](https://github.com/open-telemetry/opentelemetry-js/releases) ·
  [v3.0.0](https://github.com/open-telemetry/opentelemetry-js/releases/tag/v3.0.0) ·
  [opentelemetry-browser](https://github.com/open-telemetry/opentelemetry-browser) ·
  [guide](https://opentelemetry.io/docs/languages/js/getting-started/browser/)
- Async context in the browser: Zone.js is the only thing that survives an `await` (it patches
  globals); TC39's AsyncContext is still at Stage 2. → **pass the context explicitly** and have
  the transport write `traceparent`.
  [AsyncContext](https://tc39.es/proposal-async-context/)
- Export only OTLP/HTTP to a Collector of our own with `cors.allowed_origins`; sampling and
  redaction in the Collector; `sampled=00` from the browser makes the backend (`ParentBased`)
  drop it.
  [otlpreceiver](https://github.com/open-telemetry/opentelemetry-collector/blob/main/receiver/otlpreceiver/README.md)
- **Sentry JS 11.11 → GlitchTip**: errors, breadcrumbs, source maps (debug IDs), releases and
  logs work; replay, distributed traces and page-load transactions do not. v11's span streaming
  is not read by GlitchTip. `dataCollection` collects more by default (headers, cookies, bodies,
  IP): in an ERP it has to be restricted. Do not mix `browserTracingIntegration` with our own
  OpenTelemetry.
  [GlitchTip CLI](https://glitchtip.com/documentation/cli) ·
  [comparison](https://betterstack.com/community/comparisons/sentry-vs-glitchtip/) ·
  [v10→v11](https://docs.sentry.io/platforms/javascript/migration/v10-to-v11/) ·
  [options](https://docs.sentry.io/platforms/javascript/guides/react/configuration/options/) ·
  [React](https://docs.sentry.io/platforms/javascript/guides/react/usage/)
- **Grafana Faro 2.13**: errors, logs, Web Vitals, sessions, replay; its traces are still on
  OTel 2.x (what 3.0 removed); own protocol through Alloy. Useful only if full RUM in Grafana is
  wanted, and even then with GlitchTip for the errors.
  [changelog](https://raw.githubusercontent.com/grafana/faro-web-sdk/main/CHANGELOG.md) ·
  [faro.receiver](https://grafana.com/docs/alloy/latest/reference/components/faro/faro.receiver/)

**Adopt**: a span per use case with the backend's name, `traceparent` written by the transport,
OTel in a separate, lazy entry, Sentry SDK → GlitchTip only for errors, restricted collection,
`trace_id` as the support code. **Avoid**: auto-instrumenting, Zone.js, two trace SDKs, form
bodies as attributes.

## 3. State and cache

| Package                   | Version             | gzip    |
| ------------------------- | ------------------- | ------- |
| `@tanstack/react-query`   | 5.106.1             | 13.3 kB |
| `zustand`                 | 5.0.16              | 0.5 kB  |
| `jotai`                   | 3.0.1               | 3.3 kB  |
| `swr`                     | 2.5.1               | 5.7 kB  |
| `@reduxjs/toolkit`        | 2.14.0              | 14.6 kB |
| `@refinedev/core`         | 5.0.12 (April 2026) | —       |
| `react-admin` / `ra-core` | 5.15.5              | —       |
| `@tanstack/db`            | 1.0.0-rc.1.3        | —       |

- **TanStack Query**: hierarchical keys; `invalidateQueries` by prefix marks stale and asks again
  only what is mounted — what `cachedTransport` lacks. It deduplicates, distinguishes
  `isPending`/`isFetching`, `placeholderData`, optimistic mutations and serial ones by
  `scope.id`, Suspense, devtools; it persists in IndexedDB (`persistQueryClient`,
  `setMutationDefaults`, `resumePausedMutations`). It is the only one of those compared with
  offline mutations.
  [invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation) ·
  [mutations](https://tanstack.com/query/latest/docs/framework/react/guides/mutations) ·
  [persistence](https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient) ·
  [comparison](https://tanstack.com/query/latest/docs/framework/react/comparison)
- `broadcastQueryClient` (between tabs) is experimental and breaks in minors: better a
  `BroadcastChannel` of our own with invalidation events.
  [broadcast](https://tanstack.com/query/latest/docs/framework/react/plugins/broadcastQueryClient)
- **Context is injection, not state**: each consumer redraws on every change.
  [Erikson](https://blog.isquaredsoftware.com/2021/01/context-redux-differences/) ·
  [TkDodo](https://tkdodo.eu/blog/zustand-and-react-context)
- **A store per instance**: Zustand `createStore` + Context + `useState(() => createStore(props))`.
  [Zustand](https://zustand.docs.pmnd.rs/learn/guides/initialize-state-with-props)
- **refine** (v5: React 19, TanStack Query v5): providers as plain objects (data, auth,
  notification, i18n, router, live, auditLog); `liveProvider` turns events into invalidation
  (`liveMode` auto/manual/off). The core has not published since April 2026.
  [v5](https://refine.dev/blog/refine-v5-announcement) ·
  [live](https://refine.dev/docs/realtime/live-provider/) ·
  [invalidate](https://refine.dev/docs/data/hooks/use-invalidate/)
- **react-admin**: headless `ra-core` with two UIs (MUI and Shadcn); undoable `mutationMode`;
  `addOfflineSupportToQueryClient`; real time is paid; the Guessers are «not in production».
  [ra-core](https://marmelab.com/ra-core/features/) ·
  [realtime](https://marmelab.com/react-admin/Realtime.html) ·
  [ListGuesser](https://marmelab.com/react-admin/ListGuesser.html)
- What they do badly and we do not do here: business commands as «custom» without types or
  invalidation, generation by guessing from data, access control on the client.
- **TanStack DB** (1.0 RC1, 29 Oct 2026): live queries over client collections — clashes with
  «never filter on the page», except for bounded subsets (the POS catalogue).
  [RC1](https://tanstack.com/blog/tanstack-db-1.0-rc1-going-all-in-on-oracles)

## 4. Metadata-driven enterprise UIs and their extension

- **SAP Fiori elements + FPM**: annotations → List Report / Object Page; own columns, sections
  and actions with `position: { placement, anchor }` over stable keys; building blocks that keep
  draft and side effects; «the Extension API as the only supported interface»; layers
  VENDOR → CUSTOMER → USER (the exact order of layers, from prior knowledge). Weak point: finding
  the anchor by inspecting the DOM.
  [extension points](https://learning.sap.com/courses/developing-an-sap-fiori-elements-app-based-on-a-cap-odata-v4-service/using-extension-points_d613eea6-2548-4db3-a7c1-2ef9b52653b5) ·
  [anchors](https://github.com/SAP-docs/sapui5/blob/main/docs/06_SAP_Fiori_Elements/finding-the-right-key-for-the-anchor-6ffb084.md) ·
  [FPM](https://learning.sap.com/courses/developing-an-sap-fiori-elements-app-based-on-a-cap-odata-v4-service/getting-an-overview-of-the-flexible-programming-model_fc9ea1ee-20a8-4add-b3f9-c8c8e3701ae0)
- **Power Apps PCF**: the control declares its `bound`/`input`/`output` properties with a field
  type; managed/unmanaged layers; forms merge by section and the conflict lands in a generated
  tab.
  [manifest](https://learn.microsoft.com/en-us/power-apps/developer/component-framework/manifest-schema-reference/property) ·
  [layers](https://learn.microsoft.com/en-us/power-platform/alm/solution-layers-alm)
- **Odoo (OWL)**: registries by string with `force`, `patch()` that mutates globally, view
  inheritance by XPath: everything extensible, and that is where the chaos starts (load order,
  `replace`, XPath that breaks on update).
  [registries](https://www.odoo.com/documentation/18.0/developer/reference/frontend/registries.html) ·
  [patch](https://www.odoo.com/documentation/18.0/developer/reference/frontend/patching_code.html)
- **Salesforce LWC**: the component declares where it can go (`targets`) and what the admin
  configures; the page injects `recordId` into it; the page is chosen from the most specific to
  the least.
  [App Builder](https://developer.salesforce.com/docs/platform/lwc/guide/use-config-for-app-builder.html)
- **Backstage, new frontend system** (RC 1.0 in 1.49): extension = id + `attachTo` + typed
  output + `configSchema`; one id per extension; the override creates another without mutating;
  components swappable by typed reference.
  [extensions](https://backstage.io/docs/frontend-system/architecture/extensions) ·
  [overrides](https://backstage.io/docs/frontend-system/architecture/extension-overrides) ·
  [swappable](https://backstage.io/docs/frontend-system/building-plugins/swappable-components)

**Copy**: id + slot + typed contract (Backstage); an anchor with `placement` and blocks that keep
the behaviour (Fiori); the control typed by field type (PCF); the component that declares where
it can go (Salesforce); ordered layers with customisation as data. **Avoid**: `patch()`, XPath,
registries by string with `force`, anchors searched in the DOM, visibility rules in the UI,
variants that get forked.

## 5. Architecture for several applications

- **Feature-Sliced Design 2.1**: layers app → pages → widgets → features → entities → shared, a
  slice does not import another of its layer, a public API per slice. What is taken is the public
  API, «pages-first» and the idea of a widget; its layer names are not taken — its «feature» is
  an interaction with UI and here a Feature is a use case without UI.
  [layers](https://feature-sliced.design/docs/reference/layers) ·
  [public API](https://feature-sliced.design/docs/reference/public-api) ·
  [excessive entities](https://feature-sliced.design/docs/guides/issues/excessive-entities)
- **Enforcing boundaries**: strict pnpm workspaces (between packages) + dependency-cruiser
  (resolved graph, rules per folder, CLI) from `make doctor`; eslint-plugin-boundaries if an
  editor warning is wanted; Nx's rules need projects and Conformance is paid.
  [dependency-cruiser](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md) ·
  [boundaries](https://www.jsboundaries.dev/)
- **Repos**: the platform (criteria, web-ui, composer, web-framework) stays published; each
  product with several applications, a monorepo with pnpm (catalogs for one version of React and
  web-ui) and a compiled package per bounded context.
  [catalogs](https://pnpm.io/11.x/catalogs) ·
  [internal packages](https://turborepo.dev/docs/core-concepts/internal-packages)
- **Shells**: Vite SPA for backoffice and POS; PWA with an idempotent outbox (Background Sync
  only in Chromium); portal as an SPA unless SSR is needed; shop with SSR — React Router in
  framework mode, to be evaluated against TanStack Start (its stable 1.0 was confirmed in a
  secondary source); Next.js App Router not as a default (every hook asks for `"use client"`).
  [Background Sync](https://caniuse.com/background-sync) ·
  [React Router](https://remix.run/blog/react-router-v8) ·
  [TanStack Start](https://tanstack.com/start/latest/docs/framework/react/comparison) ·
  [Next.js](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- **Micro-frontends** (Module Federation 2.0 stable): not between our own bounded contexts; only
  for third-party extensions installed at run time.
  [MF 2.0](https://www.infoq.com/news/2026/04/module-federation-2-stable)
- **Scaffolding**: extend our own generator, which already reads the contract, instead of
  plop/hygen.
- **DDD on the frontend**: hooks are thin adapters over the use cases, and the use cases are
  tested in Node with a fake transport.
  [FSD + clean](https://feature-sliced.design/blog/frontend-clean-architecture) ·
  [Sperl 2026](https://www.benedikt-sperl.de/blog/2026-03-16-domain-driven-design-in-frontend-applications)

## 6. Real time and media

- **SSE** first: it reconnects by itself, resumes with `Last-Event-ID`, no connection limit over
  HTTP/2-3; `EventSource` sends no headers (cookie, short ticket or the `eventsource` v4 package
  with a `fetch` of our own); heartbeats and `X-Accel-Buffering: no` on proxies. WebSocket for
  chat or collaboration; WebTransport not yet for an ERP. The pattern: the server pushes a small
  event and the client invalidates and reads again.
  [eventsource](https://github.com/EventSource/eventsource) ·
  [SSE](https://websocket.org/comparisons/sse/) ·
  [TkDodo](https://tkdodo.eu/blog/using-web-sockets-with-react-query)
- **Uploads**: presigned PUT, multipart for big ones (Uppy 6); tus if truly resumable uploads are
  needed. `fetch` still has no upload progress: XHR with `upload.onprogress`. Capture with
  `getUserMedia` + `MediaRecorder` (webm/opus, then mp4/AAC). WebRTC needs an SFU, TURN and
  signalling: it belongs to the application.
  [Uppy S3](https://uppy.io/docs/aws-s3/) ·
  [request streams](https://caniuse.com/wf-fetch-request-streams)
