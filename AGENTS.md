# AGENTS.md — working on @sincpro/web-framework

Rules for any agent (or person) changing this package. Read [`MANIFESTO.md`](MANIFESTO.md) for
what this repository is, is not and is going to be, [`docs/PURPOSE.md`](docs/PURPOSE.md) for what
each piece is for, and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how an application is
built; this file is how to keep it.

## Before you change anything

- **Read `MANIFESTO.md`, then `docs/PURPOSE.md`.** They are the yardstick: a piece that serves
  nothing there does not go in. If you think it should, change the manifesto first and say why.
- **Use the shared words.** Every Sincpro framework speaks one vocabulary, kept in
  @sincpro/client-framework's `docs/UBIQUITOUS_LANGUAGE.md` (`~/dev/sincpro_client_framework`):
  a bounded context — never «domain», «framework» or «module» for one —, Feature,
  ApplicationService, the process, the context, an execution. A new word goes there first.
- **Find the use case.** Every change starts from one, and every use case is a story in
  `stories/` with a `play`. If yours is not there, write the story first; it will fail, and
  that is the point.
- **Look at the real thing.** The model definitions in `stories/support/forge.ts` and
  `forge-openapi.json` are copied from a running forge. When in doubt about what the server
  sends, ask a running service, not memory.
- Run `make dev` and read the existing stories: the piece you are about to write probably
  exists, or its sibling does.

## The premise — keep it

- **Defaults, never cages.** Each piece works at three levels: declarative (`EntityList`),
  hooks (`useListing`), loose pieces (criteria, the transport, web-ui). A screen must be able to
  drop any level and keep the one below. Never make a hook depend on a component, or a
  component the only way to reach some state.
- **The backend keeps the rules.** Read what it publishes — `Meta`, form hints, `Preview`,
  `Problem` — and draw it. Never re-implement a rule here, and never invent a contract the
  server does not have (comments, permissions, actions: ask for them in the backend first).
- **Use the stack, do not copy it.** web-ui draws, composer opens and holds the context,
  criteria is the contract. If one of them lacks something, fix it there and say so in
  `docs/ROADMAP.md`; do not grow a second, weaker version here.
- **Web only.** Mobile has its own core in `sincpro_mobile`. Do not generalise for it.
- **Not on the list:** sessions and login, routing, a string-named widget registry, technical
  logs on a record's screen, a general state manager.

## Where things go

| Folder               | What                                                                                                                                      | May import                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `src/core/`          | the screens' plain logic: text of a value, form defaults, lines, trail, `explain`, the cache                                              | `@sincpro/criteria`, `@sincpro/client-framework` |
| `src/react/`         | hooks and the provider — state, no drawing                                                                                                | `core/`, React, `@sincpro/criteria-react`        |
| `src/web/list/`      | a collection: `EntityList`, `EntitySearchBar`, columns, search model                                                                      | everything above, web-ui, composer               |
| `src/web/record/`    | one record: fields, facts, relations, picker, commands                                                                                    | everything above, web-ui — NOT composer          |
| `src/web/workspace/` | the composer: views, skin, `useRecordInWorkspace`, `<SincproApp>`                                                                         | everything above, web-ui, composer               |
| `stories/`           | the use cases, one scenario per story, with `play`                                                                                        | the package's public entry only                  |
| `stories/support/`   | fake domains: `ventas` (by hand), `forge` (copied from a real service)                                                                    | —                                                |
| `tests/`             | vitest (`model` project, Node) over `core/` and `react/`                                                                                  | —                                                |
| `docs/`              | `PURPOSE.md`, `ROADMAP.md`, `ADOPTION.md` (how an app adopts it), `ARCHITECTURE.md` (how any app is built: the framework of work), `prd/` | —                                                |

## Hard rules (the build enforces them)

- **Levels do not climb** (`make doctor`): `core/` imports no React, no DOM, no UI and touches
  no `window`/`document`; `react/` imports no `react-dom` and no `@sincpro/web-ui`; `web/record/`
  imports no composer (a form must work outside a workspace). Nothing in `src/` imports `node:`,
  and @sincpro/client-framework is imported by its public entry only, never a path inside it.
- **Built for millions.** Never filter, order, count or group on the page; never grow a page
  without a ceiling (`pages` is the default paging); never fetch a whole table to search it.
  A new collection piece proves it on story 15's 200 000 rows.
