# PRD_04: the decisions, compared — one step beyond Odoo

- **Status**: 2026-11-06, to decide. It takes the design from [`PRD_03_design.md`](PRD_03_design.md)
  and its research ([`PRD_03_research.md`](PRD_03_research.md)) and sets each decision against
  the premises, with scored alternatives.
- **Premises** (1 to 5 each): **E**xtensibility · **F**acility (learning it, using it well
  without reading the code) · e**L**egance (few pieces, one way to do each thing) · **D**X
  (editor, autocompletion, clear errors, fast tests) · **T**yping (what the compiler catches) ·
  **C**oherence (the same words and shapes as sincpro_framework and mobile). Total out of 30.

## 1. One step beyond Odoo: what TypeScript and the ecosystem give us

Odoo built everything by hand — its renderer (OWL), its reactivity, its asset bundler, its
`.d.ts` files — and without TypeScript. Odoo 20 is paying for that with a two-phase migration.
What we can do from day one and Odoo cannot:

|                               | Odoo (up to 20)                                   | Us                                                                                                            |
| ----------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Server types                  | Hand-written `.d.ts` files, which rot             | **Generated from the contract**: DTOs, commands, answers, routes and, when the backend publishes them, events |
| A missing dependency          | At runtime: «Missing dependencies»                | **Compile error** in `defineApplication`, and also at startup                                                 |
| Extending                     | Global `patch()` and registries by string         | **Declared, typed points**, ids with an owner, overrides that create something new                            |
| Events                        | `env.bus` with string names                       | **Typed registry**: the name autocompletes and the payload is checked                                         |
| Errors                        | The exception's name as a string picks the dialog | **By `Problem.type`**, with each presentation typed, and a typed result in the hook                           |
| Context                       | A common `env`                                    | **Levels with a mandatory provider**: reading one that does not exist does not compile                        |
| Cache, actions, bounded state | Their own                                         | **TanStack Query, React 19 Actions, stores per scope (Zustand)**: proven by millions of apps, with devtools   |
| Traces and errors             | Logs                                              | **OpenTelemetry and Sentry-compatible**, optional, with the trace continued in the backend                    |
| Tests                         | Their runner                                      | **Storybook as a test** (the story is the test) and Features tested in Node without drawing                   |
| Platforms                     | Web                                               | **The same core** on web, mobile, SSR and scripts                                                             |
| Code order                    | Convention                                        | **Rules that fail in CI** (`make doctor`) and scaffolding                                                     |

## 2. The layers: simple

An application has **three kinds of code** of its own, plus what is generated and the bounded
context's declaration. Nothing more.

```text
services    the logic: Feature · ApplicationService              no React · tested in Node
scopes      the state of a screen or of a composite              no business rules · call services
            component: what is typed, what is selected,
            a draft, a cart
components  draw: read their scope, run services                 no business logic
```

It is distribution's separation (`*.context.tsx` + the screen), but **the scope is declared and
not written by hand**: the 300 to 500 lines of each distribution context come out of a
20-line definition (§3.4).

A bounded context's folders grow with the evidence: a small bounded context can be
`generated/` + `domain.ts` + `services.ts` + `views.tsx`; the `services/`, `components/` and
other folders appear when there is a second file.

## 3. The decisions

### 3.1 How a screen reaches a service

|                                                                                                  | E   | F   | L   | D   | T   | C   | Total  |
| ------------------------------------------------------------------------------------------------ | --- | --- | --- | --- | --- | --- | ------ |
| A · Registry by string (`useService("orm")`, Odoo ≤19)                                           | 3   | 4   | 3   | 1   | 1   | 2   | 14     |
| B · Import the bound service (`useService(project.closeIssue)`)                                  | 2   | 5   | 5   | 5   | 5   | 4   | 26     |
| C · Always a ref resolved by the scope (`useService(closeIssueRef)`)                             | 5   | 3   | 3   | 4   | 5   | 4   | 24     |
| **D · B inside the bounded context, C for what crosses bounded contexts or comes from a plugin** | 5   | 4   | 4   | 5   | 5   | 4   | **27** |

**D recommended.** What is one's own is imported: it is the simplest and has nothing to resolve.
What is someone else's goes through a ref of the other bounded context's contract, because that
is the only way for a plugin to replace it or for a test to swap it without touching the import.

### 3.2 How a bounded context is declared

