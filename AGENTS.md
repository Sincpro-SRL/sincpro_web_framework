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
- **web-ui's search bar** loses its input's accessible name once a chip is placed, and its panel
  trigger reads «1» instead of its title. Find them by structure in a play, and leave the fix
  to web-ui (listed in `ROADMAP.md`).

- **The in-memory server answers COPIES.** A row it returns is never the row it keeps — over a
  wire nobody holds the server's object. Returning the same object hid a conflict once: the
  screen's record changed version under it.
- **While a record is dirty, web-ui shows «Guardar / Descartar» IN PLACE of its actions.** A
  play that needs an action must use it before typing.
- **web-ui's table turns a row click into a PEEK whenever `onPeek` is given** (`onPeek ?? onOpen`).
  So `EntityList` never passes one by itself: a row opens the page, and the peek, side panel and
  window are the composer's `RecordLink` on the identity column.
- **A `Record` edited with `dirtyOf` must have `Record.Actions`.** Without them web-ui's `Record`
  remounts its paper the moment `dirty` appears: the field being typed in loses its focus after
  one letter. A web-ui bug (ROADMAP); found by a play that typed and read back what it typed.
- **web-ui's `Picker` offers «see all…» only while it holds rows it does not draw** — never when
  given `onLoadMore`. `EntityPicker` does not pass it, so the chooser (the server search) is
  always reachable.
- **Inside a web-ui `Dialog` a `SearchField` is not exposed as `searchbox`**: a play finds it by
  its label.
- **The composer has no look of its own to rely on** (1.0): it ships a minimal one. What reads as
  web-ui comes from `webUiSkin`; a new composer part to dress goes there, never as CSS overrides
  of `sc-*` classes.
- **`useHistory`, not `useActivity`**: web-ui already exports `useActivity` (the panel's open
  state). Do not shadow a name of the stack.

## Before you hand it back

```bash
make verify-format   # eslint --fix + prettier + typecheck + doctor
make test            # with Chrome installed: the logic in Node + every story and its play
make build
```

Never bump `version` in `package.json` — the release pipeline does. Never commit; a person
does.
