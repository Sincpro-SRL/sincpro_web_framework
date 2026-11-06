# PRD_02: the framework of work — one architecture for every Sincpro web application

- **Status**: 2026-11-05, proposal to validate. The architecture is in
  [`../ARCHITECTURE.md`](../ARCHITECTURE.md); the research with its sources in
  [`PRD_02_research.md`](PRD_02_research.md).
- **Repos**: this one (the bulk), `sincpro_framework` (events over SSE, affected entities, CORS),
  `sincpro_web_composer` (error per window), `sincpro_mobile` (context per call),
  `sincpro_internal_mcp` (the guide: `common`), `sincpro_forge/web` (first adopter).

## The problem

What has been done so far is the entities layer: reading, searching, editing and acting on what
the server publishes, and the client generated from the contract. It works and is published
(sincpro_framework 3.32.0, criteria 1.1.0, web-framework 1.1.0). What is missing is the
**framework of work**: where an application's logic lives, how bounded contexts are separated,
how to extend without making a mess, and what the backend gives for free and the web does not
have — telemetry and errors.

Forge says so, the only consumer:

- Views are huge files with everything together: `project_views.tsx` has 789 lines and 11
  components that mix state, calls and drawing.
- There is no `services/` or `components/`; entities are declared with their presentation (TSX)
  in `adapters/`.
- `shared/record_screen.tsx` repeats, by its own comment, «the same steps as `EntityRecord`».
- No telemetry, no error reporting; a write in one window does not refresh another.

And distribution says so, mobile's reference application (see the research): a global context
of 34 members, screen contexts of 300 to 500 hand-written lines, a 600-line service per
aggregate and event subscriptions written screen by screen.

## Goals

1. **One single architecture** for backoffice, POS, portal and ecommerce, with
   sincpro_framework's vocabulary (`entrypoints/`,
   `domains/<ctx>/{domain,adapters,services,infrastructure,entrypoints}`, `domains/common`) plus
   `components/`.
2. **All logic in services** — `Feature` and `ApplicationService` with interceptors, like
   mobile — which give **telemetry and errors by default**, with the trace continued in the
   backend.
3. **State without inventing**: TanStack Query for what belongs to the server, Context to inject,
   a store per instance for what changes with every keystroke.
4. **Extend with order**: N0 (zero code) → N1 (present) → N2 (slots with an anchor) → N3 (view) →
   N4 (replace), with deterministic precedence and widgets declared by the owning bounded
   context.
5. **Quick to replicate**: from the contract to a working entity without code; scaffolding for a
   bounded context, a Feature or a view in one command; import rules that fail in CI.

## Out of scope

- A UI event bus; micro-frontends between our own bounded contexts.
- Permissions, roles and groups: they are business and live in the backend.
- Business rules on the client; access control or auditing on the client.
- The POS, portal and shop shells as a product: the framework makes them possible; building them
  belongs to each product.

## Phases

Each phase ends in something that fails today: a test in `tests/` for logic, a story with a
`play` for the use case. The reference application — a small ERP (`common`, sales, inventory) on
the in-memory server — is born in phase 1 and grows in each one: it is the story that rules, and
whatever cannot be written cleanly in it is a piece the framework lacks.

