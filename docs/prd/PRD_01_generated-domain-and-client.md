# PRD_01: the bounded context's types and client, generated from the service's contract

- **Status**: 2026-11-05, on `feat/typed-commands`, uncommitted.
  - **Phase A built** (`docs/ROADMAP.md`, «Typed commands and the core without React»).
  - **Phase B built** against sincpro_framework 3.32's contract (#242–#244; a contract with
    `context` is also read): `domain.ts`, `client.ts`, `entities.ts`, `contract.json`,
    `--domain`, `--base`, `metasOf`, `versionsOf` / `onVersionDrift`, `target` / `bodyFor`, the
    typed answer (`Entity<T, C, A>`), lists under a record, `Transport.read`, typed per-row
    actions and the bare key as a many2one (stories 40 and 41).
  - **Phase C built:** README («From the contract»), [`ADOPTION.md`](../ADOPTION.md),
    ROADMAP and `AGENTS.md`. What is left for the refactor is in the ROADMAP («What was missing before the refactor»).
- **Found by**: forge's console. It hand-writes the wire types (225 lines in
  `web/src/domains/*/domain/*.ts`), every route and every Command (`adapters/forge_*.tsx`), and
  they drift: `revokeShare` still builds its route by hand even though `pathFor` already fills
  any `{key}` from the body.