|                                                                                  | E   | F   | L   | D   | T   | C   | Total  |
| -------------------------------------------------------------------------------- | --- | --- | --- | --- | --- | --- | ------ |
| A · Class with methods (mobile's `DomainModule`)                                 | 3   | 4   | 3   | 3   | 3   | 5   | 21     |
| **B · An object with inference (`defineDomain({ needs, provides, emits, … })`)** | 5   | 5   | 5   | 5   | 5   | 4   | **29** |
| C · Chained builder (`domain("x").needs(…).provides(…)`)                         | 4   | 3   | 3   | 4   | 5   | 2   | 21     |

**B recommended**, the shape of `defineConfig` (Vite), `defineStore` (Pinia) or
`defineNuxtModule`: it reads at a glance, the type comes out by itself, and it can be read
without running it. Mobile wraps its `DomainModule` over this.

### 3.3 How a use case is written

|                                                                                              | E   | F   | L   | D   | T   | C   | Total  |
| -------------------------------------------------------------------------------------------- | --- | --- | --- | --- | --- | --- | ------ |
| **A · `Feature` / `ApplicationService` class with interceptors (what was published in 0.2)** | 4   | 5   | 3   | 4   | 4   | 5   | **25** |
| B · Function (`defineFeature({ deps, run })`), intercepted without Proxy                     | 4   | 4   | 5   | 5   | 5   | 3   | 26     |
| C · Effect                                                                                   | 5   | 1   | 4   | 3   | 5   | 1   | 19     |

**A recommended, with an honest caveat.** B is barely cleaner: no Proxy, no `#private`
restriction, the context as an explicit parameter. But A has the same words and the same shape
as sincpro_framework in Python, as mobile and as Odoo 20's Plugins by class, and for a team that
crosses Python, web and mobile that is worth more than one point of elegance. It is also already
published and proven. Switching to B would be breaking things for a point. **What is taken from
B:** the dependencies that cross bounded contexts arrive by refs, and the context is read in
`this.context` and never in a global.

### 3.4 The state of a screen or of a composite component

It is your requirement from the start: the logic outside the component, but each view and each
composite component with its own context.

|                                                                                                                         | E   | F   | L   | D   | T   | C   | Total  |
| ----------------------------------------------------------------------------------------------------------------------- | --- | --- | --- | --- | --- | --- | ------ |
| A · A hand-written context per screen (distribution)                                                                    | 3   | 3   | 1   | 2   | 3   | 5   | 17     |
| B · Only the framework's hooks (`useListing`, `useRecord`)                                                              | 2   | 5   | 4   | 4   | 4   | 3   | 22     |
| **C · `defineScope`: a typed definition that gives the Provider, the hook with selectors and a store testable in Node** | 5   | 4   | 5   | 5   | 5   | 4   | **28** |
| D · An XState machine per screen                                                                                        | 4   | 2   | 3   | 3   | 5   | 2   | 19     |

**C recommended**, and D only for flows with many states (a POS checkout), decided by the app and
not by the framework.

```ts
// domains/sales/components/order/order_scope.ts — the context of a composite component
export const OrderScope = defineScope({
  state: (props: { orderId: string }) => ({ lines: [] as Line[], editing: null as string | null }),
  derived: { total: (s) => s.lines.reduce((sum, line) => sum + line.amount, 0) },
  actions: ({ set, get }) => ({
    add: (product: Product) => set((s) => ({ lines: [...s.lines, lineOf(product)] })),
    confirm: () => sales.confirmOrder.execute({ order_id: get().orderId, lines: get().lines }),
  }),
});

// the composite component: each part reads ONLY what it draws, and does not redraw for the rest
<OrderScope.Provider orderId={id}>
  <OrderLines />
  <OrderTotal />
</OrderScope.Provider>;
function OrderTotal() {
  const total = OrderScope.use((s) => s.total); // typed from the definition
  return <Amount value={total} />;
}

// and tested without drawing anything
const scope = OrderScope.create({ orderId: "o1" });
scope.actions.add(product);
expect(scope.get().total).toBe(150);
```

Inside it is a vanilla store per instance (Zustand `createStore`, 0.5 kB) with selectors over
`useSyncExternalStore`. **Context only injects; it is never the state.** The framework's context
levels (window, record) are scopes of this same kind, so a developer learns one single thing.

### 3.5 The server cache

|                                        | E   | F   | L   | D   | T   | C   | Total  |
| -------------------------------------- | --- | --- | --- | --- | --- | --- | ------ |
| A · Our own (`cachedTransport`)        | 2   | 4   | 3   | 2   | 3   | 3   | 17     |
| **B · TanStack Query under the hooks** | 5   | 4   | 4   | 5   | 5   | 3   | **26** |
| C · TanStack DB                        | 4   | 2   | 3   | 4   | 5   | 2   | 20     |

**B recommended.** It is the one that makes an event refresh every open screen without code, it
brings devtools and refine and react-admin use it. C only for bounded subsets in an offline POS.

### 3.6 Events

|                                                                         | E   | F   | L   | D   | T   | C   | Total  |
| ----------------------------------------------------------------------- | --- | --- | --- | --- | --- | --- | ------ |
| A · A free bus (mitt), anyone emits                                     | 4   | 5   | 2   | 2   | 2   | 3   | 18     |
| **B · Typed registry, closed emitters, `emits` / `refreshOn` declared** | 5   | 4   | 5   | 5   | 5   | 4   | **28** |
| C · RxJS streams                                                        | 4   | 2   | 3   | 3   | 4   | 1   | 17     |

**B recommended.**

### 3.7 Errors

|                                                                                                      | E   | F   | L   | D   | T   | C   | Total  |
| ---------------------------------------------------------------------------------------------------- | --- | --- | --- | --- | --- | --- | ------ |
| A · Unclassified exceptions                                                                          | 2   | 4   | 3   | 2   | 1   | 2   | 14     |
| **B · Classified exceptions inside, a typed result in the hook, the presentation by `Problem.type`** | 5   | 4   | 5   | 5   | 5   | 5   | **29** |
| C · `Result` everywhere (Effect, neverthrow)                                                         | 4   | 2   | 4   | 3   | 5   | 2   | 20     |

**B recommended.** C fights React and TanStack, which speak exceptions. B is also what the
backend does: the expected is not a failure.

### 3.8 Extending

|                                                                                                                       | E   | F   | L   | D   | T   | C   | Total  |
| --------------------------------------------------------------------------------------------------------------------- | --- | --- | --- | --- | --- | --- | ------ |
| A · `patch()` and registries by string (Odoo)                                                                         | 5   | 3   | 1   | 1   | 1   | 3   | 14     |
| **B · Declared, typed points (`slot`, `handlers`, `overrides`, `predicates`, `processors`, `hook`) + `defineModule`** | 5   | 4   | 5   | 5   | 5   | 4   | **28** |
| C · Transformations of the whole configuration (Payload)                                                              | 4   | 4   | 4   | 3   | 4   | 2   | 21     |

**B recommended**, with C only for what belongs to the whole app (the theme, telemetry).

### 3.9 An application's folders

|                                                                                                | E   | F   | L   | D   | T   | C   | Total  |
| ---------------------------------------------------------------------------------------------- | --- | --- | --- | --- | --- | --- | ------ |
| A · By technical kind (`components/`, `hooks/`, `api/`)                                        | 2   | 5   | 2   | 3   | 3   | 1   | 16     |
| **B · By bounded context, with Sincpro's layers and `components/`, growing with the evidence** | 5   | 4   | 4   | 4   | 4   | 5   | **26** |
| C · Feature-Sliced Design                                                                      | 4   | 2   | 3   | 3   | 4   | 2   | 18     |

**B recommended.** The same folders as the backend; FSD clashes with our vocabulary (its
«feature» is a UI interaction, ours a use case).

## 4. The result, in one view

```text
                     ┌──────────────────────── the application ──────────────────────┐
 the backend's       │  defineApplication({ transport, runtime, domains, modules })   │
 contract ─generate─►│                                                                │
                     │  domains/sales                                                 │
                     │    generated/   types, client, entities        (from the contract) │
                     │    contract.ts  refs and types that others import              │
                     │    domain.ts    defineDomain({ needs, provides, emits, … })     │
                     │    services/    Feature · ApplicationService     ← the logic    │
                     │    components/  defineScope + composite          ← the state    │
                     │                 components that read their scope    and the drawing │
                     │    entrypoints/ views · subscribers · what comes in live        │
                     └────────────────────────────────────────────────────────────────┘
   client-framework: defineDomain · defineApplication · Feature · events · errors · client
   web-framework:    defineScope · useService · useQueryService · useDomainEvent · default screens
   ecosystem:        TanStack Query · React 19 · Zustand · OpenTelemetry · Sentry · web-ui · composer
```

## 5. What is decided

All the recommended ones add up to between 25 and 29 out of 30. The ones that need your yes:

1. **§3.3:** keep the `Feature` class (coherence with Python and mobile) instead of moving to
   functions, which would be one point more elegant but would break what is published.
2. **§3.4:** `defineScope` as the single shape of screen state and composite component state.
3. **§3.1:** one's own service by import and someone else's by ref.
