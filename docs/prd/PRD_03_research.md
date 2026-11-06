# PRD_03 · Research: how those who already went through this evolved

Done on 2026-11-06 over the current source code and official documentation. The decisions that
come out of here are in [`PRD_03_design.md`](PRD_03_design.md).

## The conclusion, before the detail

Four different fields arrived at the same thing:

1. **A service is requested by reference, never by a string.** Odoo 20 is migrating to it
   (`useService("orm")` → `usePlugin(OrmPlugin)`); Angular (`inject(TOKEN)`), Backstage
   (`useApi(ref)`) and Effect 4 (`Context.Service`) have already arrived. The string stays for
   diagnosis.
2. **Types come from the definitions**, never from a parallel, hand-written map: Odoo's `.d.ts`
   files rotted (they import names that do not exist) because nobody compiles them.
3. **Each module isolated, and what it contributes goes to points declared by its owner**, with
   a written order and overrides that create something new: Medusa, Backstage, Strapi 5, Vite,
   Grafana. What failed in all of them: mutating globally (`patch()`), implicit order, registries
   by string.
4. **Server state in a cache with invalidation by event** (TanStack Query), typed events with
   closed emitters, and errors as classified exceptions — not `Result` in the core, because
   React and TanStack speak exceptions.

## 1. Odoo: from widgets to typed plugins

| Version                  | What changed                                                                                                                                                                                                                                  | Why                                                                                                                                                                                                   |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ≤ 13/14                  | Legacy widgets                                                                                                                                                                                                                                | «Every widget change had to be coordinated by hand»                                                                                                                                                   |
| 14–15, OWL 1             | Declared components                                                                                                                                                                                                                           | —                                                                                                                                                                                                     |
| 16, OWL 2                | Hooks only; empty, frozen `env`; services by registry + `useService(name)`; reactivity by proxy                                                                                                                                               | «Hooks compose better»; an `env` that anyone fills is «scary»                                                                                                                                         |
| 17                       | Almost all legacy gone; `patch()` with native `super`                                                                                                                                                                                         | —                                                                                                                                                                                                     |
| 18                       | `rpc` and `user` stop being services: they are imported ES modules. All of `static/src` is ESM. Hand-written `.d.ts` files appear and the HTML editor by **plugins**                                                                          | What has no state becomes an import again                                                                                                                                                             |
| 19                       | **Interactions** replace `publicWidget` on the website                                                                                                                                                                                        | —                                                                                                                                                                                                     |
| **20, OWL 3** (alpha.50) | **Plugins by class** (`usePlugin(DialogPlugin)`), `providePlugins` per subtree (inherits from the parent, allows shadowing), signals, props and configuration typed by functions; string services remain as a bridge (`@todo owl3 migration`) | Their own document: proxy reactivity gives «bugs that are hard to diagnose»; «there is no good type support… a lot of work writing or generating .d.ts»; another addon's patches break what is cached |

- **Where `useService`'s typing failed**: the name→type map lives in a `.d.ts` apart from
  `registry.add(...)` and nothing verifies that they match; the `tsconfig` is `noEmit` and no CI
  compiles it; `start(env, deps)` receives the whole map and a missing dependency only shows up
  at runtime.
- **The HTML editor** (18+) has Odoo's best extension idea: each plugin declares `dependencies`,
  a public API (`shared`) and contributes to **points with semantics by suffix** — `*_handlers`
  (all run), `*_overrides` (the first one that answers wins), `*_predicates` (all must hold),
  `*_processors` (in a chain). The editor orders by dependencies and fails on a missing one or a
  repeated id. Its typing, once more, is a hand-written `.d.ts`.
- **Errors**: the server sends the error in the body with HTTP 200; the client turns it into
  classes and passes it through an ordered chain of `error_handlers`; the name of the server's
  exception picks the dialog (`UserError` → notice, crash → traceback). Still the same in 20.
