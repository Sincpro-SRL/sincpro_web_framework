# Adopting what is generated from the contract

How an application builds its screens on a sincpro_framework service without writing by hand what
the server already knows. It is the refactor's guide: what is generated and left alone, what is
written and where, and how a hand-written screen moves to what is generated. The why is in
[`PURPOSE.md`](PURPOSE.md) and the design in
[`prd/PRD_01_generated-domain-and-client.md`](prd/PRD_01_generated-domain-and-client.md).

## What each piece provides

| Piece                                                 | Provides                                                                                                                                                                                              |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| sincpro_framework (≥ 3.32)                            | The **client contract** of each bounded context: models, operations (what each one is for its entity, what it receives, what it answers, in which field its record goes) and how each port is reached |
| `sincpro-client generate` (@sincpro/client-framework) | From that contract: `domain.ts` (the DTOs), `client.ts` (each operation and `clientOf`), `entities.ts` (one `entity<T, C, A>()` per model that is listed), `contract.json` (the snapshot)             |
| `sincpro-client scaffold` (@sincpro/client-framework) | Once, the bounded context's skeleton: its dependencies (the generated client), its `Feature` and `ApplicationService`, its services' index and `export const <alias>` — never overwritten             |
| @sincpro/web-framework                                | The state and the drawing: `useListing`, `useRecord`, `useCommand`, `EntityList`, `RecordField`…, over the transport, reading the server's LIVE definition                                            |
| @sincpro/criteria (≥ 1.1)                             | The read grammar and the reading of definitions (a value a record holds, pointed at by `$ref`, needs 1.1)                                                                                             |
| The application                                       | How each record looks (`presented`), its views, what the contract does not say yet (the history)                                                                                                      |

## The flow, end to end

```text
backend   make contract   →  contracts/<alias>.contract.json   (export-client-contract)
web       make client     →  src/generated/<alias>/             (sincpro-client generate)
CI        make verify-client: regenerates and fails if anything changed without regenerating
```

Following Sincpro's convention, all the logic goes in the `Makefile` and the workflow only calls
`make`:

```make
# backend (Python)
contract:
	poetry run python -m sincpro_framework.entrypoints export-client-contract \
		app.entrypoints.http:gateways web/contracts

# web (Node)
CONTEXTS := project auth
client:
	@for one in $(CONTEXTS); do \
		npx sincpro-client generate contracts/$$one.contract.json \
			--out src/generated/$$one --base /v1; \
	done

verify-client: client
	@git diff --exit-code -- src/generated || \
		(echo >&2 "✘ the contract changed: run make client and commit src/generated"; exit 1)
```

**Once per bounded context**, its skeleton — the files that are the application's from then on
(`infrastructure/dependencies.ts` with the generated client as a dependency,
`infrastructure/bounded_context.ts`, `services/index.ts`, `index.ts` with `export const project`):

```bash
npx sincpro-client scaffold contracts/project.contract.json --out src/domains/project \
  --transport ../common/infrastructure/transport
```

It writes only what is not there and says which files it kept: run it again and nothing of yours
changes. (`generate` is the opposite: it rewrites `generated/` whole, every time.)

The layers are checked as part of the app's `make doctor`:

```make
doctor:
	@npx sincpro-client check --root src
```

`verify-client` goes into the app's `verify-format`. `--base` strips the version the export puts on
every route (`/v1`) and that the transport already prepends (`restTransport({ base: "/v1" })`).
The entities' short key comes from the contract's `alias` (`project` → `project:issue`); `--domain`
changes it.

## Where each thing goes in the application

```text
src/generated/<alias>/     what is generated — NEVER edited; outside prettier and eslint
  domain.ts                the DTOs: models, values, each operation's input and answer
  client.ts                operations (data) and clientOf(transport)
  entities.ts              issues, projects, … and `entities` (all of them)
  contract.json            the snapshot: metasOf, versionsOf
src/domains/<alias>/       yours
  entities.ts              presented(generated.issues, { row, card, option }), what you add
  views/                   the screens
```

```text
# .prettierignore and eslint's ignores
src/generated/
```

## What is generated and what is written

| Generated (left alone)                                              | Written (in `src/domains/`)                                                                    |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| The wire types: each model, value, DTO and answer                   | A type with what the contract does not say yet: `type Issue = dto.Issue & { … }`               |
| Each entity's routes (list, record, edit, preview) and its commands | How it looks: `presented(issues, { row, card, option })`                                       |
| In which field each command's record goes (`target`)                | The history: `{ ...issues, history: { route: "/project-events", type: "Issue" } }`             |
| The typed bodies and answers of each command                        | A screen's views, tones, empty words                                                           |
| The client without a screen (`clientOf`)                            | No routes: a generated route that does not work is a contract bug — it is fixed in the backend |

