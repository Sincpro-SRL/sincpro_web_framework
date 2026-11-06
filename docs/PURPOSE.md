# What @sincpro/web-framework is for

> **To make good use, together, of the pieces Sincpro builds enterprise software with — the
> backend (sincpro_framework), criteria, web-ui and composer — so that an entity is shown,
> searched, edited and acted on in the web with a minimal declaration, and so that several of them
> live on the same screen.**

This is the guide every change is reviewed against: a piece that serves nothing on this page does
not go in.

## The premise: open, with good practices by default

This is going to be like a modular ERP: someone has to be able to add their odd cases without
asking us for permission. So:

- **We give defaults, never cages.** Each piece is used at three levels, and any of them can be
  skipped:

  | Level           | What the user writes                               | Example                           |
  | --------------- | -------------------------------------------------- | --------------------------------- |
  | 1. Declarative  | names fields and entities                          | `<EntityList columns={[...]}/>`   |
  | 2. Hooks        | builds their own screen with our state             | `useListing` + web-ui's `List`    |
  | 3. Loose pieces | goes straight to criteria, the transport or web-ui | `transport.list(route, criteria)` |

- **What we give are good practices, not business rules.** The rule lives in the backend; here we
  read what the backend publishes (meta, hints, preview) and never re-implement it.
- **It can be done and undone.** Adding a piece does not force anything else, and removing it does
  not break the rest: a screen that drops `EntityList` still has `useListing`.
- **The goal is to solve almost every integration in a healthy way here**, with Sincpro's
  technology, so that each app does not write its own client, its own formatting or its own error
  handling (what forge had to do).

## What each Sincpro project provides