- **Self-imports, no extensions.** Inside `src/`, import `@sincpro/web-framework/<path>` —
  never a relative path, never `.ts`/`.tsx` (`make doctor`).
- **No copy in components.** Every word the framework writes comes from the copy table
  (`frameworkCopy()`); a new one goes into `ENGLISH_FRAMEWORK_COPY` and
  `SPANISH_FRAMEWORK_COPY` together. Words about the domain come from the model (`labelOf`,
  `choiceLabelOf`), never from a dictionary written here.
- **Tokens only** for the little styling that exists: web-ui's classes (`text-meta`,
  `text-muted`), no arbitrary values, no hex. A screen that needs styling needs a web-ui piece.
- **Client boundary.** A module with hooks or context starts with `"use client";`. Pure logic
  stays without it.
- **Public means exported from its folder's `index.ts`**, and the root entry re-exports the
  three folders.

## Conventions

- **Everything in English** — code, identifiers, comments, `docs/`, file names: this package is
  open source. Spanish only in the stories' prose (titles, on-screen text, descriptions) and in
  `SPANISH_FRAMEWORK_COPY`. Comments explain _why_; the `Context:` blocks at the top of files are
  the design record — keep them true.
- A change ships with a test that fails without it: a test in `tests/` for logic, a story with a
  `play` for a use case.
- Measure before claiming speed: say the number and how it was taken (see `ROADMAP.md`).
- Write what you found in `docs/ROADMAP.md` — a gap in criteria, web-ui, composer or the backend
  is as valuable as the code that works around it.

## Known traps

- **web-ui's `Record.*` and `List.*` are slot trees.** A slot wrapped in a component of ours is
  not found. That is why `factsOf`/`columnsOf` return PROPS and the screen keeps writing the
  tree; do not «simplify» them into wrapper components.
- **A Storybook decorator renders `<Story />`, never `Story()`** — calling it runs the story's
  hooks outside the decorator's provider.
- **The story IS the test.** `make test` runs every story through vitest in Chrome
  (`@storybook/addon-vitest`) and awaits its `play`; do not add a second runner or a test that
  repeats a story. Write a test in `tests/` only for logic that has no screen. Prove a new play
  can fail before trusting it passes. (A hand-written puppeteer smoke used to stop listening
  350 ms after the page went quiet and let three failing plays pass — that is why it is gone.)
- **Typed criteria refuse unknown fields at compile time**, which is right for code and wrong
  for a reading that came from a URL or a saved filter: those are read untyped.
- **The model definition is never asked of a read.** sincpro_framework publishes it once, in
  the discovery document `restTransport` reads (`document`, `/openapi.json`); an answer carries
  only `model_version`, and another version reads the document again (`ETag`, `304`).
- **`EntityList`'s `cells` is memoised by identity** — its functions may close over state.
  Memoise it in the screen, or the table redraws every cell on every render.
- **web-ui's search bar is a `combobox` «Buscar» and its suggestions are `option`s** (1.4). The
  loose box (`search="box"`, `SearchField`) is still a `searchbox`. Never find either as «the
  first textbox»: the first textbox moves when a piece changes role.
- **How a record LOOKS is declared with `presented(entity, { option, row, card })`**
  (`web/list/presentation.ts`), not in `entity()`: `core/` cannot name a React node. Each size
  answers web-ui's PROPS for it, merged over the default (`over`) — a place that draws a record
  of an entity reads `presentationOf(entity)` and applies it, or it is not «everywhere».