- Sources: [OWL 3 design](https://github.com/odoo/owl/blob/master/doc/v3/owl/owl3_design.md) ·
  [OWL 1→2](https://github.com/odoo/owl/blob/master/doc/v3/owl/migration_owl1_to_owl2.md) ·
  [services 19.0](https://github.com/odoo/documentation/blob/19.0/content/developer/reference/frontend/services.rst) ·
  [dialog_plugin 20.0](https://github.com/odoo/odoo/blob/20.0/addons/web/static/src/core/dialog/dialog_plugin.js) ·
  [plugin_hooks.ts](https://github.com/odoo/owl/blob/master/packages/owl-core/src/plugin_hooks.ts) ·
  [html_editor plugin](https://github.com/odoo/odoo/blob/19.0/addons/html_editor/static/src/plugin.js) ·
  [Odoo 20](https://www.odoo.com/odoo-20-release-notes)

## 2. Requesting a service with types

| Framework    | Before                                                                                          | Now                                                                                                                                                                                   | Lesson                                                                                                                                          |
| ------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Angular      | constructor injection with `@Inject(TOKEN) x: T` (nobody verifies that `T` and the token match) | `inject(TOKEN)` with `InjectionToken<T>` — the type comes from the token; app/component injectors, the nearest wins                                                                   | A function, not a decorator; typed token; hierarchy                                                                                             |
| Vue 3        | `inject('foo')` → `unknown`                                                                     | `InjectionKey<T>` (a typed `Symbol`); Pinia: the hook is imported, the type travels with the import                                                                                   | The identity is the object                                                                                                                      |
| Backstage    | `createApiRef<T>({ id })`                                                                       | `createApiRef<T>().with({ id, pluginId })` (in two steps, because TypeScript does not infer part of a list); factories with `deps` as an object of refs; override only from the owner | Refs with an owner, declared deps, tests with `TestApiProvider`                                                                                 |
| VS Code      | —                                                                                               | `createDecorator<IService>('id')`, child scopes, an _accessor_ valid only during the call                                                                                             | The short-lived accessor is our «execution». Its third-party extensions, by contrast, are looked up by an untyped string: the same pain as Odoo |
| Effect 4     | four ways to declare a service                                                                  | a single one: `Context.Service<Self, Shape>()("Id")`; what is missing is a compile error (`Effect<A, E, R>`)                                                                          | The idea («requirements in the type»), not the runtime: it imposes a whole style                                                                |
| React        | —                                                                                               | context with a mandatory provider; typed contexts of TanStack Router and React Router 8; stores per subtree (Zustand `createStore`)                                                   | A hook lives only in the render: it is the edge, never the core                                                                                 |
| DI libraries | tsyringe, TypeDI with decorators + `reflect-metadata`                                           | idle or abandoned: TS 5's standard decorators emit no metadata, and esbuild/Vite and Metro do not support it                                                                          | No injection by reflection                                                                                                                      |

Sources: [Angular DI](https://angular.dev/guide/di/hierarchical-dependency-injection) ·
[Vue TS](https://vuejs.org/guide/typescript/composition-api.html) ·
[Backstage utility APIs](https://backstage.io/docs/frontend-system/utility-apis/creating) ·
[VS Code instantiation](https://raw.githubusercontent.com/microsoft/vscode/main/src/vs/platform/instantiation/common/instantiation.ts) ·
[Effect services](https://effect.website/docs/requirements-management/services/) ·
[Effect 4.0](https://effect.website/blog/releases/effect/40) ·
[TS 5.0 decorators](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html)

## 3. Modules and plugins that matured

| System             | Mechanism                                                                                                                                                                                                                                                           | What we take                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Medusa v2**      | Isolated modules («they cannot access another module's services»); connected by **links**, by query or by **workflows**. A _step_ does one thing and brings its undo beside it; a _workflow_ orchestrates; a _hook_ is a typed gap that the author opens on purpose | Step = Feature, workflow = ApplicationService. Hooks declared by the owner, with undo. **Not** its limited constructor (no `if` or `async`) |
| **Backstage**      | Tree of extensions with typed inputs/outputs; overrides that create another extension; third-party modules by `pluginId`; external routes that the app binds                                                                                                        | Typed contributions to declared points; override without mutating                                                                           |
| **Payload 3**      | A plugin is `(config) => config`, validated at the end                                                                                                                                                                                                              | Pure transformations, validated after all of them                                                                                           |
| **Strapi 5**       | `register` → `bootstrap`; string zones gave way to typed reducer-like APIs; database hooks rose to per-use-case middlewares                                                                                                                                         | Extension points at the use-case level, not the storage level                                                                               |
| **Vite / Rollup**  | Few hooks with combination rules (_first_, _sequential_, _parallel_), declared order (`enforce`, `order`)                                                                                                                                                           | Written order, not by position                                                                                                              |
| **Nuxt / Grafana** | `moduleDependencies` with versions; hooks typed by interface; Grafana demands declaring the contributions in the manifest                                                                                                                                           | What a module contributes can be read without running it                                                                                    |

Sources: [Medusa isolation](https://docs.medusajs.com/learn/fundamentals/modules/isolation) ·
[Medusa compensation](https://docs.medusajs.com/learn/fundamentals/workflows/compensation-function) ·
[Medusa hooks](https://docs.medusajs.com/learn/fundamentals/workflows/add-workflow-hook) ·
[Backstage extensions](https://backstage.io/docs/frontend-system/architecture/extensions) ·
[Payload plugins](https://payloadcms.com/docs/v3/plugins/overview.md) ·
[Strapi CM APIs](https://docs.strapi.io/cms/plugins-development/content-manager-apis.md) ·
[Rollup](https://rollupjs.org/plugin-development/) ·
[Nuxt module deps](https://nuxt.com/docs/5.x/guide/modules/module-dependencies) ·
[Grafana extensions](https://grafana.com/developers/plugin-tools/how-to-guides/ui-extensions/register-an-extension.md)

## 4. Reactivity, events and errors

- **React 19.3** (Sep 2026; there is no 20; RN ships React 19 since 0.78): Actions give
  `isPending`, `useOptimistic` and form integration, but not cancellation, nor «the last call
  wins», nor a cache. `useActionState` queues serially with the previous state: it is a form
  reducer, not a use case. **Build on TanStack Query and keep `run` compatible with Actions.**
- **Signals**: TC39 at Stage 1; in React they need transformations and do not get along with the
  Compiler. For bounded state (a record being edited, a cart): a store per scope with selectors
  over `useSyncExternalStore` (vanilla Zustand or `@xstate/store`).
- **TanStack Query v5**: invalidate by event and do not push data (TkDodo); `queryOptions` in a
  factory; `MutationCache.onSuccess` + `meta` to invalidate; `useMutationState` for «saving…» on
  another screen; **not** `broadcastQueryClient` — forward events through `BroadcastChannel`.
- **Events**: what prevents a «free for all» bus is not the library but a **single typed
  registry** (augmentation of a `Register` interface, like TanStack), names
  `entity.fact_in_past_tense`, **closed emitters** (components do not emit) and each event's
  `source`. The hook cannot be called `useEvent`: that RFC is `useEffectEvent` (stable in 19.2).
- **XState v5**: for a POS checkout, yes; for a linear wizard it is overkill. Never a dependency
  of the framework.
- **Errors**: Effect 4 has the best typed channel but imposes its runtime; neverthrow is
  loose; React and TanStack speak exceptions. **Classified exceptions** (`Refused` with the
  RFC 9457 Problem — its `type` is the identity —, `Aborted`, `Failed` with `cause` and the
  trace), a **result at the hook's edge**, a single report from the caches and `createRoot`, and
  a `Refused` never reaches an error boundary.

Sources: [React 19.3](https://react.dev/blog/2026/09/09/react-19-3) ·
[useActionState](https://react.dev/reference/react/useActionState) ·
[TC39 signals](https://github.com/tc39/proposal-signals) ·
[TkDodo: websockets](https://tkdodo.eu/blog/using-web-sockets-with-react-query) ·
[TkDodo: invalidation](https://tkdodo.eu/blog/automatic-query-invalidation-after-mutations) ·
[queryOptions](https://tanstack.com/query/latest/docs/framework/react/guides/query-options) ·
[broadcastQueryClient](https://tanstack.com/query/latest/docs/framework/react/plugins/broadcastQueryClient) ·
[RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html) ·
[Effect 4.0](https://effect.website/blog/releases/effect/40)

## 5. What we already do well, and what changes

| Already aligned                                                                             | Changes                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A screen uses the service bound by import (`useService(project.closeIssue)`), not by string | What crosses bounded contexts or comes from a plugin moves to **refs with an owner** (`serviceRef<T>().with({ id })`), not `app.services("auth")`                                                                           |
| `Feature` by class with interceptors — like OWL 3's Plugins by class                        | `defineDomain` declares **what it provides, what it needs, what it emits, which points it opens and what it subscribes to**; the application fails (in type and at startup) if something is missing or there are two owners |
| Context per execution, no global — VS Code's _accessor_                                     | The context levels as **child providers** that can shadow (like `providePlugins`)                                                                                                                                           |
| Errors classified and reported once                                                         | `run` returns a **result** (`answered` / `refused` / `aborted` / `failed`) and never throws; the `Problem.type` picks how it is shown, with a typed chain                                                                   |
| Client types generated from the contract                                                    | The maps of the bounded context and the application are also **derived** from the definitions: never a parallel `.d.ts`                                                                                                     |
| —                                                                                           | `useService` over TanStack's `useMutation` and compatible with Actions; `useQueryService` with `refreshOn`; each command declares what it **emits** and its **concurrency**                                                 |
| —                                                                                           | Extension points with **explicit semantics** (handlers / overrides / predicates / processors) and hooks with undo                                                                                                           |