| Project                     | Provides                                                                                                                                                                                             |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sincpro_framework`         | Entities, criteria, `EntityReads` (Get, GetMany, **LiteralSearch**, Search, Preview), commands and dry-run, **drafts**, events (`/<ctx>-events`), permissions, protocols (REST, JSON-RPC, gRPC, MCP) |
| `@sincpro/criteria`         | The contract with the server: Criteria, Meta, Page, Problem, `matches`                                                                                                                               |
| `@sincpro/client-framework` | What every client shares — web, mobile, an SSR, a script —: the transport, `entity()`, the generated client, `Feature` and `ApplicationService` traced and reported by default                       |
| `@sincpro/web-ui`           | How it looks: `List`, `Record`, `SearchBar`, `Picker`, `Activity`, `Dialog`…                                                                                                                         |
| `@sincpro/web-composer`     | Where it opens and the context: page, peek, window, panels, shared selection, ⌘K, shortcuts                                                                                                          |
| **this package**            | The screens: state, lists, records, pickers, commands and activity, drawn with web-ui and opened with composer; browser telemetry and error reporting, optional                                      |
| The application             | What an invoice is                                                                                                                                                                                   |

## The abstractions

| Abstraction                  | What it solves                                                                        | Status                      |
| ---------------------------- | ------------------------------------------------------------------------------------- | --------------------------- |
| `Transport`                  | The port to the backend: REST today, JSON-RPC/gRPC later                              | ✅ REST + memory            |
| `Meta`                       | What each field is: from the server, by hand (`defineMeta`) or completed with OpenAPI | ✅                          |
| `entity()`                   | The single declaration: list, record, commands, history, its key for composer         | ✅                          |
| `useListing` / `EntityList`  | N records: criteria, search bar, builder, paging                                      | ✅                          |
| `useLookup` / `EntityPicker` | **Literal search**: a many2one's select and ⌘K (`LiteralSearch`)                      | ✅                          |
| `useRecord`                  | 1 record: read, edit, preview, hints, **draft**, save, conflict                       | ✅                          |
| `useCommand`                 | An entity's actions, with a dry-run before anything destructive                       | ✅                          |
| `useHistory`                 | Business events (and comments, once the backend has them) → `Record.Activity`         | ✅                          |
| `entityView()`               | The entity as composer views: open, search in ⌘K, its actions                         | ✅ (`entityView`)           |
| `<SincproApp>`               | The application's context: transport, language, metas, composer, shortcuts            | ✅                          |
| `defineList` / `listView`    | An entity with a fixed cut (receivable, drafts): data, list and view                  | ✅                          |
| `useGroups`                  | Group on the server: groups counted over the whole set, rows on open                  | ✅                          |
| `useFollowed`                | A detail panel that follows the record the person is on                               | ✅                          |
| `summaryOf` / `useSummaryOf` | What is known about any record: name, description, state, type, image, authorship     | ✅ (`cardOf`, `relationOf`) |
| `EntityRecord` / `formOf`    | The record of any entity drawn from its meta, without writing the screen              | ✅                          |
| `EntityTags`                 | Several records (many2many): literal search on the server, with faces                 | ✅                          |
| `RecordField` + `entities`   | A many2one / one2many built from the meta alone (`relationFieldOf`, `entityFor`)      | ✅                          |
| `openIn` / `RelatedRecord`   | Open a record where it belongs: a modal by default, never a modal over another        | ✅                          |

### Literal search

A typed text is **always the entity's literal search** — its template (`meta.search`, the
framework's `LiteralSearch`), all its fields at once — and the **server** answers it. Only when
it is asked changes:

- **To choose a record** (many2one, «share with», ⌘K): it opens with the **first 10 in the
  entity's order**, and while typing it asks the server (`useLookup` + `Picker onSearch`). The
  chosen one keeps its name even if it is not among the ten. «Buscar más…» opens the whole list to
  choose from (`api.pick`).
- **In a table**: with **Enter**, never on every key. The bar offers «Buscar «X»» first (the
  template), unless the model reads what was typed as a question of its own — an operator
  («total <= 1000»), an enum value («pagada»), the name of a field —: then that goes first and the
  literal one last. The plain box (`search="box"`) searches the same, with Enter.

Searching by a field of **another** entity («invoices of the customer Globex») is not resolved in
the client: criteria compares its own fields, so the entity publishes the field (`customer_name`)
or includes it in its template.

### Drafts

Two levels, which are not mixed:

1. **What is being typed** lives in the client (`useRecord`): dirty, preview, hints. It is lost on
   close, and that is fine.
2. **A server draft** (the framework's `Drafts`, in Redis with a version): for a long edit, a
   wizard, the same record in two tabs. `useRecord` saves it with the version it read; if another
   tab saved first, the server answers **409** and the screen says so instead of overwriting it.
   A record's answer already carries the `draft` key (we saw it in forge).

A draft that **others** have to see (an invoice under approval) is not a draft: it is a record
with state `draft`.

### Application context and composer

Composer already resolves the context: where something opens, the selection one view publishes
and another reads, ⌘K, shared Escape, moving focus between panels. This package **does not repeat
it: it uses it.**

- An entity becomes composer views (`entityView`): its list, its record, its search in ⌘K (with
  `LiteralSearch`) and its actions (with `useCommand`, and their shortcut drawn in ⌘K).
- `EntityList` publishes its selection (`api.select`), so a panel next to it follows it.
- Links to another entity are references (`bounded_context:type/id`), never imports: two bounded
  contexts talk to each other by reference.

### Several entities on one screen

Three forms, from the most common to the most special:

1. **A record with its relations**: an invoice's lines, a tenant's members (`RecordLines`), with
   their real total.
2. **Several views at once** (composer): the list on the page, the detail in a panel that follows
   the selection, another entity in a window.
3. **An integration view**: reconcile a statement with invoices. The view receives the two
   references, shows the dry-run and ends in **one** server command — the UI orchestrates the
   interaction, the server orchestrates the transaction.

## What it does NOT do

- It is not for mobile: `sincpro_mobile` has its own core.
- It does not handle session or login (the app's), it has no router (composer), it is not a
  general state manager.
- It has no registry of widgets by name in text: a control is replaced with `as`, in code.
- It does not draw technical logs: a record's activity is business events.
- It does not hold business rules: if a rule matters, the backend enforces it.

## How we know it meets its purpose

Rewrite forge's web (`~/dev/sincpro_forge/web`) with this package. If `shared/views.tsx`,
`forge_client.ts`, `history.ts` and `tenant_select.tsx` disappear, and every screen ends up as
entity + JSX, it meets its purpose. What does not disappear is what is missing.

## Open questions

- **Comments**: we did not see in sincpro_framework a concept of comments on a record (Odoo's
  «chatter»). Its contract has to be defined in the backend before drawing it.
- **An entity's actions**: the meta does not say which commands an entity has. Until it publishes
  them, they are declared in `entity()`.
- **Permissions and groups** (decided 2026-10-31): business logic, outside this package.