| Phase                               | What                                                                                                                                                                                                                                                                                  | Ends when                                                                                                                                                                                                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0 — Mark**                        | Validate `ARCHITECTURE.md`; carry it to `PURPOSE.md` and `AGENTS.md`; correct Sincpro's guide (`common`)                                                                                                                                                                              | The open decisions (below) answered                                                                                                                                                                                                                                         |
| **1 — Services, trace and errors**  | `Feature` and `ApplicationService` with interceptors (mobile's API, context per call); the `Tracer` seam; the OpenTelemetry adapter and the errors one (Sentry SDK → GlitchTip) in separate entries; the transport writes `traceparent`; `Refused` shows the support code             | An ApplicationService with two Features gives nested `<bounded context>/<Feature>` spans and the request goes out with a `traceparent` of the same trace; an unexpected error is reported with its `trace_id` and a 409 is not; two simultaneous calls do not cross parents |
| **2 — State**                       | TanStack Query under the hooks (same API), the key factory and `invalidate`; an entity's reads, writes and commands as the framework's Features; the record's per-instance store; `cachedTransport` is retired                                                                        | The stories stay green; a new one: saving in a modal refreshes the page's list; two windows reading the same thing make one request                                                                                                                                         |
| **3 — Bounded contexts and levels** | The instance per bounded context (client, services, kits, views, widgets, live sources); `SincproApp` receives bounded contexts; the Window level for components; the generator writes `generated/` per bounded context; the reference application completes its two bounded contexts | The reference runs in CI with two bounded contexts that relate by reference, without importing each other                                                                                                                                                                   |
| **4 — Extension**                   | The kit per entity (N1), slots with an anchor (N2), widgets with typed hosts and a catalogue, the tenant's design as validated data, unique ids and precedence                                                                                                                        | One story per level; a non-existent anchor and a repeated id fail in the tests                                                                                                                                                                                              |
| **5 — Automatic order**             | The import-rules preset (dependency-cruiser) for the applications' `make doctor`; scaffolding: `sincpro-web new domain`, `new feature`, `new view`                                                                                                                                    | A bounded context created with the scaffolding passes the doctor; one that imports another bounded context does not                                                                                                                                                         |
| **6 — Real time and media**         | `LiveSource` (SSE with `Last-Event-ID`) that invalidates; `BroadcastChannel` between tabs; the upload piece with progress                                                                                                                                                             | A change made «by someone else» refreshes the open record, and one with unsaved changes is flagged instead of being overwritten                                                                                                                                             |
| **7 — forge adopts**                | Views to `entrypoints/views/`, pieces to `components/`, logic to `services/`, entities to `generated/`, `record_screen` replaced by the framework, telemetry and errors switched on                                                                                                   | forge without `shared/record_screen.tsx` and with end-to-end traces                                                                                                                                                                                                         |

The POS shells (offline PWA: persisted cache, per-register queued sales, idempotency by UUID v7)
and portal/shop shells (SSR) come in when a product asks for them; the framework already
contemplates them (ARCHITECTURE §11).

## What is asked of other repos

| Repo                 | What                                                                                                                                              | For                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| sincpro_framework    | Events over SSE (#201) with `Last-Event-ID`                                                                                                       | Phase 6                                 |
| sincpro_framework    | Which entities a command touches, in the contract or in the answer                                                                                | Invalidating without guessing (phase 2) |
| sincpro_framework    | Document the CORS of `traceparent`, `tracestate` and `sincpro-context`; `tracestate` also in the Starlette gateway (today only FastAPI copies it) | Phase 1                                 |
| sincpro_web_composer | `onError` in each view's error boundary (`ViewHost` today only does `console.error`)                                                              | Phase 1                                 |
| sincpro_mobile       | The active span per call instead of the global stack; name the spans `<bounded context>/<Feature>`                                                | The same traces on the three platforms  |
| sincpro_internal_mcp | `sincpro_architecture_guidelines` §3.1 and §6: `common`                                                                                           | Phase 0                                 |

## Open decisions

1. **TanStack Query under the hooks**, replacing `cachedTransport` (recommended: it is what
   refine and react-admin do, and it solves refreshing across windows).
2. **Zustand (vanilla) for the per-instance store** — record being edited, cart, wizard —
   against `useState`/`useReducer` (recommended: 0.5 kB, selectors, isolated per instance).
3. **Traces to the Collector that backend and mobile already use**: which one is it and who
   operates it?
4. **The reference application inside this repo** (recommended: it runs in CI without a backend)
   or forge directly.
5. **Monorepo per product** (pnpm workspaces) when there is more than one application.

## Risks

- **TanStack Query couples versions** (react-admin had to fix an incompatibility in a minor): it
  goes as a peerDependency, with the hooks' API as the boundary — the keys are not public.
- **OpenTelemetry for the browser is moving** (3.0 removed `sdk-trace-web`; the new
  instrumentations are 0.x): only the trace SDK and the exporter are used, with pinned versions,
  and no auto-instrumentation.
- **GlitchTip does not read Sentry SDK 11's span streaming**: it is used only for errors; traces
  go through OpenTelemetry.
- **A framework that is too closed**: each level can still be skipped (PURPOSE: «defaults, never
  cages»); N4 exists on purpose.
