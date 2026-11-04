# AGENTS.md — working on @sincpro/web-framework

Rules for any agent (or person) changing this package. Read the README for the idea and
[`docs/PURPOSE.md`](docs/PURPOSE.md) for what it is for; this file is how to keep it.

## Before you change anything

- **Read `docs/PURPOSE.md`.** It is the yardstick: a piece that serves nothing on that page does
  not go in. If you think it should, change that page first and say why.
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

| Folder               | What                                                                   | May import                                |
| -------------------- | ---------------------------------------------------------------------- | ----------------------------------------- |
| `src/core/`          | transport, entity, model definition, text of a value                   | `@sincpro/criteria` only                  |
| `src/react/`         | hooks and the provider — state, no drawing                             | `core/`, React, `@sincpro/criteria-react` |
| `src/web/list/`      | a collection: `EntityList`, `EntitySearchBar`, columns, search model   | everything above, web-ui, composer        |
| `src/web/record/`    | one record: fields, facts, relations, picker, commands                 | everything above, web-ui — NOT composer   |
| `src/web/workspace/` | the composer: views, skin, `useRecordInWorkspace`, `<SincproApp>`      | everything above, web-ui, composer        |
| `stories/`           | the use cases, one scenario per story, with `play`                     | the package's public entry only           |
| `stories/support/`   | fake domains: `ventas` (by hand), `forge` (copied from a real service) | —                                         |
| `tests/`             | vitest (`model` project, Node) over `core/` and `react/` logic         | —                                         |
| `docs/`              | `PURPOSE.md` (what for), `ROADMAP.md` (found, next, open)              | —                                         |

## Hard rules (the build enforces them)

- **Levels do not climb** (`make doctor`): `core/` imports no React, no DOM, no UI and touches
  no `window`/`document`; `react/` imports no `react-dom` and no `@sincpro/web-ui`; `web/record/`
  imports no composer (a form must work outside a workspace).
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

- Code, comments and this file in English; `docs/` and the stories' prose in Spanish, like the
  rest of Sincpro's documentation. Comments explain _why_; the `Context:` blocks at the top of
  files are the design record — keep them true.
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
- **Whether a list asks for the model definition is decided at mount** (`meta: false` when it
  is already known). Deciding it later changes the criteria and restarts the reading.
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
  on every request goes in the transport's `headers`. No second store here. An analysis once
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
  clock of the zone the app installs (`FrameworkProvider timeZone`, `installTimeZone`) — never
  the browser's when one was given; a day is never converted. A test that installs a zone puts
  it back (`afterEach(() => installTimeZone(undefined))`).
- **A custom record view passes `resource` to `useRecord`, not `resource.id`**: a new record
  opened with `newRef(values)` («Agregar» on a one2many) starts with those values only that way.
- **`useHistory`, not `useActivity`**: web-ui already exports `useActivity` (the panel's open
  state). Do not shadow a name of the stack.
- **A route's keys other than `{id}` come from the BODY** (`pathFor(route, id, body)`):
  sincpro_framework reads a path parameter as a field of the DTO. Never a second argument for
  them, never a hand-built path through `transport.send`.
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
