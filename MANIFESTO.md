# Manifesto

> **@sincpro/web-framework is the framework of work for building business software on the web —
> ERP backoffices, points of sale, customer portals, storefronts — over services built with
> [sincpro_framework](https://github.com/Sincpro-SRL/sincpro_framework). One architecture, one
> vocabulary, zero code where the server already knows, and a marked place for everything else.**

This is the founding statement of the repository: what it is, where it is going, what it is for,
how it is composed, and what it will never be. Every change is measured against it. If a change
needs something this page does not say, change this page first, and say why.

## Why it exists

Business software repeats itself. Every screen lists, searches, edits and acts on records; every
application traces what happened, reports what failed, caches what it read, and gets customised
for one more customer. Written again in each application, the same problems are solved worse each
time — Sincpro's own applications each wrote their own client, their own error box, their own
"load more".

Two failures mark the edges of the road:

- **Extensibility without order.** Platforms where anything can patch anything become impossible
  to upgrade: the customisation that worked yesterday breaks on the next release, and nobody knows
  who changed what.
- **Order without extensibility.** Generators and admin kits that give you a CRUD screen and
  nothing else become cages the first time a real case arrives — a reconciliation, a wizard over
  three entities, a point of sale.

This framework exists to walk between them: **extensible first, ordered always.**

## What it is

- **A framework of work** — an architecture, the pieces of code that implement it, and the tools
  that keep it: a generator from the server's contract, scaffolding, and import rules that fail in
  CI.
- **The web side of sincpro_framework.** The backend publishes its models, its use cases and its
  client contract; this package turns them into typed code and working screens.
- **The glue of the Sincpro stack**: [@sincpro/criteria](https://github.com/Sincpro-SRL/sincpro_criteria)
  is the contract with the server, [@sincpro/web-ui](https://github.com/Sincpro-SRL/sincpro_web_ui)
  is how things look, [@sincpro/web-composer](https://github.com/Sincpro-SRL/sincpro_web_composer)
  is where things open.
- **One base for many applications**: the ERP backoffice and web client, a point of sale, a
  customer portal, a storefront, dashboards and widgets — the same domains, different shells.

## What it is not

- **Not where business rules live.** The server keeps them; this package reads what it publishes.
- **Not a design system** — that is @sincpro/web-ui. **Not a window manager** — that is
  @sincpro/web-composer.
- **Not an admin generator** that guesses screens from sample data, and not a CRUD layer with a
  "custom" escape hatch for everything else: domain commands are first-class and typed.
- **Not low-code.** Everything is code — typed, reviewed, versioned. The zero-code level is a
  default drawn from metadata, not a hidden runtime.
- **Not a permission system, a login or a session manager.** Permissions are business; the
  backend owns them.
- **Not a general state manager**, and not an event bus for everything.
- **Not for mobile.** [@sincpro/mobile](https://github.com/Sincpro-SRL/sincpro_mobile) has its own
  core — with the same vocabulary.
- **Not a place for monkey patches.**

## What we believe

1. **The server is the source of truth.** Rules, validation, visibility and permissions live in
   the backend. The web reads what it publishes — the model, its hints, the preview, the refusal —
   and never re-implements a rule.
2. **The server describes, the screen decides.** The backend says what a field _is_; where it goes
   and how it looks belong to the screen's code. No server-side view definitions.
3. **Generated, never edited.** The contract generates each bounded context's types, client and
   entities. Applications extend by composition, so regenerating never loses work.
4. **Zero code first.** An entity in the contract already has a list, a record, a picker, a place
   in the command palette and its commands. Code is written only where an application differs.
5. **Extensibility has an address.** Every customisation has a level — present, insert, add a
   view, replace — and a place — entity, bounded context, application, tenant, person — with one
   deterministic precedence. Components are swapped by typed reference, inserted at anchors the
   server publishes, and overridden by creating something new. Never by patching, never by a widget
   named in a string, never by an anchor found in the DOM.
6. **Defaults, never cages.** Every piece works at three levels — declarative, hooks, loose
   pieces — and any level can be dropped while keeping the one below. Adding a piece obliges
   nothing; removing it breaks nothing.
7. **All logic lives in services.** A _Feature_ is one use case; an _ApplicationService_
   orchestrates the Features of its own domain. Components draw, entrypoints compose, and nothing
   else decides.
8. **Observability is not optional.** Every use case is traced and every unexpected error is
   reported, and the browser's trace is continued by the server — by the framework, not by each
   author. A failure on screen carries the code that finds it.
9. **One architecture, one vocabulary.** `entrypoints`, `domains`, `common`; inside a domain,
   `domain`, `adapters`, `services`, `infrastructure`, `entrypoints` — plus `components`, because
   the web draws. The same words as sincpro_framework and @sincpro/mobile: whoever knows one knows
   all three.
10. **Bounded contexts never import each other.** They talk by reference (`domain:kind/id`); what
    they truly share is the common domain.
11. **Built for millions.** The page never filters, sorts, counts or groups — the server does.
    Nothing grows without a ceiling.
12. **Use the ecosystem, do not copy it.** web-ui draws, composer opens, criteria is the contract,
    and established libraries do what they do best — caching server state, carrying traces. When a
    piece is missing, it is fixed where it belongs.
13. **Grow by evidence.** No folder, abstraction or layer before its second use. Every change
    starts from a use case, written as a story that fails without it.

## How it is composed

```text
sincpro_framework ── client contract ──► generated/     types, client, entities — never edited
                                             │
                                         services/       Feature · ApplicationService
                                             │           traced, reported, given their context
                                         components/     each entity's kit, drawn from metadata
                                             │
                                         entrypoints/    views · live sources · widgets
                                             │
          shells:   backoffice (composer) · point of sale · customer portal · storefront

infrastructure, across every layer: the levels of context (app · domain · window · record ·
execution), the server-state cache, telemetry, error reporting, the raw transport
```

An application is entrypoints plus domains:

```text
src/
├── entrypoints/            the way in: the shell and the session — composes, holds no logic
└── domains/
    ├── common/             the shared language and the cross-cutting infrastructure
    └── <bounded context>/
        ├── generated/      from the contract — never edited
        ├── domain/  adapters/  services/  infrastructure/
        ├── components/     each entity's own pieces
        └── entrypoints/    its views, its live sources, its widgets
```

The framework gives the pieces at every layer; the application writes only its own — its
services, its entities' kits, its views and widgets, its shell.

## How an application grows

| Level              | What there is                                                                     | Code    |
| ------------------ | --------------------------------------------------------------------------------- | ------- |
| **0**              | The entity is in the contract: a list, a record, a picker, its commands           | None    |
| **1 · Present**    | How it looks: its row, card and option, the control of a field                    | Its kit |
| **2 · Insert**     | A section, column, action or tile at an anchor the server publishes               | Its kit |
| **3 · Add a view** | A screen built from the framework's blocks, keeping drafts, previews and commands | A view  |
| **4 · Replace**    | A screen written whole over services and hooks                                    | A view  |

An entity climbs a level only when it needs to.

## Where it stands

**Built (2.0):** lists, records, pickers, relations and lines; drafts, previews and conflicts; the
backoffice shell on composer; filters named `selection`, as criteria 2.0 and the backend read
them; `useService`, so a screen runs the application's use cases; and optional browser telemetry
and error reporting (`./telemetry`, `./errors`), built from the application's own settings.

**Split out to [@sincpro/client-framework](https://github.com/Sincpro-SRL/sincpro_client_framework)**,
because every client needs it, not only the web: the transport, entities with typed commands and
answers, model definitions, the generator from sincpro_framework's client contract, and `Feature`
and `ApplicationService` with interceptors that trace and report.

**Done since:** the framework's own reads and writes are use cases (`screensTransport`: traced,
with the context, reported); the levels of context and the bounded contexts (client-framework's
`UseBoundedContext`, `processContext`, a change of company read again on every screen); import
rules and scaffolding for applications (`sincpro-client check`, `sincpro-client scaffold`); and a
record screen of one's own that keeps the framework's (`useRecordScreen`).

**Next — the rest of the framework of work** ([`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and
[`docs/prd/PRD_02_how-an-application-is-built.md`](docs/prd/PRD_02_how-an-application-is-built.md)):
a server-state cache that refreshes every open window; the extension model with anchors and
widgets; live sources (waiting on sincpro_framework #201); and a reference application built the
way this page says.

## How we decide

This page is the yardstick. A piece that serves nothing here does not go in. A piece this page
forbids does not go in either. To change what this page says, change the page first — in the
open, with the reason.

Open source, under the [MIT license](LICENSE).
