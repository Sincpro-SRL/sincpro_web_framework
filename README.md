# @sincpro/web-framework

**The web side of how Sincpro builds business software.** It takes what
[`sincpro_framework`](https://github.com/Sincpro-SRL/sincpro_framework) already resolves on the
server — entities, criteria, commands, drafts, events — and puts it on screen with
[`@sincpro/web-ui`](https://github.com/Sincpro-SRL/sincpro_web_ui), opened where
[`@sincpro/web-composer`](https://github.com/Sincpro-SRL/sincpro_web_composer) says. An
application declares its entities and names its fields; the rest follows.

```bash
yarn add @sincpro/web-framework @sincpro/web-ui @sincpro/criteria @sincpro/criteria-react react react-dom
```

Requires React 19 or newer.

## What we believe

**An ERP is modular, so its framework must be open.** Somebody will always have the case nobody
foresaw — a reconciliation screen, a strange relation, a wizard over three entities. They must
be able to build it here, without asking us and without fighting us. So:

1. **Defaults, never cages.** Every piece comes in three levels, and any of them can be skipped:

   | Level        | What you write                              | Example                                                    |
   | ------------ | ------------------------------------------- | ---------------------------------------------------------- |
   | Declarative  | names of fields and entities                | `<EntityList listing={l} columns={["number", "state"]} />` |
   | Hooks        | your own screen over our state              | `useListing` + web-ui's `List`                             |
   | Loose pieces | straight to criteria, the transport, web-ui | `transport.list(route, criteria)`                          |

   Adding a piece obliges nothing else; removing it breaks nothing else.

2. **We ship good practice, not business rules.** A rule lives in the backend. Here the
   framework reads what the backend publishes — the model definition, the form hints, the
   preview, the refusal — and never re-implements it. If a rule matters, the server keeps it.

3. **Integration should be solved once, here.** Every Sincpro application used to write its
   own client, its own date formatting, its own error box, its own "load more". That is the
   same code everywhere, and it belongs in one place, written well.

4. **The server describes, the screen decides.** The backend says what a field _is_ — its
   word, its type, what it accepts, what it points at. Where it goes, how prominent it is and
   what colour a state is stay in the screen's code. That keeps us out of server-side view
   XML, which is where frameworks like Odoo stop being extensible.

5. **Many entities, one screen.** Business work happens _between_ records: a list with its
   detail beside it, an invoice with its lines, a statement reconciled against invoices. The
   framework is built for that, not for one form at a time.

6. **Use the whole Sincpro stack, not a copy of it.** Composer already knows where things open,
   what is selected and which keys do what; web-ui already knows how a record looks. This
   package uses them — it does not wrap them in a second, weaker version.

## The stack

| Project                 | Brings                                                                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `sincpro_framework`     | Entities, criteria, reads (`Get`, `LiteralSearch`, `Search`, `Preview`), commands and dry runs, drafts, events, permissions, protocols (REST, JSON-RPC, gRPC, MCP) |
| `@sincpro/criteria`     | The contract with the server: `Criteria`, `Meta`, `Page`, `Problem`                                                                                                |
| `@sincpro/web-ui`       | What a screen looks like: `List`, `Record`, `SearchBar`, `Picker`, `Activity`                                                                                      |
| `@sincpro/web-composer` | Where it opens and the context: page, peek, window, panels, shared selection, ⌘K, shortcuts                                                                        |
| **this package**        | The glue: entity + model definition + state + actions, drawn with web-ui, opened with composer                                                                     |
| Your application        | What an invoice is                                                                                                                                                 |

## How it works

Declare an entity once — where it is read, and its key in the workspace:

```ts
import { entity, restTransport } from "@sincpro/web-framework";

export const invoices = entity<Invoice>("billing:invoice", { list: "/invoices" });
export const transport = restTransport({
  base: "/v1",
  headers: () => ({ Authorization: `Bearer ${session.token}` }),
});
```

Provide the transport where the application starts:

```tsx
<FrameworkProvider transport={transport} locale="es">
  <App />
</FrameworkProvider>
```

A list is the entity and the names of its fields. Headers come from the model's labels, each
cell reads as its value means («Pagada», a local date, an amount with its decimals, a many2one
as the name of what it points at), the search bar and the criteria builder ask the server, and
«load more» pages with its cursor:

```tsx
function Invoices({ api }: ViewProps) {
  const listing = useListing(invoices);
  return (
    <EntityList
      listing={listing}
      columns={["number", "customer", "state", "invoice_date", "amount_total"]}
      filters={[
        {
          id: "paid",
          label: "Only paid",
          where: { field: "state", operator: "=", value: "paid" },
        },
      ]}
      onOpen={(row) => api.open(invoiceRef(row.number))}
    />
  );
}
```

One record keeps writing web-ui's `Record` tree; what comes from the model are its props:

```tsx
const invoice = useRecord(invoices, id);
// …
<Record.Paper>
  <Record.Facts fields={factsOf(invoice.record, invoice.meta, ["customer", "due_date"])} />
  <Record.Page id="lines" label="Lines" count={countOf(invoice.record, "lines")}>
    <RecordLines record={invoice.record} meta={invoice.meta} name="lines" />
  </Record.Page>
</Record.Paper>;
```

A domain with no sincpro_framework behind it declares its model by hand and is drawn the same
way:

```ts
const tickets = defineMeta({
  aggregate: "Ticket",
  identity: "id",
  display: "title",
  search: ["title"],
  fields: {
    id: field.text({ readonly: true }),
    title: field.text({ label: { es: "Título" }, required: true }),
    stage: field.choice(["new", "done"], { labels: { new: { es: "Nuevo" } } }),
  },
});
```

### Inside

Three folders, one direction — `make doctor` keeps the arrows:

| Folder          | Knows                                                                                | Why apart                                             |
| --------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `core`          | transport, cache, entity, model definition, what a value reads as                    | plain logic, tested in Node in milliseconds           |
| `react`         | `useListing`, `useRecord`, `useRelated`, `useCommand`…, the provider                 | state that draws nothing: usable without `EntityList` |
| `web/list`      | a collection: `EntityList`, `EntitySearchBar`, `columnsOf`                           | N records, any size                                   |
| `web/record`    | one record: `RecordField`, `factsOf`, `RelatedList`, `EntityPicker`, `CommandButton` | works outside a workspace (no composer)               |
| `web/workspace` | the composer: `entityView`, `webUiSkin`, `useRecordInWorkspace`, `<SincproApp>`      | where it opens, the application context               |

Everything is imported from `@sincpro/web-framework`.

## Where it stands

| Piece                                  | What it solves                                                                             | Status |
| -------------------------------------- | ------------------------------------------------------------------------------------------ | ------ |
| `restTransport`, `memoryTransport`     | The backend, or the same engine in memory                                                  | ✅     |
| `defineMeta`, `metaFromSchema`         | A model by hand, or completed from OpenAPI                                                 | ✅     |
| `useListing`, `EntityList`             | N records: criteria, search bar, builder, paging                                           | ✅     |
| `useRecord`, `factsOf`, `RecordLines`  | One record: facts, relations with their real total                                         | ✅     |
| Preloaded definitions                  | `FrameworkProvider metas`: the model asked once, or never                                  | ✅     |
| `useLookup`, `EntityPicker`            | Literal search: a many2one select, ⌘K                                                      | ✅     |
| `useRecord` + `RecordField`, `dirtyOf` | Editing: hints evaluated live, preview, save with version (409), server drafts             | ✅     |
| `useCommand`, `CommandButton`          | An entity's actions, with a dry run before what destroys                                   | ✅     |
| `useHistory`                           | Business events in `Record.Activity` (comments: backend first)                             | ✅     |
| `entityView`                           | An entity as a composer view: list, record, ⌘K search                                      | ✅     |
| `<SincproApp>`                         | The application context in one place, the workspace dressed as web-ui (`webUiSkin`)        | ✅     |
| `useRecordInWorkspace`                 | A record tells the workspace its real name and its unsaved work (composer 1.0)             | ✅     |
| Paging by pages, ceiling on «more»     | One page on screen, walked by the server's cursor: a million rows never freeze it          | ✅     |
| `cachedTransport`                      | Repeated reads from memory, forgotten when a write touches the entity (on in `SincproApp`) | ✅     |
| `EntitySearchBar`                      | The search bar + criteria builder as a loose piece, for any `List`                         | ✅     |
| `EntityList` views                     | The same set as table, rows or board                                                       | ✅     |
| `useRelated`, `RelatedList`            | A record's relation as a live list: searched and paged by the server, inside a form        | ✅     |
| `EntityPicker` chooser                 | «see all…» opens the whole set, searched on the server: a many2one over millions           | ✅     |
| `useRecord(entity, "")`, `create`      | A new record: the model's defaults, saved to `create`, then it IS the record it became     | ✅     |
| `retryKeys`, `Idempotency-Key`         | A Command or a create retried after a lost answer runs once, not twice                     | ✅     |
| `entity.newRef()`, «New» in the list   | The record's form with no id, in a page or a window; replaced by the record once created   | ✅     |
| `EntityPicker criteria`                | A many2one narrowed by another field: the invoices OF the chosen customer                  | ✅     |
| `chooserIn`, `entity.chooserRef()`     | «see all…» as the composer's chooser: a row answers (`api.pick`)                           | ✅     |
| `useGroups`, «Group by»                | Groups counted by the server over the whole set; a group's rows read when it is opened     | ✅     |
| `defineList`, `listView`               | A named list (a fixed scope, its columns and filters) as data, and as a workspace view     | ✅     |
| `EntityPicker` `browse`, `columns`     | The chooser always a click away, as a table searched literally by the server               | ✅     |
| `useFollowed`                          | A detail panel follows the record the person is on, without knowing the list               | ✅     |
| `commands`, `useRowCommands`           | An entity's Commands on each row, idempotent, offered only where `when` holds              | ✅     |

What it does **not** do: mobile (`sincpro_mobile` has its own core), sessions and login (the
application's), routing (composer's), string-named widget registries, technical logs on a
record's screen, business rules.

The full purpose — literal search, drafts, composer context, several entities per screen — is
in [`docs/PURPOSE.md`](docs/PURPOSE.md); what was found while building and what comes next is in
[`docs/ROADMAP.md`](docs/ROADMAP.md) (both in Spanish).

## Built for large sets

Nothing is filtered, ordered, counted or grouped on the page: every gesture is a question the
server answers. A list holds ONE page by default and walks the server's keyset cursor (page
4 000 costs what page 1 costs); «load more» stops at a ceiling and asks to narrow the search; the
count is the server's, capped; typing waits for a pause; a newer question cancels the older one;
the model definition is asked once per entity; repeated reads come from a cache that a write
clears. Story «15 · Un conjunto grande sin congelar» runs it over 200 000 rows.

## The use cases are the tests

Every use case is a Storybook story run against an in-memory server that answers with the same
criteria engine as sincpro_framework, and each one carries a `play`. The story IS the test:
`make test` runs every story in a real Chrome with vitest (`@storybook/addon-vitest`), awaits its
play and checks its a11y — and the same tests run from Storybook's sidebar («Run tests»). The
plain logic is tested in Node by the same runner. A case the framework cannot do yet shows up
there first.

## Development

```bash
nvm use       # Node 26, from .nvmrc
make init     # pre-commit + yarn install
make test     # vitest: the logic in Node + every use case (story + play) in Chrome
make dev      # Storybook on :6008 — the use cases, «Run tests» in the sidebar
make build
```

Every operation — local or CI — goes through the `Makefile`; run `make` to list the targets.
Working on this repository, human or agent: read [`AGENTS.md`](AGENTS.md) first.

## CI/CD

The workflows in `.github/workflows/` only delegate to the shared `Sincpro-SRL/.github`
pipeline, which calls `make init`, `make verify-format`, `make test`,
`make update-version VERSION=x` and `make publish`.

## License

MIT © Sincpro S.R.L.