- **Depends on**: sincpro_framework **PRD_33** (the client contract: each operation's role, its
  input and its output, exported raw with each port's bindings). This PRD's phase A depends on
  nothing.
- **Enables**: forge `docs/27-consola-desde-el-contrato.md` (iteration 8).
- **Philosophy**: what `docs/PURPOSE.md` says — _«so that each app does not write its own
  client»_. The backend exports JSON; this package turns it into code that a person and an AI
  read in the repo. The generated code is a **snapshot** to program better. The truth remains the
  live contract, which the transport already reads and revalidates by `model_version`.

## The map: what goes in each repository

| Repository                                 | What it holds                                                                                                                                                                        | Document                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| `sincpro_framework`                        | Each operation's role, input and output (derived from `Get`/`Search`/`Edit`/… and from `@entity_tags`), and the raw export with each port's bindings. **JSON only**                  | `docs/prd/PRD_33_client-contract.md`   |
| `@sincpro/web-framework` (this one)        | The typed commands, the `/core` subpath and **the generator**: bounded context types (DTOs), client and `entity()`                                                                   | this PRD                               |
| `sincpro_forge`                            | The first consumer: `make contract` in the backend, `make client` / `make verify-client` in the console, and deleting what was written by hand                                       | `docs/27-consola-desde-el-contrato.md` |
| `@sincpro/criteria`                        | **Nothing.** It already reads the models (`metaFromContract`) and `criteria<T>()` already checks fields with the generated `T`. It knows no routes or commands, and does not need to | —                                      |
| `@sincpro/web-ui`, `@sincpro/web-composer` | Nothing                                                                                                                                                                              | —                                      |

**No new package for now.** `src/core/` already has the shape of a shared one (it only imports
`@sincpro/criteria`, no React or DOM, and `make doctor` guarantees it). When there is a consumer
outside the web — the Expo app, a Node script, Python — `core/` and `codegen/` move to a package
of their own. Moving them is moving folders, not redesigning. Before that, one more package is
two releases for a single consumer.

## Problem

1. **Types are written by hand** and `criteria<T>()` checks fields only as well as that `T`.
2. **Routes and commands are declared by hand** in each `entity()`, even though the backend
   already knows which operation lists, reads, edits or acts on each entity.
3. **Commands have no types.** `useCommand(issues, "send").run(id, body)` takes the name as text
   and the body as `AnyRecord` (`src/react/useCommand.ts:25`). `Entity<T>` only carries the
   record's type (`src/core/entity.ts:25`). A misspelled name or body is discovered by the
   server, at runtime.
4. **The package only exports `.`.** A Node script or test that wants the transport drags React
   in.

## What already exists and is reused

`entity()` and `EntityRoutes`, `pathFor` (the route's keys come from the body), `restTransport`
(reads the document and asks for it again when an answer carries another `model_version`),
`FrameworkProvider metas` (meta preload), `presented()` (how a record looks), `newEntityId`
(UUID v7 for `edit`) and `make doctor` (levels do not climb).

## The specification

**MUST**, **MUST NOT**, **SHOULD**, **MAY**, as in RFC 2119 (the original used the Spanish
**DEBE**, **NO DEBE**, **DEBERÍA**, **PUEDE**).

### 1. Typed commands — `Entity<T, C>` (phase A)

- `entity<T, C>(key, routes)`. `C` is a map from command name to body:
  `{ send: { message: string }; stop: Record<string, never> }`.
- `useCommand(e, name)` **MUST** accept only `keyof C`, and `run(id, body)` and the dry run
  **MUST** take `C[name]`. `CommandButton` likewise.
- `C` **MUST** default to today's loose shape, so no screen breaks. A hand-written type works
  just like a generated one.
- A type test (`@ts-expect-error`) for a name that does not exist and a wrong body.

### 2. The `@sincpro/web-framework/core` subpath (phase A)

- `package.json` **MUST** export `./core` → `src/core/index`. It is what the generated
  `client.ts` imports. `make doctor` already ensures it brings no React.

### 3. The generator (phase B)

- A `bin`: `sincpro-web generate <contract.json | url> --out src/generated/<bounded-context>`
  (the name is open).
- It lives in **`codegen/`**, outside `src/`'s levels: it is Node and reads files. It **MAY**
  import `src/core/` and Node; **nothing** in `src/` imports it. `AGENTS.md` adds that row to
  «Where things go» and `make doctor` the rule.
- It reads PRD_33's **metamodel** (`export_metamodel`, with the bindings of its phase 2) and
  writes, **per bounded context**:

| File                         | What it holds                                                                                                                                                                                                                                   | Depends on                    | Level           |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | --------------- |
| `domain.ts` — **the DTOs**   | one type per model (an enum is a union of literals, a nullable is `\| null`) and one per input and output of each operation; the backend's `description` as JSDoc; the version and «do not edit» in the header. **Types only**                  | nothing                       | all             |
| `client.ts` — **the client** | `operations` as data (role, `query`, entities, `targets`, bindings per port) and `<boundedContext>Client(transport)` with typed methods per entity: reads by their role (`search(criteria)`, `get(id)`, `getMany(ids)`), commands by their name | `@sincpro/web-framework/core` | 3, loose pieces |
| `entities.ts`                | one `entity<T, C>(key, routes)` per entity: `list` ← its `search`, `one` ← its `get`, `edit`, `preview`, `commands` ← the commands that concern it, `aggregate` ← its model                                                                     | `@sincpro/web-framework`      | 1 and 2         |
| `contract.json`              | the snapshot: `metasOf(contract)` hands it to `FrameworkProvider metas`, and the transport revalidates                                                                                                                                          | —                             | —               |

- An entity's key is `<bounded-context>:<entity in snake_case>` (`project:issue`), the same one
  forge uses today.
- It **MUST** write the same bytes for the same contract: the diff is readable and CI compares
  it.
- It **MUST NOT** guess. An operation without a role that `entity()` uses stays in the client,
  but not in `entities.ts`. An entity with two operations of the same role picks neither, and
  says so (PRD_33, open questions).
- It **MUST NOT** write outside `--out`, and it replaces that whole folder.

#### 3.1 How it reads the contract

According to the phase 1 brief of PRD_33 (2026-11-05), which corrected the first shape:

- **The source is the metamodel, not the OpenAPI.** The OpenAPI still publishes `Get`,
  `GetMany`, `LiteralSearch` and `PreviewEntity` as non-idempotent POSTs, so as not to move
  existing routes. `query`, `targets` and `values` are only in the metamodel.
- **Identity.** Operations are indexed by `"<context>.<Class>"`, and the root field is
  `context`. The local name (where the method's name comes from) is the key without
  `context + "."`.
- **`$defs`.** Each name comes from its class. If two different classes share a name, both are
  qualified by module (`shop__orders__Line`). They must be sanitised to valid TypeScript
  identifiers (`-` → `_`). A type changing name because a homonymous class appeared is an
  expected compile error; a different shape under the same name never goes through.
- **`targets`** (`{"Issue": "issue_id"}`). `run(id, body)` sets `body[targets[Entity]] = id`.
  In REST, the generator writes that segment as `{id}` in the route it gives `entity()`: the
  server reads the segment as that field, so `pathFor` does not change. An entity that is not in
  `targets` has no target record: it is a `search`, a `get_many` or a command that creates it.
  It **MUST NOT** be guessed.
- **`values`** of `edit` and `preview` is `#/models/<Entity>`: the whole record, typed.
- **`query: true`**: retrying or caching is safe. With `false`, the operation goes with its
  `Idempotency-Key`, as today.
- **`one`** is generated only if the `get` is bound as `GET` with its key in the route, because
  `Transport.one` reads with GET. A `get` bound as POST stays in the client, but not in
  `entities.ts`. It is a framework gap: `rest.get` demands `Query` (forge `docs/26` §5).
- **`x-sincpro.detail` / `search` without their defaults.** An absent key is worth its default.
  `readCriteria` and `searchedFields` (`src/web/list/search.ts`) already tolerate it.
- Event subscribers are no longer in `operations`. The history is the `events` role.

### 4. Permissive at runtime (phase B)

- What is generated is a snapshot. If an answer carries a `model_version` different from the
  snapshot's, the transport **MUST** warn the programmer once (`onVersionDrift`, by default a
  console warning in development), and **NEVER** raise an error.
- A field the snapshot does not know arrives all the same, and the live meta draws it.
- An operation the snapshot lacks is obtained by regenerating.

### 5. Extending without editing what is generated

What is generated is never edited. It is extended by composition, in a file of its own:

```ts
import { issues as generated } from "@app/generated/project/entities";
import type { Issue as Wire } from "@app/generated/project/domain";

export type Issue = Wire & {/* what the contract does not say yet */};
export const issues = presented(generated, { row: (i) => ({ meta: i.status }) });
```

A route is replaced with a spread (`entity(key, { ...routesOf.issue, history: … })`). Each level
keeps its way out, as «Defaults, never cages» asks.

### 6. Stories and tests

- `stories/support/forge.client-contract.json`, **copied from the export of a running forge**
  (like `forge-openapi.json`), and `stories/support/generated/forge/`, generated from it.
- The in-memory server (`stories/support/servidor.ts`) **MUST** speak the contract's routes.
- A story with a `play` that opens the issues list, opens one and runs `send`, all with what is
  generated, without a hand-written route. It must be proven that the `play` fails without the
  generated routes.
- Tests in `tests/`: regenerating to a temporary folder gives the same bytes as what is stored;
  types (`criteria<Project>()` rejects a field that does not exist, a command rejects a wrong
  body).

### 7. Phases

| Phase | What                                                                                                | Depends on              |
| ----- | --------------------------------------------------------------------------------------------------- | ----------------------- |
| **A** | §1 typed commands, §2 `/core` subpath                                                               | nothing — can start now |
| **B** | §3 generator, §4 version warning, §6 story and tests                                                | PRD_33, phases 1 and 2  |
| **C** | README (one more level: «from the contract»), `docs/ROADMAP.md`, `AGENTS.md` (`codegen/` and traps) | B                       |

## Out of scope

- Python and the Expo app: they are the trigger to move `core/` and `codegen/` to a package of
  their own, not work for this PRD.
- Who can do what (permissions): it is business, `docs/PURPOSE.md`.
- A screen's layout: it is the screen's.

## Decisions

- **The generator lives here** because it writes this package's API (`entity()`, `Transport`)
  and because `PURPOSE.md` asks for it. The backend only exports JSON (PRD_33 D3).
- **Types plus a thin client over `core/`**, never a client that implements HTTP on its own in
  each entity: the transport, `Problem`, idempotency and `model_version` remain one and only
  one.
- **REST or gRPC is not chosen at generation.** The client carries the bindings of all ports;
  each app picks its transport. Web uses REST. Today's `.proto` is `Struct`, so a gRPC client's
  types also come from here.

## Open questions

- The methods' names: `CommandSetProjectTenant` → `setProjectTenant`, or a shorter one under its
  entity (`projects.setTenant`).
- Where `history` comes from (PRD_33, open questions).
- The `bin`'s name and whether `generate` also accepts a URL with its `ETag`.