- **web-ui's table draws only the rows in view from 200 on** (1.2, `rowWindow`). Counting `<tr>`
  in a play counts what is drawn, not what the list holds: read the table's `aria-rowcount`
  (story 15's `bodyRows`).

- **Before saying «the composer lacks X», read its README** (`~/dev/sincpro_web_composer`). What
  an opening carries is already there: `params` (in the reference: survives reload and links —
  a company, a filter, a default), `api.over` (a modal's host record), `pick(…, { question })` and
  `api.choosing` (a chooser knows it is one; on composer main after 1.4.0), `api.context`
  (focused and selection). The global part is `FrameworkProvider`, and what the backend must see
  on every request goes in the process's context (`processContext.set`, sent as
  `sincpro-context`) — never also in the transport's `headers`: a request's own `sincpro-context`
  replaces the transport's. The token and the session's headers stay in `headers`. No second
  store here. An analysis once
  asked composer for all of this because it read only `api.context`.
- **The shape of a command's answer is the application's** (its DTO), not a framework contract:
  a create that answers `{project_id}` under a meta whose identity is `id` is that service's bug
  (sincpro_framework#228, closed). The front reads the identity by `get_id`/`identity`.

- **A server's word points with a JSON pointer, `#/values/lines/1/qty`** (sincpro_framework):
  read it with `pathOf` / `errorsByField` — whole path kept — and place it with `errorAt` /
  `adviceAt`. A warning is `{message, field, path}` (not `text`); a preview answers `states` and
  `warnings` (sincpro_framework 3.28.2 — `fields`/`advice` before). The fake server in
  `stories/support/servidor.ts` must speak the REAL contract: when it spoke its own (`text`,
  `expected`), the stories passed while the real backend drew empty warnings and refused drafts.
- **Lines travel whole and in order; a new line has NO id** (`core/lines`). Its key lives apart
  (`lineKey`, carried with `sameLine`, matched by position with `linesAnswered`). Never invent a
  per-line command: add, remove, undo and reorder are the screen's. A page of lines is never
  editable — written back whole it deletes what it did not bring (`editableLines`).
- **A `LineItems` callback can run seconds after its render** («Deshacer» in a toast): start from
  the list on screen NOW (a ref), never the render's.

- **The in-memory server answers COPIES.** A row it returns is never the row it keeps — over a
  wire nobody holds the server's object. Returning the same object hid a conflict once: the
  screen's record changed version under it.
- **While a record is dirty, web-ui shows «Guardar / Descartar» IN PLACE of its actions.** A
  play that needs an action must use it before typing.
- **A record opens anywhere the workspace can put it** (`EntityList openTargets`, default
  `targetsFor(api)`): a press is the page, 👁 the peek — `onPeek` WITH `rowClick="open"` (web-ui
  1.5+; without `rowClick` a row click becomes a peek) — and «Abrir en…» (`OpenInMenu`, web-ui's
  own words) the rest, beside the name in the table and on each row. Never only hover icons;
  never a modal from inside a modal. A one2many gets the same through `RecordOpening`.
- **Lists of records search with the BAR** (filters, builder, grouping) — the one2many and the
  «Buscar más…» chooser too. `search="box"` is a screen's explicit choice. With Enter the bar
  takes its FIRST suggestion, which may be a field filter (web-ui): a play picks the literal
  option by name.
- **A pivot is folded by the SERVER** (`usePivot`: grouped by both axes, and by the columns
  alone), handed to web-ui as `folded`. Never web-ui's `spec`: it folds the rows IN HAND.
- **Order is a list** (`listing.order: Sort[]`, `orderBy(one | many | null)`), and so is web-ui's
  (1.7: `sort: SortState[]`): the builder, ⇧-click on a header and the sort menu all write the
  same list, whole. A play holds ⇧ with ONE `userEvent.setup()` session — separate calls do not
  share the keyboard.
- **A form's fields go in web-ui's `FormSection`**, never a hand-made column: two columns on a
  page and in a modal, one in a panel or a peek (`api.surface`) — the grid does not narrow by
  itself. A list inside a record not on a page starts as rows (`RecordOpening.narrow`).
- **A picker opens in the workspace by itself.** `EntityPicker` / `EntityTags` read the view's
  `RecordOpening` (given by `entityView`): inside a workspace «Buscar más…» is `api.pick` and the
  chosen opens there — never web-ui's `Dialog` — unless the screen passes `onOpen` /
  `onBrowseAll`. Their chooser CARRIES the cut (`chooserRef(query, scope)` → `ListScopeProvider`
  → `useListing`): a chooser that offers what the picker excludes is a bug. Inside a line the
  lines editor gives an opening without `choose`; `ownChooser` asks for the built-in one.
- **A new record of an entity with `edit`, keyed by `id`, gets its id HERE** (`newEntityId`, a
  UUID v7 as 32 hex, sincpro_framework's format): its draft and its save go through the `Edit`
  route under it. Without `edit` no id is sent — a `create` DTO is the application's.
- **web-ui's `Picker` offers «see all…» only while it holds rows it does not draw** — never when
  given `onLoadMore`. `EntityPicker` does not pass it, so the chooser (the server search) is
  always reachable.
- **Inside a web-ui `Dialog` a `SearchField` is not exposed as `searchbox`**: a play finds it by
  its label.
- **The composer has no look of its own to rely on** (1.0): it ships a minimal one. What reads as
  web-ui comes from `webUiSkin`; a new composer part to dress goes there, never as CSS overrides
  of `sc-*` classes.
- **web-ui's `List` swaps its body for a skeleton while `state.loading`.** `EntityList` says
  `loading` only on the FIRST reading: refining keeps the rows on screen until the server
  answers. Passing every reading's status made the rows vanish under the pointer, and a play
  that clicked one failed on a slower CI only.
- **A window, a dialog or a popover animates in: never ask once whether something in it is
  visible.** It is in the document before it is shown, and on a loaded runner a single
  `expect(…).toBeVisible()` lands on its first frame (opacity 0) and fails at once — stories 09,
  29 and 30 did, in full runs only. Wait for it: `await waitFor(() => expect(…).toBeVisible())`.
- **A long play runs out of time before it fails an assertion.** A story is one scenario; a play
  that walks ten (search, open, edit, save, a modal, its rows…) passes alone and times out under
  load. Split it.
- **Telemetry and error reporting are optional entries** (`./telemetry`, `./errors`): nothing
  else imports them (`make doctor`), their SDKs are optional peers loaded with `import()`, and
  without them — or if they fail to load — use cases run untraced and nothing breaks. They build
  what the application asks for from its own settings; an application may hand its own tracer or
  reporter to `configureProcess` instead.
- **What a screen reads and writes is a use case of `screens`, and a change of context reads
  again — never starts over.** `FrameworkProvider` reads and writes through `screensTransport`
  (each request traced, with the context, reported when it failed); the transport stays the same
  one. When the process's context changes, a reading re-reads its own question
  (`useFramework().context` in its effect, `reading.reload()` for a list) and a record being
  edited keeps what was typed. Giving the screens a new transport instead started every reading
  over: a list lost its filter and page, a record its edits. In a play with a `memoryTracer`,
  the `screens/…` spans are there too — filter by name, never take `spans[0]` blindly.
- **A play waits up to 5 s** (`configure({ asyncUtilTimeout })` in `.storybook/preview.ts`).
  On the CI runner every story file shares one Chrome, and a 250 ms fake-server timer can take
  over a second: with Testing Library's default (1 s) plays failed there and never locally.
  Do not lower it; a play that needs a deadline measures it itself.
- **Reading the same record again keeps it on screen** (`useRecord`): after a save or a
  `reload()` the record stays until the answer; only another id starts as «loading». A record
  that blinked through a skeleton lost its focus and the click that landed then.
- **A timer calls the LATEST function, never the one of its render** (`useListing`'s typing
  pause reads a ref). The pause armed before the model arrived used to ask with a refine that
  had no model — unfiltered — after the right question had gone out: on a slow network the list
  ignored what was typed. Story `09 · EscribirAntesDeQueLlegueElModelo` pins the timing.
- **A one2many is a block: `FormSection title`, never a web-ui `Field`.** Every control inside a
  `Field` reads its id and label (`useFieldIds`): the cells of the lines and the related list's
  search bar all took the same id and the relation's name.
- **`aria-label` only where nothing names the control** (`FieldControl.standalone`, a cell): inside
  a `Field` React Aria reads both and the name doubles («Precio Precio»).
- **Where a line is written is ONE decision, `addingOf`**: the table when every field a person
  writes fits a cell, the dialog otherwise — never force «inline». A many2one fits only when its
  entity is declared, and it resolves by the entity's `aggregate` or its meta already read:
  declare `aggregate` in `entity()` or preload the meta, or the line falls to the dialog.
- **web-ui's `LineItems` draws `value` unless the column has `cell`** — `text` is only what its
  search reads. Give `cell` the model's text.
- **Every level has its way in** (`RecordField as` / `lines` / `list`, `EntityList cells` /
  `faces`, `RecordLinesEditor look`): a new default piece ships with the prop that replaces it.
  A screen's face goes in as web-ui's `List.Present` written straight into `List` — a slot.
- **A `datetime` is an instant; a `date` is a day.** The instant is read and typed on the wall
  clock of the zone the app installs — never the browser's when one was given; a day is never
  converted. The conversions (`installTimeZone`, `wallTimeOf`, `instantOf`, `dayOf`) are
  @sincpro/client-framework's — every platform needs them — imported from there and never
  re-exported here; `FrameworkProvider timeZone` installs the zone THERE. A test that installs a
  zone puts it back (`afterEach(() => installTimeZone(undefined))`).
- **A custom record view passes `resource` to `useRecord`, not `resource.id`**: a new record
  opened with `newRef(values)` («Agregar» on a one2many) starts with those values only that way.
- **`useHistory`, not `useActivity`**: web-ui already exports `useActivity` (the panel's open
  state). Do not shadow a name of the stack.
- **A route's keys other than `{id}` come from the BODY** (`pathFor(route, id, body)`):
  sincpro_framework reads a path parameter as a field of the DTO. Never a second argument for
  them, never a hand-built path through `transport.send`.
- **A typed entity's Commands are checked only when no type argument is written.**
  `entity<T, C>` types each Command's body (`CommandBodies`); `useCommand(issues, "send")` infers
  `C` and the name. `useCommand<Issue, Answer>(…)` falls back to the loose default (TypeScript
  never infers part of a list), so a screen that wants the check writes no type argument.
- **A bounded context, its services, the process and the context are @sincpro/client-framework's**
  (`UseBoundedContext`, `configureProcess`, `processContext`): a screen runs a use case with
  `useService(project.Issues.close)` and reads the context with `useContextValues(level)` — never
  a second store of the context here, never a wrapper that calls a service outside its bounded
  context (it would skip the trace). The process is global: a story that needs its own tracer
  calls `configureProcess` at the start of its `play`.
- **The transport, the entity and the generator are @sincpro/client-framework's.** Import them
  from there, never re-export them here (`tests/index.test.ts` pins it): one door, or two versions
  meet in one screen. `stories/support/forge-contract/` holds forge's contracts and what that
  generator writes from them, out of prettier and eslint; story 40 runs on them. After upgrading
  @sincpro/client-framework, run `make codegen-fixtures` and read the diff.
- **A transport here forwards a call's own headers** (`CallOptions`): `cachedTransport` hands
  them down and keeps answers by the question alone — the headers are a use case's trace.
- **A Command's record goes where its body names it** (`target`, `bodyFor`): `run(id, body)`
  writes the id in that field and `pathFor` takes it from there, whether the path carries it
  (`/issues/{issue_id}/messages`) or not (`POST /issues` with `project_id`). A generated entity
  types the body without that field, so the screen never writes the key twice.
- **In a record every field comes but a related one** (the generator's `optional`): a
  model's contract lists as required only what has no default — in forge, nothing —, while the
  server writes the whole record. A relation comes only when the read expands it.
- **A key alone is a relation with `held: false`** (`relationFieldOf`): `EntityID[Tenant]` has no
  relation field beside it, so `relation` IS the key. Never write the chosen record beside it —
  the lines editor did (`{ [key]: id, [relation]: chosen }`) and the record went INTO the key.
  Its name is asked once by key (`useNameOf`); in a table it stays the key.
- **A list under a record fills its path keys from `params`** (`listRoute`): a key it lacks is
  refused before anything is sent, and a new record of such an entity needs its definition
  preloaded (`metasOf`) — there is no list to ask without the key.
- **`Transport.read` is optional**: call it through `readRoute`, which says by name when a
  transport has none. `cachedTransport` never keeps a read — it is the context's own.
- **`presented` keeps an entity's typed Commands and answers** (`Presented<T, C, A>`). A helper
  that takes an entity and returns `Entity<T>` silently turns a generated entity loose.
- **The meta store is filled DURING useListing's render**: a value read from it earlier in the
  same component's render is from before the answer, and nothing renders again. A criteria that
  depends on the definition keeps it in state and sets it in an effect (`useLookup exclude`).

## Before you hand it back

```bash
make verify-format   # eslint --fix + prettier + typecheck + doctor
make test            # with Chrome installed: the logic in Node + every story and its play
make build
```

Never bump `version` in `package.json` — the release pipeline does. Never commit; a person
does.
