# PRD_03: the design — what it gives, how it looks, with which pieces

- **Status**: 2026-11-06, proposal to validate before building; revised with
  [`PRD_03_research.md`](PRD_03_research.md) (Odoo 20, Angular, Backstage, Effect, Medusa,
  TanStack, React 19). It makes concrete in API what [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
  says in concepts; the plan by phases remains in
  [`PRD_02_how-an-application-is-built.md`](PRD_02_how-an-application-is-built.md).
- **Repos**: `sincpro_client_framework` (the neutral part: bounded context, application,
  services, events, errors), this one (the web: context levels in React, screens, shell),
  `sincpro_web_composer` (an error boundary per window), `sincpro_framework` (events in the
  contract, SSE), `sincpro_mobile` (adopts the neutral part).
- Each piece says whether it **exists** (✅), **half exists** (🟡) or is **new** (🆕).
- **Decided afterwards** (2026-11-06): initialisation was left like sincpro_framework's and
  without `defineDomain`/`needs` or «runtime» — `UseBoundedContext` + `addDependency`, the
  `Feature`/`ApplicationService` bases typed with the dependencies, `project.Issues.close(input)`,
  `this.feature.Issues`, `configureProcess` in `main` and the context as a port
  (`ContextStore`). What is in force is in [`../ARCHITECTURE.md`](../ARCHITECTURE.md) §6 and §7
  and in the README of @sincpro/client-framework; what is below stays as a record of what was
  evaluated.

## 1. What it is, in one sentence per package

| Package                     | It is                                                                                                                                                                                                                                                                | It is not                               |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `@sincpro/client-framework` | The **client** of sincpro_framework on any platform: how a bounded context and an application are declared, where the logic lives (Features), how each request travels (transport, generated client), what happens when something changes (events) or fails (errors) | Screens, React, offline storage         |
| `@sincpro/web-framework`    | The **web screens** for that: the context levels in React, the default components from the meta, the backoffice shell, the browser's telemetry                                                                                                                       | The transport, business logic, a router |
| `@sincpro/mobile`           | A phone's screens and offline support, on the same client-framework                                                                                                                                                                                                  | —                                       |

The rule that orders everything: **what does not draw goes in client-framework**, and each
platform only adds how it looks and where it opens.

## 2. What an application looks like from end to end

```text
src/
├── entrypoints/
│   └── app.tsx                    defineApplication(...) + <SincproApp app={app} />
└── domains/
    ├── common/                    shared language + cross-cutting infrastructure
    │   └── infrastructure/        transport.ts · runtime.ts (tracer, reporter, context)
    └── project/
        ├── generated/             from the contract: domain.ts · client.ts · entities.ts · contract.json
        ├── services/              close_issue.ts (ApplicationService) · send_issue.ts (Feature)
        ├── infrastructure/
        │   └── domain.ts          defineDomain("project", …)  ← like the backend's framework.py
        ├── components/issue/      its kit: row, card, controls
        └── entrypoints/
            ├── web.ts             webDomain(project, { views, kits, widgets })
            ├── views/             the screens
            └── subscribers.ts     what the bounded context does when something happens
```

Read in the order it runs:

```ts
// domains/project/infrastructure/domain.ts — the bounded context, neutral (works on web and on mobile)
export const project = defineDomain("project", {
  contract: generated.contract, //                       metas, versions, aliases, events
  entities: generated.entities, //                       to resolve relations by reference
  dependencies: (app) => ({
    project: generated.clientOf(app.transport), //       this bounded context's adapter
    tenants: app.need(auth.resolveTenant), //           another bounded context, by its contract's ref — never its code
  }),
  services: (deps) => ({
    sendIssue: new SendIssue(deps),
    closeIssue: new CloseIssue({ preview: new PreviewClose(deps), send: new SendIssue(deps) }),
  }),
  subscribers: [onIssueClosed], //                       §5
});

// entrypoints/app.tsx — the application: which bounded contexts it loads and what it injects
export const app = defineApplication({
  transport, //                                          domains/common/infrastructure/transport.ts
  runtime: { tracer, reporter, context: () => ({ tenant_id: session.tenant }) },
  domains: [auth, project],
});

<SincproApp app={app} web={[authWeb, projectWeb]} language="es" timeZone="America/La_Paz" />;
```

## 3. The pieces, by responsibility

### 3.1 Bounded context and application (client-framework)

**Everything is requested by reference, never by a string** — the conclusion from Odoo 20
(`usePlugin(Class)` instead of `useService("orm")`), Angular, Backstage and Effect. The string
stays for the trace and for diagnosis.

```ts
// domains/auth/contract.ts — the ONLY thing another bounded context imports: types and refs, no code
export const resolveTenant = serviceRef<ResolveTenant>().with({ id: "auth.resolveTenant" });
export type AuthEvents = { "tenant.suspended": { tenant_id: string } };

// domains/project/infrastructure/domain.ts
export const project = defineDomain("project", {
  contract: generated.contract,
  needs: { tenants: resolveTenant }, //                        refs of other bounded contexts
  provides: [provide(projectRefs.closeIssue, ({ services }) => services.closeIssue)],
  emits: events<ProjectEvents>(), //                           the facts it publishes
  services: ({ client, needs }) => ({
    closeIssue: new CloseIssue({ client, tenants: needs.tenants }),
  }),
  extensionPoints: { issueAside: slot<{ issue: Issue }>("project.issue.aside") }, // §3.7
  subscribers: [onTenantSuspended],
});
```

| Piece                                                                                    | What it does                                                                                                                                                                                                                                                           | State                       |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `serviceRef<T>().with({ id })`                                                           | The typed identity of a service that crosses bounded contexts or comes from a plugin. In two steps, like Backstage and Effect 4: TypeScript does not infer part of a list of types                                                                                     | 🆕                          |
| `defineDomain(name, { needs, provides, emits, services, extensionPoints, subscribers })` | A declared bounded context: **what it needs, what it provides, what it emits, which points it opens, what it subscribes to**. It can be read without running it (like Grafana's manifest). Neutral: mobile uses it the same way                                        | 🆕                          |
| The bounded context's contract (`contract.ts`)                                           | Only types and refs: what others import. The implementation is never imported across bounded contexts (`make doctor`)                                                                                                                                                  | 🆕                          |
| `defineApplication({ transport, runtime, domains, modules })`                            | Composes: binds the services (`<bounded context>/<key>`), resolves each `need` with its `provide`, and **fails in type and at startup** if a provider is missing or there are two owners — like Odoo's editor, which orders by dependencies and fails on a missing one | 🆕 (over `bindServices` ✅) |
| Derived types                                                                            | The maps of services, events and points come from the definitions (`typeof app`), **never from a parallel `.d.ts`** — Odoo's rotted because nobody compiles them                                                                                                       | 🆕                          |
| `webDomain(domain, { views, kits, widgets })` (web-framework)                            | What the bounded context contributes to the web. Mobile has its equivalent                                                                                                                                                                                             | 🆕 (over `entityView` ✅)   |

Why two layers and not one: what does not draw has to be able to run on a phone and in a script;
what draws belongs to each platform. Mobile's `DomainModule` becomes «`defineDomain` + what is
offline».

### 3.2 The context levels

| Level               | Given by                                                 | Read with                   | Carries                                                                                                                                                          | State                                                              |
| ------------------- | -------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **App**             | `defineApplication` + `<SincproApp>`                     | `useApp()`                  | the app (services, entities, events), who calls, language, time zone, the transport                                                                              | 🟡 today `FrameworkProvider`: transport, language, metas, entities |
| **Bounded context** | `defineDomain`                                           | `useDomain(project)`        | its bound services, its entities, its context                                                                                                                    | 🆕                                                                 |
| **Window**          | composer, wrapped by the framework                       | `useWindow()`               | what was opened (`ref`, `params`), over what (`over`), where (`surface`), whether it chooses (`choosing`), plus a state bounded to the window (`useWindowState`) | 🆕 (composer gives `api` only as a prop)                           |
| **Record**          | `<RecordScope record={…}>` (put there by `EntityRecord`) | `useRecordScope()`          | the record being edited: fields find it without passing it prop by prop                                                                                          | 🆕 (today `RecordField record={…}`)                                |
| **Execution**       | the interceptors                                         | `this.context` in a Feature | a snapshot of those above + the trace                                                                                                                            | ✅                                                                 |

Rules: each level reads the one above, never the one below or beside it; a service never reads
React — it receives the snapshot of its execution; what the backend has to see travels in
`sincpro-context` and `traceparent`. **There is no global data store**: what belongs to the
server is in the cache (§3.4), what belongs to a screen in its level.

### 3.3 Services from the screen

A screen uses the service **bound, by import** (`project.closeIssue`) or, if it crosses bounded
contexts, **by its ref** (`useService(resolveTenant)`): never by a string. Inside, the server
cache (TanStack Query); outside, an API of our own and stable.

```ts
const close = useService(project.closeIssue); //  useMutation inside
const outcome = await close.run({ issue_id }); // never throws:
// { kind: "answered", answer } | { kind: "refused", problem } | { kind: "aborted" } | { kind: "failed", error }
<form action={close.action}>…</form>; //          compatible with React 19's Actions: useOptimistic works
const board = useQueryService(project.board, { project_id }); // in the cache; re-reads itself (§3.4)
```

| Piece                                    | What for                                                                                                                                                                                                         | State                                |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `useService(service)`                    | Run a use case that **changes** something: `run` (returns a result, never throws), `action`, `busy`, `answer`, `refused`, `failed`. On `useMutation`: «saving…» visible from another screen (`useMutationState`) | 🟡 exists by hand; moves to TanStack |
| Concurrency per use case                 | `serial` (in line, like a register's sales), `latest` (cancels the previous one), `parallel`                                                                                                                     | 🆕                                   |
| `useQueryService(service, input)`        | Read with a use case of our own: it stays in the cache by key (`queryOptions`) and re-reads when an event touches it (`refreshOn`)                                                                               | 🆕                                   |
| `useListing`, `useRecord`, `useCommand`… | An entity's reads and writes of the framework, as the framework's Features, traced                                                                                                                               | 🟡                                   |
| **Not**: building on `useActionState`    | It queues serially with the previous state: it is a form reducer, not a use case                                                                                                                                 | —                                    |

### 3.4 Events and reactivity: modern, but typed and declared

What changes arrives from **three sources** into **a single event flow per application**, and is
consumed in **three ways**. What prevents a «free for all» bus is not the library: it is a **single
typed registry**, names `entity.fact_in_past_tense`, **closed emitters** — components do not emit
— and the origin of each event.

```text
 sources (the only ones that emit)           consumers
 ─────────────────────────────────           ─────────
 a command that answered   ─┐            ┌─► the cache: refreshOn → invalidates → every open list, record and
 (what the use case         │            │   useQueryService re-read by themselves
  declares in `emits`)      ├─► app    ─┼─► a component that reacts: useDomainEvent("issue.closed", …)
 the live server (SSE)      │  events    │
 another tab               ─┘            └─► a bounded context's subscriber: runs a Feature (traced)
 (BroadcastChannel; what came from another tab is not forwarded)
```

```ts
// the use case says what it emits and what refreshes it — the cache sorts itself out
class CloseIssue extends ApplicationService<…> {
  static emits = (answer, input) => [{ name: "issue.closed", data: { issue_id: input.issue_id } }];
}
const board = query(BoardFeature, { refreshOn: { "issue.closed": (e) => ({ project_id: e.data.project_id }) } });
useDomainEvent("issue.closed", (e) => toast(…)); //   a component reacts; it does not emit
```

| Piece                                                 | What it does                                                                                                                                                  | State                      |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Typed event registry                                  | The app's events in a single type, derived from each bounded context's `emits` (and, when the backend publishes them, from the contract)                      | 🆕                         |
| Command events                                        | On answering, the runtime publishes what the use case declares in `emits`                                                                                     | 🆕                         |
| `liveSource` (entrypoint)                             | SSE with `Last-Event-ID`, pluggable (RN has no native `EventSource`)                                                                                          | 🆕 (sincpro_framework#201) |
| Relay between tabs                                    | Events through `BroadcastChannel`, never data (**not** `broadcastQueryClient`: experimental, breaks in patches)                                               | 🆕                         |
| Invalidation                                          | `refreshOn` → `invalidateQueries`; with SSE connected, a high `staleTime`                                                                                     | 🆕                         |
| `useDomainEvent(name, handler)`                       | A component reacts. **Not** `useEvent`: it is the name of the RFC that React published as `useEffectEvent`                                                    | 🆕                         |
| `defineSubscriber(event, (event, { services }) => …)` | The bounded context reacts by running a use case, traced and reported                                                                                         | 🆕                         |
| Continuing a trace                                    | A subscriber that runs later (mobile's queue, an SSR) follows the gesture's trace from the stored `traceparent`                                               | 🆕                         |
| Bounded state that changes with every keystroke       | A store per scope (vanilla Zustand or `@xstate/store`) with selectors. **Not** signals in React (TC39 at Stage 1, transformations, clashes with the Compiler) | 🆕                         |

### 3.5 Errors: a single model, from the Feature to the screen

Classified exceptions in the core — React and TanStack speak exceptions; a `Result` would fight
all of that — and **a result at the hook's edge**.

| How it ended | What it is                                                                            | Where it shows                                                                                             | Is it reported?                                                                                        |
| ------------ | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `refused`    | The server said no and explained: an RFC 9457 `Problem`, whose `type` is the identity | In its place, chosen by its `type`: a field (`errorAt`, by JSON pointer), the record (`Refused`), a notice | No — and **it never reaches an error boundary**                                                        |
| `aborted`    | Whoever asked stopped waiting                                                         | Nowhere                                                                                                    | No                                                                                                     |
| `failed`     | A bug, a 5xx, a server down (`Error.cause`, the trace)                                | «Something failed» with the **support code** and retry if possible                                         | **Yes, once**: where it happened (the runtime), and whatever escapes, from the caches and `createRoot` |

| Piece                                                                                                                                             | State               |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Classification (`outcomeOf`) and a single report where it happened                                                                                | ✅ client-framework |
| `explain(error)`, `Refused`, errors by field (`pathOf`, `errorAt`)                                                                                | ✅                  |
| How each `Problem.type` is shown: an ordered, typed chain (field, record, notice, dialog) — Odoo's, without strings                               | 🆕                  |
| Support code in `Refused`                                                                                                                         | 🆕                  |
| Error boundary per window that reports (`onError` in composer's `ViewHost`) and at the root (`createRoot(…, { onUncaughtError, onCaughtError })`) | 🆕                  |

### 3.6 Components it brings, by extension level

| For          | N0 · default from the meta                                                             | N1–N2 · adjusted                                                                           | N3–N4 · replaced                    |
| ------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------- |
| A collection | `EntityList` (table, rows, board, sheet, pivot), `EntitySearchBar`, groups and sums ✅ | kit: `row`, `card`; columns; slots with an anchor 🆕                                       | `useListing` + web-ui's `List` ✅   |
| A record     | `EntityRecord`, `RecordField`, lines, related, history ✅                              | kit: controls per field, sections with an anchor 🆕                                        | `useRecord` + web-ui's `Record` ✅  |
| Choosing     | `EntityPicker`, `EntityTags`, the chooser in the workspace ✅                          | kit: `option` ✅                                                                           | `useLookup` ✅                      |
| Acting       | `CommandButton`, per-row actions, dry-run ✅                                           | —                                                                                          | `useCommand`, `useService` ✅       |
| A widget     | —                                                                                      | `widget({ id, hosts, config, data })` in `Home`, `RecordAside`, `PosGrid`, `PortalPage` 🆕 | the component of your own 🆕        |
| The app      | `SincproApp` (backoffice) ✅                                                           | `app`, `web` per bounded context 🆕                                                        | `FrameworkProvider` + `Composer` ✅ |

### 3.7 Extension points: opened by the owner, with explicit semantics

A plugin only contributes to what the bounded context **declared** (`extensionPoints`), each
contribution with an id with an owner and a written order (`before` / `after` an anchor).
Replacing is an override that creates something new — never `patch()`.

| Kind of point         | Combines like this (from Odoo's HTML editor, typed)                        | Example                          |
| --------------------- | -------------------------------------------------------------------------- | -------------------------------- |
| `slot<Props>(id)`     | All are drawn, in order                                                    | The side of an issue             |
| `handlers<E>(id)`     | All run                                                                    | After closing: notify, record    |
| `overrides<I, O>(id)` | The first one that answers wins                                            | How an invoice is printed        |
| `predicates<I>(id)`   | All must hold                                                              | Can it be confirmed?             |
| `processors<T>(id)`   | In a chain, each on the previous one's output                              | A list's columns                 |
| `hook<I>(id)`         | A step declared by the use case's author, with its undo beside it (Medusa) | Reserve points before confirming |

```ts
export const fidelidad = defineModule("fidelidad", {
  extends: project,
  contribute: (p) => [
    p.issueAside.add({ id: "fidelidad.points", after: "project.totals", render: PointsCard }),
  ],
});
```

## 4. Is the repos' structure solid?

**Applications**: yes — §2's tree is the backend's layer by layer, and it now also says where the
bounded context goes (`infrastructure/domain.ts`) and a bounded context's web part
(`entrypoints/web.ts`).

**client-framework**: its folders (`client/`, `model/`, `services/`, `observability/`,
`adapters/`, `codegen/`, `testing/`) are understandable, but they do not speak Sincpro's
vocabulary. With bounded context, application and events coming in, it is worth ordering it now —
**without breaking anyone**: the public entries do not change.

```text
src/domain/          entity · contract · meta · ids · events (types) · the Transport, Tracer, ErrorReporter ports
src/services/        Feature · ApplicationService · the execution and its interceptors
src/infrastructure/  runtime · defineDomain · defineApplication · the event flow · subscribers
src/adapters/        rest · memory · opentelemetry · sentry · liveSource (SSE)
src/entrypoints/     the generator's CLI
src/testing/         in-memory doubles
```

**web-framework**: its levels (`core` → `react` → `web`) exist because of the doctor's rules and
are fine; what is not fine is the name `core/` (the guide forbids it as ambiguous, and it is now
«the screens' logic»). It is a published entry (`./core`): **either it is renamed before
publishing 2.0, or it waits for 3.0**. The new levels (§3.2) go in `react/` (`useApp`,
`useDomain`, `useWindow`, `useRecordScope`) and the shell in `web/workspace/`.

## 5. What is asked outside

| Repo                 | What                                                                                                | For                           |
| -------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------- |
| sincpro_framework    | Publish the domain events in the client contract, with their fields                                 | §3.4: typed events            |
| sincpro_framework    | SSE (#201) with `Last-Event-ID`                                                                     | `liveSource`                  |
| sincpro_framework    | Which entities each command touches (contract or answer)                                            | Invalidating without guessing |
| sincpro_web_composer | `onError` in each view's error boundary; a React context with the `api` (or the framework wraps it) | §3.5, §3.2                    |
| sincpro_mobile       | `DomainModule` over `defineDomain`; its `Feature` replaced by client-framework's                    | A single core                 |

## 6. Proposed order

1. **client-framework**: order the folders (§4) → `defineDomain` / `defineApplication` → command
   events and `defineSubscriber` → continuing a trace. All neutral, tested in Node, and mobile
   can already start.
2. **web-framework**: `SincproApp app={app}` + `webDomain` → the levels `useApp`, `useDomain`,
   `useWindow`, `useRecordScope` → TanStack Query under the hooks + invalidation by events +
   `useQueryService` + `useEvent` → an entity's reads and writes as Features (everything traced)
   → support code and error boundaries.
3. **The reference app** (PRD_02) is built on this, and it is what says what is missing.
4. **Kits, slots with an anchor and widgets** (PRD_02 phase 4).

## 7. Open decisions

Each one, with its alternatives scored against the premises, is in
[`PRD_04_proposals-compared.md`](PRD_04_proposals-compared.md).

1. **Two layers of bounded context** (neutral `defineDomain` + `webDomain` / mobile's).
   Recommended: yes.
2. **Refs for what crosses bounded contexts and plugins** (`serviceRef<T>().with({ id })`), and
   the service bound by import inside the bounded context itself. Recommended: yes — it is where
   Odoo 20, Angular, Backstage and Effect arrived.
3. **`run` returns a result and never throws**; classified exceptions inside. Recommended.
4. **TanStack Query** as the engine of `useService` / `useQueryService` and of invalidation by
   events. Recommended.
5. **Typed events derived from each bounded context's `emits`**; when sincpro_framework publishes
   its own in the contract, they are added.
6. **web-framework's `./core`**: rename in 2.0 or in 3.0.