A generated entity is a plain object: what the contract does not say (`history`, `summary`,
`aggregate`) is added with a spread, and the type is kept.

## How to use what is generated

**Preload and entities**, once, at the application's root:

```tsx
import project from "@app/generated/project/contract.json";
import * as projectEntities from "@app/generated/project/entities";

const transport = restTransport({
  base: "/v1",
  snapshot: versionsOf(project),
  onVersionDrift: ({ model, snapshot, live }) => report(model, snapshot, live),
});

<SincproApp
  transport={transport}
  metas={metasOf(project, "project")}
  entities={[...projectEntities.entities]}
>
```

`onVersionDrift` warns once per model when the server answers a different version than the
snapshot: someone changed the backend and nobody regenerated. It is never an error; the screen
carries on with the live definition.

**Commands**, without type arguments — the name, the body and the answer are checked by the
compiler:

```tsx
const send = useCommand(issues, "sendIssue");
const answer = await send.run(issue.id, { message }); // answer: ResponseSendIssue | undefined

<CommandButton
  entity={issues}
  id={issue.id}
  command="sendIssue"
  body={{ message }}
  label="Enviar"
/>;
```

The record's id goes in `run(id, …)`; the command knows which field of the body it goes in
(`issue_id`). The key is never written twice. Writing `useCommand<Issue, Answer>(…)` turns the
check off: TypeScript does not infer part of a list.

**Per-row actions**, with the commands of the list's entity:

```tsx
const listing = useListing(issues);
<EntityList
  listing={listing}
  commands={[{ command: "stopIssue", label: "Detener", icon: Square }]}
/>;
```

**Lists under a record** (`/tenants/{tenant_id}/members`): the key goes in the params.

```tsx
const members = useListing(memberships, { params: { tenant_id: tenant.id } });
```

**A key that says whose it is** (`tenant_id: EntityID[Tenant]` in the backend) is a many2one
without writing anything: `<RecordField record={issue} name="tenant_id" />` draws the tenant
picker when writing and the tenant's name when reading. The entity has to be among the
application's `entities`.

**Without a screen** (a script, a test, a hook of your own):

```ts
const project = clientOf(transport);
await project.sendIssue({ issue_id: "i1", message: "y el reporte" });
const caller = await auth.getCaller(); // a GET of its own: the transport needs `read`
```

## Moving a hand-written screen to what is generated

1. The backend exports (`make contract`) and the web generates (`make client`).
2. The hand-written wire types are deleted: they are imported from `generated/<alias>/domain`.
3. Each hand-written `entity()` is replaced by the generated one, wrapped in `presented()` if it
   had a look of its own. What the generated one lacks (`history`) is added with a spread.
4. Commands change name: they come from the DTO (`CommandSendIssue` → `sendIssue`). They are
   renamed in every `useCommand`, `CommandButton` and per-row action.
5. Bodies lose the record's key (`{ issue_id, message }` → `{ message }`): `run(id, …)` puts it.
6. What was written with a hand-made `transport.send` (a route with two keys, `revokeShare`)
   becomes a command of the entity.
7. `make verify-client` goes into CI.

What the generator does not do for you, and tells you in the file itself (`Not declared` / `Without an
entity here`): an entity with two reads of the same role, if the backend does not mark which one
is its own, and a model without a list.

## Default decisions

The generator made them; the team can change them before the refactor:

- **Methods and commands are named from the DTO** (`sendIssue`, `setProjectTenant`): long,
  stable and easy to search for.
- **Keys are `string`** in TypeScript, with a note of what they point to. A branded type
  (`IssueId`) would avoid mixing ids, at the cost of `"i1" as IssueId` in tests.
- **What is generated lives in `src/generated/<alias>/`**, outside the formatters.

## Traps

- What is generated is neither formatted nor edited: a formatter that touches it makes
  `verify-client` fail.
- `--base` has to be what the transport prepends; a route outside that base is rejected on
  generating.
- `@sincpro/criteria` 1.1 or later: with 1.0 a value pointed at by `$ref` loses its definition.
- The generator runs on Node 26 (`nvm use`), like the rest of the package.
- A new record of an entity listed under another record needs its definition preloaded
  (`metasOf`): there is no list to ask without the key.
