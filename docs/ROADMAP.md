# @sincpro/web-framework roadmap

How this package is built: **every use case is a Storybook story with its `play`** (`make test`
runs them with vitest in a real Chrome), and every piece of `core/` has its test in `tests/`.
What a case cannot do yet shows up there first, and enters this list.

## Web only (decided 2026-10-31)

This package is the **web** client of sincpro_framework, paired with `@sincpro/web-ui` and
`@sincpro/web-composer`. Mobile (`sincpro_mobile`) has its own core, with REST or gRPC: a generic
package for both platforms would end up lowering the real requirements of each. What is shared is
the contract with the server: `@sincpro/criteria`.

Inside, three folders with one direction (`make doctor`):

| Folder  | Knows about                                   | Rule                                 |
| ------- | --------------------------------------------- | ------------------------------------ |
| `core`  | transport, entity, meta, what text a value is | no React or DOM: tested in Node      |
| `react` | `useListing`, `useRecord`, the provider       | no DOM or web-ui: state, not drawing |
| `web`   | `@sincpro/web-ui`                             | —                                    |

A single entry: `@sincpro/web-framework`.

## Phase 1 — read (done)

| Use case                                     | Story                                      |
| -------------------------------------------- | ------------------------------------------ |
| A list built by naming fields                | `01 · Una lista…`                          |
| A list without naming anything (all scalars) | `01 · …Sin nombrar nada`                   |
| Search with the entity's template            | `02 · Buscar…`                             |
| A record: data, one2many with its real total | `03 · Un registro…`                        |
| From the list to the record and back         | `03 · …De la lista al registro`            |
| No access, does not exist, condition ignored | `04 · Cuando el servidor dice que no`      |
| forge's meta exactly as it arrives today     | `05 · La meta tal como la manda forge hoy` |

Transports: `restTransport` (sincpro_framework REST) and `memoryTransport` (the same criteria
engine, in memory). Hand-written model: `defineMeta` + `field.*`.

## What we found missing

### In other packages

- ~~**`@sincpro/criteria` `restSource`**: it appends `?criteria=` to a route that has its own
  query and sends it as base64url~~ — solved in criteria 0.3.1; `restTransport.list` now
  delegates to it (see «criteria 0.3.1»).
- ~~**`@sincpro/criteria-react` 0.3.0** declares `@sincpro/criteria@^0.1.0` as a peer~~ — solved
  in 0.3.1 (`^0.3.0`).
- **forge does not declare labels**: story 05 shows `display_name` as the header.
- **The meta weighs ~97 KB per response** in forge (even without rows): `useListing` already asks
  for it only on the first page; the framework should serialize it without its default values.
- **sincpro_framework**: `Literal` and `list[...]` types inside a value object arrive as
  `unknown`; a reference to another bounded context (`tenant_id`) does not say what it points to;
  there is no format semantics (email, url, amount); the meta does not say which actions an entity
  has.

### In this package

- **Done after phase 1** (2026-10-31): literal and many2one search (`useLookup`, `EntityPicker`),
  composer (`entityView`, `EntityList` with `api`, published selection), editing (`useRecord` +
  `RecordField` + `dirtyOf`: live hints, preview, version and 409, drafts), commands with dry run
  (`useCommand`, `CommandButton`), history (`useHistory`) and `<SincproApp>`. Stories 08–11.
- **Composer 1.0** (2026-10-31): it no longer depends on web-ui and ships its own skin. This
  package dresses it in web-ui (`webUiSkin`: lucide icons, `Peek`, `Dialog`, `Missing`) and
  `<SincproApp>` uses it by default; `useRecordInWorkspace` uses `setTitle`/`setDirty` so the
  breadcrumb shows the real name and discarding changes asks first.
- **Scale and cache** (2026-10-31): paging by pages with the server's cursor (the default) and a
  ceiling on «load more»; `cachedTransport` with invalidation on write (active in `SincproApp`);
  previews cancelled by the next one; `EntitySearchBar` as a loose piece; table/rows/board views;
  `useRelated`/`RelatedList`; an `EntityPicker` chooser that searches on the server. `web/` split
  into `list/`, `record/`, `workspace/`. Stories 15–16, 200 000 rows.
- **Real scale**: since web-ui 1.2 the table draws only the rows in view from 200 on
  (`rowWindow`); the ceiling and the pages stay, because bringing rows still costs. Grouping on
  the server is already there (see «Grouping» below); measuring (sums, averages per group) still
  has no piece.
- **Phase 2 — edit** (done): `useRecord` with dirty, preview/onchange (the framework's
  `Preview`), `*_when` hints evaluated with `matches`, save/discard, 409 conflict, errors by
  field (`Problem.errors`). `RecordField` with one control per type and `as` to replace it.
- **Phase 3 — act**: `useCommand` with dry-run (`DryRunnable` → `Preview(text, data)`),
  relations that change through commands (share/revoke), history (`/<ctx>-events`).
- **Phase 4 — relations and composer** (partly done): `entityView` gives the entity to composer
  (list, record, ⌘K through `LiteralSearch`); `EntityList` with `api` opens and sets the
  breadcrumbs; `EntityPicker` is the many2one. Missing: publishing the selection (`api.select`),
  `api.pick` from the picker in a story, and backlinks between bounded contexts.
- **Phase 5 — dashboards**: blocks tied to criteria, global filters with `dynamic.param`.
- ~~**web-ui `Record`** without `Record.Actions` remounted its sheet when `dirty` appeared~~ —
  solved in web-ui (`RecordHeader`: `dirty` no longer decides the sheet). Checked by taking
  `Record.Actions` out of `12 · Un formulario…`: typing «Llamar antes» does not lose focus. The
  trap left `AGENTS.md`.
- **web-ui `Picker`** (solved in web-ui 1.0: see «Composer 1.4 and web-ui 1.0») offered «ver
  todos…» only when it held rows it does not draw (and never if it receives `onLoadMore`): it
  cannot say «there is more on the server». `EntityPicker` does not pass it `onLoadMore` so the
  chooser is always at hand; an explicit `browsable` is web-ui's.
- **web-ui `Picker`** filters only what it already loaded and does not know how to ask for more
  by text: `EntityPicker` narrows the loaded page, «load more» brings the next one and «search
  everything» opens the list. A `Picker` that searches on the server is web-ui's.
- **web-ui `SearchBar`**: its field has `choices` but not the word of each, so the bar offers
  «paid» where the cell says «Pagada»; and it offers «Estado es Globex» with a value the enum
  does not have. The two accessibility gaps the `play`s found (the unnamed input with a chip set
  and the panel button that said «1») were closed by web-ui 1.2: `06 · Filtrar` already finds
  them by name.
- **Search by a field of another aggregate** («customer is called Globex»): criteria compares
  only own fields. The entity has to publish the field (`customer_name`) or its search template
  has to include it; it is not solved on the client.
- **Sorting**: `orderBy` asks the server for the order; a case that verifies it is missing.

## The forge console migrated (2026-10-31)

The success criterion of `PURPOSE.md`: forge's console (`~/dev/sincpro_forge/web`) migrated to
0.1.0 with composer 1.0. `forge_client.ts`, `forge_context.tsx`, `collection.tsx`, `model.ts`,
`history.ts` and `views.tsx` disappeared; `records.ts` was left with two wire types and
`tenant_select.tsx` stayed (gap 2). `web/src` went from 3 049 to 2 195 lines. Tested against a
running forge, as admin and as a tenant user: list, search, sort (reaches the server), peek, ⌘K,
share, revoke, issue a token and history.

What could not be replaced, with its owner:

| #   | Gap                                                                                                                                                                                                                                                                                      | Owner                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 1   | ~~`commands` only fills `{id}`~~: **solved** — any other `{key}` of the route comes from the body field with that name (`pathFor`), as sincpro_framework reads it. `POST /projects/{id}/shares/{tenant_id}/revoke` goes through `CommandButton`                                          | web-framework                 |
| 2   | ~~`EntityPicker` without a «none» option or `exclude`~~: **solved** — `none` (choosing nothing, which answers `""`) and `exclude` (the keys the server leaves out, `not in`; also in `useLookup`). `TenantSelect` can now leave forge                                                    | web-framework                 |
| 3   | ~~`entityView` covers list and record, not create~~: **solved** with `create` and `newRef()` (see «Lifecycle and operation»)                                                                                                                                                             | web-framework                 |
| 4   | Permissions: `caller === "admin"` decides views and pages; `useHistory` asks for the history even if whoever is looking cannot read it (forge answers 403 and the view omits it: one lost request per record). Permissions and groups are business, outside the framework (`PURPOSE.md`) | forge                         |
| 5   | Labels: `project` and part of `auth` already declare them (backend uncommitted), but `id`, `created_at` and the `choice_labels` of `Role` («member») do not. The UI does not cover for them                                                                                              | forge backend                 |
| 6   | ~~`<SincproApp>` owns its workspace and draws no bar~~: **solved** — `workspace` (the app's `useWorkspace()`) and `bar`, above the workspace and inside the providers                                                                                                                    | web-framework                 |
| 7   | ~~`cachedTransport` forgets only the first part of the route~~: **solved** — a write forgets every collection its route names and, with `entities`, the entity's history (`SincproApp` passes them). `/facturas` no longer forgets `/facturas-events`                                    | web-framework                 |
| 8   | ~~The ⌘K search of `entityView` uses `entity.list` without `params`~~: **solved** — `search: { params }` says where it searches. That the admin sees everything remains forge's                                                                                                          | web-framework + forge backend |
| 9   | ~~`historyOf` reads a fact without `label` as its id~~: **solved** — «Cambio registrado» (`summary.recorded`)                                                                                                                                                                            | web-framework                 |
| 10  | ~~`EntityList`/`RecordLines` do not expose per-row actions~~: **solved** with `EntityList commands` / `rowActions` and `useRowCommands` (story 23)                                                                                                                                       | web-framework                 |
| 11  | ~~`CommandButton` has no `disabled`~~: **solved** — `disabled`; the server still decides                                                                                                                                                                                                 | web-framework                 |
| 12  | ~~`entityView` receives the components, not a `load`~~: **solved** — `load: () => import(…)` brings the screens when the view is first opened, only once                                                                                                                                 | web-framework                 |
| 13  | ~~The «rows» view of `EntityList` builds the row only with display + fields~~: **solved** with `presented(entity, { row })` — the labels («compartido», «inactivo») go in `row.tags` (see «How a record looks»)                                                                          | web-framework                 |
| 14  | `webUiSkin` gave composer lucide icons at 24 px (its default) inside 22 px controls: a link's peek/side/window and the panel's frame looked bigger than the name. **Fixed in `skin.tsx`** (16 px, like composer's glyphs), release pending; forge uses `DEFAULT_ICONS` meanwhile         | web-framework                 |
| 15  | Composer draws a skin icon as `<Icon />` with no size or class, and its CSS does not bound the `svg` of `.sc-control`: any skin with icons of another size overflows. Bounding it in `.sc-control svg` makes it robust                                                                   | composer                      |
| 16  | `Record` has no density: in a panel or the peek the title, the facts and the activity have the same size as on a page, and a long monospaced fact (an email) sticks to the next one                                                                                                      | web-ui                        |

## Lifecycle and operation (2026-10-31)

What a business app needs from a record besides reading and editing it. Each thing lives where it
has to live: the behavior here, the component in web-ui, the contract in the backend.

| Use case                                        | Story / test                         | Status                               |
| ----------------------------------------------- | ------------------------------------ | ------------------------------------ |
| Create with the meta's `default`s               | `17 · Crear un registro`             | ✅ `useRecord(entity, "")`           |
| On creation, the screen becomes the record      | `17 · …SeCreaYSeVuelveElRegistro`    | ✅ by the answer's identity          |
| Retry a create or a Command without duplicating | `17 · ReintentarNoDuplica`, `tests/` | ✅ `Idempotency-Key` (`retryKeys`)   |
| «Nuevo» in the list, in a page or window        | `18 · Las ventanas de composer`      | ✅ `entity.newRef()` + `api.replace` |
| Choose a record with composer's chooser         | `18 · ElegirEnUnaVentana`            | ✅ `chooserIn` + `api.answer`        |
| Many2one narrowed by another field              | `09 · AcotadoPorOtroCampo`           | ✅ `criteria` in `EntityPicker`      |

With this, gap 3 of forge's console (`new-project`, `new-tenant`, `new-user` as hand-written
`ViewSpec`s) closes: `create` in the entity, `newRef()` and the record view with an empty id.

### Found while writing it

Composer [#6](https://github.com/Sincpro-SRL/sincpro_web_composer/issues/6) was solved in composer
1.1.0 (`useCrumbs`, already installed). [#5](https://github.com/Sincpro-SRL/sincpro_web_composer/issues/5)
was misdiagnosed: it was not composer's (see below). Requests open in sincpro_framework:
[#228](https://github.com/Sincpro-SRL/sincpro_framework/issues/228) (a create answers its
identity), [#229](https://github.com/Sincpro-SRL/sincpro_framework/issues/229) (writing an
aggregate's lines) and [#230](https://github.com/Sincpro-SRL/sincpro_framework/issues/230)
(actions, references and format in the meta; permissions stay in the application, see
`PURPOSE.md`).

- **useRecord** (fixed): with the new id, one render showed the previous record under the new
  identity — the screen read `record.customer` from an empty form. Now a state is shown only for
  the id it was read with.
- **A list in a panel stayed empty** (fixed; it was ours, not composer's — composer #5 answered
  it). A narrow list (window, side panel, phone) is drawn by web-ui as rows after the first paint
  (`useNarrowList`), whatever the screen asks for; `EntityList` wrote `List.Rows` only if the
  screen asked for that view, so it drew nothing there. Now it always writes it. The test saw
  «the row is disconnected» because it pressed the table row that web-ui had just replaced.
- **web-ui — a `List` without a rows face** also falls back to rows when narrow and draws
  nothing. It should stay on the face it has, or warn.
- ~~**composer — a view does not know it was opened to choose**~~: composer has it on main
  (#12, after 1.4.0): `api.choosing` and `pick(…, { question })`. When published, `PICK_PARAM`
  (`entity.chooserRef()`, `EntityList`) is replaced by `api.choosing`.
- **A record's breadcrumb with its real name** (fixed with composer 1.1.0): `EntityList` and the
  stories' views draw the breadcrumb with `useCrumbs(api)`, which follows `setTitle`; with
  `api.crumbs()` in the render the reference stayed («Nuevo», «C-004»). The peer went to
  `^1.1.0`.
- **web-ui `Picker`** (solved in web-ui 1.0, which also brings `onCreate`): it did not offer «ver
  todos…» when it drew all its rows, so with few records composer's chooser needs a button of its
  own. It also has no «crear "Globex"…» (create from the picker), which could already use
  `newRef()`.
- **Duplicate** is not done on the client: it would copy the sequential number. The backend has to
  publish which fields are not copied (`copy: false`, like Odoo) or a `Duplicate`.
- **Editable lines** (one2many): web-ui already has `LineItems`; the backend contract to write an
  aggregate's lines is missing (replace the set, or per-line commands).
- **A create that does not answer its identity** (forge answers `{project_id}`, not `{id}`): the
  hook leaves the answer in `edit.created` and the screen decides. Better for the framework to
  answer the identity under the name of the meta's `identity`.

## Grouping (2026-10-31)

Grouping a list is data management, not a dashboard: it was in phase 5 together with the
dashboards and never arrived. Now «Agrupar por», in the bar's panel, offers the meta's `groupable`
fields (a date with its cuts) and the list shows the groups **counted by the server** over the
whole set (`useGroups`: the list's question + `group_by`, with a ceiling of 100 groups). A group
starts closed and its rows are asked for when it opens, with the group's own criteria. The
in-memory server also answers groups (criteria's `answerGroups`), like the backend. Stories
`19 · Agrupar` and `15 · AgruparDoscientosMil` (four groups of 50 000, fifty rows when opening
one).

What is missing, with its owner:

- ~~**web-ui — the table groups the page**~~ (solved with web-ui 1.4, see «web-ui 1.4»):
  `DataTable` builds the groups with the rows it has and counts `getLeafRows()`; it ignores
  `group.piles`. That is why, grouped, the list is seen as rows, which does draw the piles it
  receives. Request: that the table draw `piles` counted outside.
- ~~**web-ui — a pile does not say «there is more»**~~ (solved with web-ui 1.4: `group.onMore`):
  an open group shows its first page (50) and its real total in the header, but cannot offer
  «load more» inside.
- **here — measure**: sums and averages per group (`measures`) are already answered by the
  server; showing them in the group header is missing.

## UI cases with data: where each one is (2026-10-31)

The map against which what is missing is measured. «Owner» is whoever has to move to close it.

| Case                                           | How it is used                                           | Story      | Status | Owner of what is missing                           |
| ---------------------------------------------- | -------------------------------------------------------- | ---------- | ------ | -------------------------------------------------- |
| List paged by the server's cursor              | `useListing` + `EntityList`                              | 01, 15     | ✅     |                                                    |
| Literal search (the entity's template)         | `search="box"`, `listing.search`                         | 02, 09     | ✅     |                                                    |
| Filter with the bar, builder and named filters | `EntitySearchBar`, `filters`                             | 06         | ✅     |                                                    |
| Sort on the server                             | header → `order`                                         | 20         | ✅     |                                                    |
| Group on the server                            | «Agrupar por», `useGroups`                               | 19, 15     | ✅     | «Ver N más» in a group (web-ui 1.4)                |
| Measure per group (sums)                       | `EntityList sums`, `useGroups` (`sumsOf`)                | 19         | ✅     | backend: how each field is aggregated              |
| Lists with a domain (fixed sub-filter)         | `defineList`, `useListing(list)`, `listView`             | 21         | ✅     |                                                    |
| A list view of your own with the same search   | web-ui `List` + `EntitySearchBar` (level 2)              | 21         | ✅     |                                                    |
| Several faces of the same set                  | `views`                                                  | 15         | ✅     |                                                    |
| Relations inside a record                      | `RelatedList`, `RecordLines`                             | 16         | ✅     |                                                    |
| Choose a record (many2one)                     | `EntityPicker`                                           | 09, 12     | ✅     |                                                    |
| …narrowed by another field                     | `criteria`                                               | 09         | ✅     |                                                    |
| …from a list with a domain                     | `EntityPicker entity={list}`                             | 09         | ✅     |                                                    |
| …searching everything, as a table              | «Buscar en todos» button, `columns`                      | 09         | ✅     |                                                    |
| …with composer's chooser                       | `chooserIn`, `api.pick`                                  | 18         | ✅     |                                                    |
| …with a chooser of your own                    | `useLookup` (literal on the server)                      | 09         | ✅     |                                                    |
| Literal search INSIDE the dropdown             | `EntityPicker` (`Picker onSearch`)                       | 26         | ✅     | web-ui 1.1.0                                       |
| Search in a table: literal first, with Enter   | `EntitySearchBar` (`SearchBar literal`), box             | 26         | ✅     | web-ui 1.1.0                                       |
| Create from the picker («Crear "Globex"…»)     | —                                                        | —          | ❌     | backend + here (web-ui 1.0 already has `onCreate`) |
| Read, edit, preview, hints, 409, drafts        | `useRecord`, `RecordField`                               | 03, 10, 12 | ✅     |                                                    |
| Create with default values                     | `useRecord(entity, "")`, `newRef()`                      | 17, 18     | ✅     | backend #228 (create → identity)                   |
| Duplicate                                      | —                                                        | —          | ❌     | backend (`copy: false`)                            |
| Archive / delete                               | —                                                        | —          | ❌     | backend (convention)                               |
| Previous / next from the record                | `EntityRecord` + the list's trail (`Trail`)              | 29         | ✅     |                                                    |
| Editable lines (one2many)                      | `RecordField name="lines"` (`RecordLinesEditor`)         | 31         | ✅     |                                                    |
| …written in the table or in the dialog         | `addingOf`, `RecordField adding`                         | 31         | ✅     |                                                    |
| …with a many2one in the line (a product)       | `RelationPicker` in the cell                             | 31         | ✅     |                                                    |
| Add to a one2many of its own entity            | «Agregar» of `RelatedList`, `newRef(values)`             | 28         | ✅     |                                                    |
| Commands with a dry run                        | `useCommand`, `CommandButton`                            | 10         | ✅     |                                                    |
| Retry without duplicating                      | `Idempotency-Key`, `retryKeys`                           | 17         | ✅     |                                                    |
| Per-row actions                                | `commands`, `useRowCommands`                             | 23         | ✅     |                                                    |
| Bulk action over «all those that match»        | —                                                        | —          | ❌     | backend + here                                     |
| Export what is filtered                        | —                                                        | —          | ❌     | backend (`data_analysis`) + here                   |
| Page, peek, panel, window, ⌘K                  | `entityView`, `RecordLink`                               | 08, 13, 18 | ✅     |                                                    |
| List and a detail that follows it              | `useFollowed`                                            | 22         | ✅     |                                                    |
| The breadcrumb with the real name              | `useCrumbs` (composer 1.1)                               | 18         | ✅     |                                                    |
| Open in a modal (and «Abrir en…»)              | `openIn`, `RelatedRecord`                                | 25         | ✅     |                                                    |
| A record at each size (card, link)             | `summaryOf`, `cardOf`, `relationOf`                      | 24         | ✅     | web-ui: card without a round face                  |
| The business's time zone                       | `SincproApp` / `FrameworkProvider timeZone`              | 37         | ✅     |                                                    |
| The call's context (company)                   | `processContext`, `screensTransport` (`sincpro-context`) | 43         | ✅     |                                                    |
| Filters saved per person                       | —                                                        | —          | ❌     | backend                                            |

Found in this round:

- **useListing lost what was typed before the definition arrived** (fixed): without a template
  there was nothing to fill in, and nothing asked again. `EntityList` hid it because it does not
  draw the box until it has the meta; a chooser of our own showed it (09 · UnSelectorPropio).
- ~~**web-ui — the bar's suggestions have no role**~~ (solved in web-ui 1.4: `option`): «Nombre
  del cliente · contiene Globex» are `span`s without `option`; a screen reader does not announce
  them and a `play` finds them by text.
- **web-ui — what is coming** (unpublished in 0.2.0): `List readOnly`, «peek/open» as row
  actions, `collapseAfter` and clear-all in the bar, and the narrow measurement before the first
  paint. When published: `EntityList` passes `readOnly` and stops drawing its own openings.
- **composer — modal as a surface** (in progress, notified): when it exists, `EntityPicker`'s
  chooser and a command's confirmation should open with it instead of the `Dialog`.

## Composer 1.4 and web-ui 1.0 (2026-10-31)

Composer moved to `^1.4.0` and web-ui to `^1.0.0`, both published. While web-ui 1.0 was not on
npm we iterated with an `npm pack` of `~/dev/sincpro_web_ui` put in `node_modules` (`yarn link`
would bring a second React); CI, with the peer still at `^0.2.0`, did not compile (`OpenTarget`,
`onOpenIn`). Lesson: the peer goes up in the same commit that uses the new API.

Nothing this package imports from web-ui disappeared (what 1.0 removes — `Drill`,
`CommandPalette`, `LookupDialog`, `ContactCard` — was not used). With both new versions the 128
tests pass; two `play`s changed because the `Picker` changed:

- **web-ui `Picker` always offers «Buscar más…»** when it receives `onBrowseAll` (as an option,
  with how many more there are in its name). The two «ver todos…» gaps above close. The «Buscar en
  todos» button that `EntityPicker` draws beside it (`browse`) becomes redundant: whether it goes
  is still to be decided.

What it brings and is not used here yet: `OpenTarget` («Abrir en…» in `RelationValue`, `Picker`
and `TagsField`), `onCreate` / `onCreateAndEdit`, `List onChoose` / `rowClick` / `readOnly`,
avatars in `Picker`, `TagsField`, rows and cards, `RecordCard`, `RelationCard`, calendar, Gantt,
timeline and pivot. From composer: the modal (`Destination.Modal` with `size`), `api.over`,
`api.pick` that answers any value, `createTestApi`, phone mode and `RecordLink draggable`.

Found while reading them, with their owner:

- **web-ui — `ListView` peeks by default** (`rowClick = "peek"`), against its own guide («tap a
  row → page»). Until it changes, `EntityList` has to pass `rowClick="open"` if it passes
  `onPeek`.
- **composer — its README says a many2one opens in a window**; web-ui's guide («Nuestro estilo»)
  says modal. One of the two has to be aligned.
- **web-ui and composer both export a `RecordLink`**: web-ui's is the name that opens, composer's
  is the one that knows about destinations (`draggable`). Same name, two things.
- **composer still lacks `api.choosing`**: the `pick` parameter of `entity.chooserRef()` stays.
- **web-ui `Picker` does not expose what is typed** while typing (only when asking for «Buscar
  más…»): the literal search inside the dropdown keeps waiting.

## A record, and opening it (2026-10-31)

The base of the record-management components: **what is known about a record** and **where it
opens**, the same for every entity.

- **The summary** (`summaryOf`, in `core/`): name (the meta's `display`), description, state,
  type, image, and who created and changed it. Each part is the field the entity declares
  (`entity(…, { summary: { image: "logo" } })`) or the customary name (`description`,
  `state`/`status`, `type`, `image`/`avatar`/`photo`/`logo`, `created_at`, `created_by`,
  `updated_at`, `updated_by`); with a meta, only fields the meta has. What is missing is `null`
  and is not drawn. `person: true` gives it a round face (photo or initials). `useSummaryOf(entity)`
  gives it with the meta and the application's language; `cardOf` and `relationOf` turn it into
  the props of `RecordCard` and `RelationValue`. Story `24 · Un registro, en cada tamaño`; tests
  in `tests/summary.test.ts`.
- **Opening** (`openIn`, `targetsFor`, `RECORD_SIZE`, in `web/workspace/`): web-ui's `OpenTarget`
  translated to composer once. A related record opens in a **modal** of a record's size (760×560)
  and «Abrir en…» offers preview, side and page; **from inside a modal** (`api.over`), side or
  preview — asking for a modal there opens at the side. `RelatedRecord` is the many2one read:
  summary + `openIn`. Story `25 · Abrir un registro relacionado`; tests in `tests/open.test.ts`
  (`createTestApi`).

Found:

- **web-ui `RecordCard` has no person face**: `media` is always a square (`Thumb`), so a contact's
  card shows the square photo and, without a photo, nothing — the link (`RelationValue
media.person`) does draw the round face or the initials. Request: `media.person` in
  `RecordCard`, as in `RelationCard`.
- **The backend does not publish the summary's parts**: which field is the state, the image or the
  author comes from the convention or from `entity()`. It goes with
  [#230](https://github.com/Sincpro-SRL/sincpro_framework/issues/230) (format in the meta).
- **The state has no tone**: it is drawn neutral. That «Bloqueado» is red is a rule of the
  business: the meta should say it (a tone per value), not a dictionary written here.

- **A list that is asked again** (fixed here): `EntityList` passed web-ui `loading` on every
  question, and web-ui swaps the rows for a skeleton: when typing, the table flickered and a click
  on a row could land on one that was no longer there (CI, slower, showed it in
  `09 · BuscarEnTodosConUnaTabla`). Now the skeleton is only for the first reading. **web-ui**: it
  lacks a «refreshing» state — the rows stay and something discreet says it is asking.

What comes next, on this base: a complete `EntityPicker` (avatar, «Abrir en…», «Buscar más…» as a
composer modal, create), `EntityTags` (a many2many that adds), and a `RecordField` that picks a
relation's control by itself — for that we need to know which entity a relation points to
(`SincproApp entities` until the backend publishes it).

## Searching as expected (2026-10-31)

There were three searches and each did something different: the chooser loaded 50 and **filtered
in the browser** (a customer outside those 50 «did not exist» even when its exact name was typed),
a table's box asked **on every key**, and the bar offered **a single field** first («number
contains Globex») instead of the entity's literal search. Now it is one rule: the text is the
literal search, the server answers it; in the chooser while typing, in the table with Enter. Story
`26 · Buscar como se espera` (all three failed before).

What was needed in **web-ui** (branch `literal_search` in `~/dev/sincpro_web_ui`, with its
tests): `Picker onSearch` (it neither filters nor cuts: the options are the answer), `Picker
valueLabel` (the chosen one's name outside the page), `SearchBar literal` (the «Buscar «X»» chip
with the filter given by whoever uses it, first unless the model reads the question), and a fix:
`decimal`/`monetary` were read as text and «total <= 1000» could not be asked.

Here: `useLookup` opens with 10 and knows the chosen one's name (it remembers it, or asks once by
its key), `EntityPicker` hands what is typed to the server, `EntitySearchBar` gives the literal
with `matching(meta, text)` and the box searches with Enter (`listing.search(text, { now: true })`).

**Published**: web-ui 1.1.0 brings everything above, and this package's peer went to `^1.1.0` in
the same change that uses it (the lesson of 1.0).

**Several records (many2many)** — `EntityTags`, story `27`: the same search for N, on
`TagsField onSearch` (web-ui, same branch). It opens with 10, searches on the server (an email no
chip shows), the chosen ones do not come back as options and are named wherever they are: those
never seen are asked for in **one** question by their key (`in`). A person
(`summary: { person: true }`) is chosen by face, in `EntityPicker` and in `EntityTags`
(`lookupOf` carries the summary's image).

Pending: the «Buscar en todos» button beside the chooser (`browse`) already repeats the dropdown's
«Buscar más…»; it stays on by default until it is decided whether it goes.

## Relations build themselves (2026-10-31)

`<RecordField name="customer_id" />` is already the many2one, without `as`: `relationFieldOf`
reads from the meta which relation is behind a field (the relation itself or its scalar key,
`identified_by`) and which aggregate it points to (`relation: "Cliente"`); `entityFor` resolves it
to the entity the application declared (`SincproApp entities` / `FrameworkProvider entities`), by
the `aggregate` it declares (`entity(…, { aggregate })`), its meta's, or its key. The field is an
`EntityPicker` of that entity (literal search on the server, the ten, «Buscar más…»), and read-only
the name as `RelationValue`. Story `28`; tests in `tests/relation.test.ts`.

Where it opens is said by the view: `RecordOpening` (in `web/record/`, without composer) is filled
by `entityView` with `openIn` and `targetsFor` — a modal by default, at the side from inside a
modal — and «Buscar más…» as `api.pick` of the entity's list (modal; at the side from a modal).
Outside a workspace the form opens nothing.

Found / pending:

- **one2many by name** (done, story `28 · UnOne2manyQueAbreSusFilas`):
  `<RecordField name="invoices" />` is the list of the entity on the other side, filtered to this
  record by the server (`RelatedList`: it searches, sorts and pages — never the page the record
  brought), and a row opens its record where the view says: a modal over the customer; from that
  modal, its customer opens at the side. It is Odoo's one2many without its in-memory row ceiling.
- **many2many by name**: not yet. It is read as a page (`{items, count}`) and writing it needs the
  backend's contract (#229); `EntityTags` works when the value is a list of keys. **Editable
  lines** (`LineItems`): same contract.
- **«Buscar más…» carries what was typed** (done, story `28 · BuscarMasConLoEscrito`):
  `chooserRef(query)` puts it in the reference (`q`), and the list that chooses starts searched —
  the bar with the «Buscar «Glo»» chip, the box with the text. It travels in the reference, so it
  survives a reload like any parameter. `chooserIn` ignores what is not text (an `onClick` passes
  it the event).
- **Local**: the first run of `make test` after adding new imports sometimes fails when importing
  Storybook's setup («Unexpected token»): it is Vite's optimizer rebuilding its cache; the next
  one passes. It did not show up in CI. If it does, `optimizeDeps.include`.

## An application without writing screens (2026-10-31)

`entityView(entity, { transport, name })` no longer asks for screens: without `list`, it is
`EntityList`; without `record`, it is **`EntityRecord`** — the record drawn from the meta
(`formOf`): its name, type and state on top (the summary), the fields in the model's order (a
many2one by its key, as a chooser), each one2many in its tab (the list of the entity on the other
side, or the lines it brought), the authorship at the foot (`Record.Audit`), «Guardar /
Descartar», the conflict, the recovered draft, the server's advice and the history if the entity
declares it. `fields`, `pages` and `actions` choose and add. Story `29` (from the list to the
record, edit, save, the customer in a modal, one of its invoices at the side); tests in
`tests/form.test.ts`.

Found when looking at it (screenshots) and running it:

- **useRecord flickered on save** (fixed): rereading the record set `record: null` and the whole
  screen went through the skeleton — it lost focus, scroll and the click that landed at that
  moment (the full suite showed it: «Abrir en un modal» got lost). Now rereading the SAME record
  keeps it on screen until the answer; a new id does start «loading».
- **A list of words (`text[]`) was a text area** with one per line: now they are chips
  (`TagsField`), and typing a new one adds it.
- **A related list repeated the column that points to the record** containing it («Cliente» in a
  customer's invoices, the same in every row): `RelatedList` leaves it out.
- **The backend publishes search fields as editable** (`customer_name`, the copy of the customer's
  name for searching): the form shows them as text. It should mark them `readonly` (or not publish
  them as form fields); it is not covered up here.

## Previous and next (2026-10-31)

A record opened from a list knows where it is: «50 / 64» and two arrows (`Record.Pager`), which
replace it in place (`api.replace`, no breadcrumb), like Odoo's pager. Odoo keeps in the browser
the ids of the whole search and cuts off at what is loaded; here the list leaves a **trail**
(`Trail`, `core/trail.ts`): the page on screen, the server's cursors around it, and the question.
At the edge of the page, `stepIn` asks for the neighbor with the same question and the same size —
the next one after the last of page 4 000 is one query, as cheap as the first. The trail travels
as the reference's `from` parameter; the row and its name (`RecordLink`) open the same one, so the
peek, the panel and the window have it too. While something is unsaved there are no arrows: first
«guardar / descartar». Story `29 · AnteriorYSiguiente` (crosses the page edge); tests in
`tests/trail.test.ts`.

Limits: the trail lives in memory (a reload loses it: the record opens without arrows), and those
of the last 50 lists are kept.

## How much each group adds up to (2026-10-31)

Grouped, a list says how much each group **adds up to**, not only how many there are: «Pagada · 22
· Total 53.976», summed by the server over all the invoices of the state (`grouping.measures`,
which the backend and the in-memory server already answered). By default what the record
COMPUTES is summed — an exact read-only number (a total, a balance); what the person writes (a
discount, a percentage, a limit) is not, because adding percentages says nothing (`sumsOf`).
`EntityList sums` chooses, `sums={false}` turns it off. web-ui: `Pile.detail`, which `GroupHeader`
already knew how to draw and the list did not pass it. Story `19 · CadaGrupoConSuTotal`; tests in
`tests/measure.test.ts`.

Found:

- **Groups were asked twice** (fixed): without the meta it is not yet known what to sum, so it was
  asked without sums and again when the meta arrived, and the headers were replaced under the
  pointer (`21 · AgrupadaDesdeElPrincipio` caught it in the full suite). Now, without explicit
  `sums`, the groups wait for the meta and ask once.
- **backend**: the meta does not say how a field is aggregated (sum, average, nothing — Odoo's
  `group_operator`). When it publishes it, `sumsOf` reads it and the «exact and read-only» rule is
  retired.
- **A sum that arrives as a number** is written without fixed decimals («53.976»): the meta does
  not say an amount's scale. The real backend sends it as a decimal in text and keeps its digits.

## Typing before the model arrives (2026-11-01)

**useListing ignored what was typed on a slow network** (fixed). The typing pause (200 ms) called
the `refine` of the render it was armed in: if one typed before the meta arrived and the meta
arrived WITHIN the pause, the framework asked correctly («Globex», with the template) and right
after the old timer asked without a filter and cancelled it — the list stayed whole. CI showed it
as an intermittent story (`09 · UnSelectorPropio`: with 250 ms latency it depended on the order of
two timers). Now the timer calls the current `refine`; story `09 · EscribirAntesDeQueLlegueElModelo`
pins it with the meta arriving at 120 ms, and it always failed before the fix.

## web-ui 1.3 (2026-11-03)

The peer went from `^1.1.0` to `^1.3.0`. Nothing this package imports changed its name; with the
new version all the tests pass after two `play` adjustments:

- **The table draws only what is in view from 200 rows** (1.2): `15 · CargarMasTieneTecho` counted
  `<tr>` and saw 33 of 200. Now it reads `aria-rowcount` (what the table has) and also checks that
  of 300 it does not draw 300.
- **The bar keeps its names with chips set** (1.2): `06 · Filtrar` no longer finds the input by
  structure, and checks «Filtrar, agrupar y favoritos, 1 puesto». With a chip the input is
  `textbox` «Buscar»; without chips, `searchbox`: the role changes with the state (web-ui).
- **`09 · BuscarEnTodosConUnaTabla` failed once with the whole suite** (alone, 5 out of 5): it
  checked whether the header was visible as soon as it appeared, and the dialog enters with a
  fade. Now it waits.

What it brings and is not used here yet: `List.Present` (a presentation of your own with the same
set) and the «Operación · sobre N registros» template.

On web-ui's `main`, unpublished: `DataTable onMore` / `ListSet.more` (the table draws the piles
counted outside and offers «Mostrar N más»: it closes the two «Grouping» requests), `createCopy`
(a single text mechanism for web-ui, composer and the app: a candidate to replace
`installFrameworkCopy` and the three tables of `SincproApp`) and `Panes`.

The remount of `Record` without `Record.Actions` was solved by web-ui afterwards (see above). The
«refreshing» state, `media.person` in `RecordCard` and the suggestions with a role came with 1.4
(below).

## web-ui 1.4 (2026-11-03)

The peer went to `^1.4.0`. What is already used:

- **«Actualizando la lista…»** (`state.refreshing`): `EntityList` passes it when it asks again
  with rows (or groups) in hand; the skeleton remains only for the first reading. Story
  `02 · SeVeQueEstaPreguntando` (fails without the change).
- **The bar is a `combobox`** and its suggestions are `option` (before, `textbox`/`searchbox` and
  buttons): a screen reader announces them. Four `play`s (06, 26, 29) looked for the old roles;
  now `combobox` «Buscar» and `option`. The loose box (`search="box"`) is still a `searchbox`.
- **The card has a face** (`RecordCard media.person`): `cardOf` draws a person or company round,
  with initials if there is no photo — like the link (`relationOf`); the two share `mediaOf`. In
  the card the face is `aria-hidden` (the name is written beside it): `24 ·
CadaEntidadDiceLoQueTiene` finds it drawn, not announced.

- **Grouped, the list keeps its face**: the table draws the piles the server counted, so
  `EntityList` no longer falls back to «rows» when grouping. And **«Ver N más» inside a group**
  (`group.onMore`): `useGroups.more(bucket)` reads the group's next page with the server's cursor
  and appends it, up to a ceiling of 500 rows per group (`maxRows`), like the list. `15 ·
AgruparDoscientosMil` opens «Banco» (50 of 50 000), asks for more (100) and checks that it is a
  table; it fails without `onMore` and with the face forced to rows.
- ~~**web-ui gap**: the button says «Ver 49.950 más» and brings 50; at the ceiling it stays~~ —
  solved in web-ui 1.5 (`Pile.more`, see «web-ui 1.5»).
- ~~The 500-per-group ceiling has no test of its own~~ — it has since 1.5 (story 15).

`createCopy` for the framework's text table waits for the context's decision.

## criteria 0.3.1 (2026-11-03)

`@sincpro/criteria` and `@sincpro/criteria-react` went to `^0.3.1`. 0.3.1 fixes in `restSource`
what forge had found (it sends the criteria as plain JSON and respects the route's own query), so
`restTransport.list` no longer builds the URL by hand: it delegates to `restSource` and only
translates its `RestError` into `TransportError`. `one()` and `send()` stay here — criteria does
not have them —. The tests in `tests/rest.test.ts` (own query, plain JSON, rotating headers,
rejection with its problem) pass the same through `list`.

## How a record looks, said once (2026-11-03)

A proposal from forge: define per entity how a record is drawn and use it everywhere. What already
existed and does not change: the **name** is the backend's (`meta.display`, Odoo's `display_name`;
a compound name like «[C-004] Globex» goes as a computed field of the aggregate with
`DEFAULT_DISPLAY` pointing to it), the **search** too (`meta.search`), and the record's **parts**
belong to the summary (`entity(…, { summary })`).

What is new is **how it is drawn**: `presented(entity, { option, row, card })` in
`web/list/presentation.ts`.

- Each size answers the web-ui piece's **props** (`PickerItem`, `RowOf`, `RecordCard`) and they go
  **over** the default (`over`): only what changes is given; without a presentation nothing
  changes.
- `option` → `EntityPicker` (every `PickerItem`: `meta`, `aside`, `tags`, `avatar`, `haystack`…),
  `EntityTags` (name and face: it is what a chip has) and `entityView`'s ⌘K (name and detail: ⌘K
  is text). `row` → `EntityList`'s «rows» face, and therefore also the board's card when there is
  no `card`. `card` → the board, with the list's `onOpen`.
- **Why not `entity(…, { present })`** as proposed: `core/` imports neither React nor web-ui
  (`make doctor`), so it cannot name a `ReactNode` or web-ui's props. `presented()` wraps the
  entity in `web/` and returns the same entity with its presentation: it is passed to everything
  that receives an entity.
- **Why props and not components**: web-ui keeps the keyboard, the highlighting of what is typed,
  the rule of what a click does and each piece's accessibility; an app component in place of an
  option would lose them. It is the same reason as `factsOf` / `columnsOf`.
- `LookupOption` now carries the row (`record`): with it the option is drawn.
- Story `30 · Cómo se ve un registro, dicho una vez` (chooser, rows, board, and without a
  presentation the same as before; the first two fail without `presentationOf`) and a ⌘K test in
  `tests/lookup.test.ts`. It closes forge's gap 13: a row's labels go in `row`.

What has to move in **web-ui** to go further:

- **`Picker` and `TagsField` do not accept a drawing of their own** for the option — web-ui 1.5
  brings `renderOption`; `presented` does not offer it yet: the slots are enough, and an option of
  your own would be added as an `option` that returns a node (pending, no case asks for it).
- ~~**`List.Board card` does not receive the click rule**~~ — web-ui 1.5 `card(item, ways)`:
  `EntityList` uses `ways.press` (open, or choose in a chooser).
- ~~**`TagOption` has no `meta`**~~ — web-ui 1.5: `EntityTags` puts the option's `meta` (or the
  key) under the name in the list, never in the chip. Story 30.

## State and context (2026-11-03)

No new store is needed: each state already has an owner (README, «Where state lives»). What is
global is `FrameworkProvider`; what the backend sees on every request goes in the process's
context (`processContext`, sent as `sincpro-context` — since 2026-11-06; never in the transport's
`headers` too, or a request's own context replaces it); what an opening carries is composer's — `params`, `api.over`,
`pick(…, { question })` + `api.choosing`, `api.context`. An earlier analysis asked composer for
all of this because it had only read `api.context`: it is in `AGENTS.md` as a trap.

What is missing, and is ours:

- ~~**A new record does not take the `params` it was opened with**~~ — done: `entity.newRef(values)`
  carries them (`with`), `useRecord(entity, resource)` starts with them over the meta's `default`s,
  and «Agregar» on a one2many opens the new record with its parent set (story 28).
- ~~**The front does not send `sincpro-context`**~~ — done (2026-11-06): see «The company travels
  on every request». It could be done with `headers`, a story
  that shows it is missing (the active company).
- ~~**Editable lines of an aggregate**~~ — done (see «An aggregate's lines»).
- sincpro_framework#228 (the identity in a create's answer) was closed: it is each use case's DTO;
  forge's (`{project_id}` with identity `id`) is fixed in forge.

## web-ui 1.5 and composer 1.5 (2026-11-03)

The peers went to `^1.5.0`. From web-ui 1.5 we use:

- **«Ver 50 más de 49.950»** (`Pile.more`): `useGroups.brings(bucket)` says how many rows the
  next «more» of a group brings, or `false` at the ceiling (500) or without a next page — then the
  group says «Se muestran 500 de 50.000» and the button goes away. `15 · AgruparDoscientosMil`
  reaches the ceiling (scrolling the table down: from 200 rows the group's foot is drawn only when
  seen); it fails without `brings`.
- **`card(item, ways)`** and **`TagOption.meta`** (above, «How a record looks»).

composer 1.5 brings `api.choosing` and `pick(…, { question })`. Not used yet: `PICK_PARAM` in the
reference still marks the chooser (it survives a reload; `choosing` does not, on purpose).
Switching is a change of behavior that has to be decided.

## An aggregate's lines (2026-11-03)

sincpro_framework's contract (3.28 plus the warnings' `path`, unpublished): the lines travel as
the **complete list, in order**, in the same command as the aggregate and with its version
(without it, the complete list would delete a line that someone else added). A read line carries
its id; a **new one goes without id** — the server rejects one it does not know and puts its own.
An error points to the cell with `#/values/lines/1/qty`; the preview says each cell's state in
`states.lines.items[i]` (`fields` until 3.28.1) and each warning brings `{message, field, path}`
with `path = ["lines", 1, "price"]`.

What was done (story `31 · Las líneas de una factura`, tests `edit` and `lines`):

- **`RecordField name="lines"`** of a one2many without its own entity draws `LineItems` and writes
  the whole list with `edit.set` (dirty, preview, save and discard like any field). Adding,
  removing, undoing and reordering are the screen's: there are no per-line commands on the wire.
- **A new line's key** is kept apart (`core/lines`, a `WeakMap` over the line), passes to each
  edited copy and is reconciled **by position** with what the preview answers.
- **Only a whole list is edited**: a record that brought a page of its lines (20 of 120) draws
  them read-only (`RecordLines`), because writing it whole would delete those it did not bring.
- **Errors**: `errorsByField` did not recognize the `#` (everything fell under the key `"#"`) and
  cut at the first segment (a cell's error fell on `lines`). Now `pathOf` reads `#/…`, `/…` and
  paths, removes `values/` and keeps the whole path (`lines/1/qty`); `errorAt` finds a field's
  error or one from inside it. A line's error or warning is said ON the line (`flag`).
- **Per-line states**: `states.lines.items[i]` (`fields` until 3.28.1) is no longer lost:
  `edit.cell(name, i, field)` is the line model's hint refined by the server; the line's dialog
  respects it.
- **A `LineItems` callback runs late** («Deshacer» in a toast, seconds later): it starts from the
  list of NOW, not of the render that created it. A play found it (it added one line too many).

Found against the real backend (it was wrong and the stories did not see it, because the fake
server used the same names):

- **Warnings** carry `message`, not `text`: the front drew empty notices. Fixed (`Advice` is
  `{message, field, path}`, in `core`).
- **Saving the draft** sent `{values, expected}`; the framework's `Edit` is `{id, values (the whole
record), changed, version, origin_version, action}` and answers `ResponseEdit` with `draft:
{version, origin_version, kept_at, stale}`. The body and the reading of the answer were fixed;
  `12 · UnBorradorEnElServidor` saves twice (the second fails if the version does not travel).
- **Reading a record with a draft**: the framework answers the record ALREADY with the draft
  applied and `draft` without `values`; the front did `setTyped(draft.values)` (undefined) and
  broke. Now it tolerates it and marks it «restaurado». **Open**: saving that draft is `Edit` with
  `action: "save"`, and `useRecord.save` uses the `save` route with what changed (nothing, in that
  case). It has to be decided whether an entity with drafts saves through `Edit`.
- ~~**sincpro_framework's working tree renames the preview's answer**~~ — published in 3.28.2 (see
  below); the front already reads the new names.

Measured with 2 000 lines (Node, a temporary test over `core`):

| What                                         | Cost                                                                 |
| -------------------------------------------- | -------------------------------------------------------------------- |
| `changesOf` on every key, with touched lines | 0,34 ms                                                              |
| Preview request / answer                     | 172 KB / 178 KB per 300 ms pause                                     |
| Reconcile keys by position                   | 0,02 ms                                                              |
| `flag` of each line                          | 50 ms → **0,39 ms** (one `findIndex` per line; now a map per render) |

The real cost is the wire: each preview sends and receives the whole list. It is the contract
(complete list); if it weighs, what changes is the backend's contract, not commands invented here.

## sincpro_framework 3.28.2 and web-ui 1.6 (2026-11-03)

**sincpro_framework 3.28.2** publishes the forms vocabulary: `PreviewEntity`,
`ResponsePreviewEntity`, `warn_form`, `apply_values`, `read_only`. On the wire, what a preview and
an `Edit` answer changes: `fields → states` and `advice → warnings` (each `{message, field,
path}`); the request (`{values, changed, id}`, and the `Edit`) does not change, and the error
still goes in `#/values/lines/3/quantity`. Against 3.28.2 the front silently lost the per-line
states and the warnings: now it reads `states` / `warnings` (`useRecord`), and the fake server
answers the same. `31 · Las líneas de una factura` fails with the old names.

**web-ui 1.6** brings `cellState(line, column)` in `LineItems` (read-only, required, hidden, error
and warning per CELL) and `rowState`, and a row window from 200 in `EditableTable` (2 000 lines:
273 → 36 ms per key, measured by web-ui). `RecordLinesEditor` uses it:

- The error that points to a cell (`#/values/lines/3/quantity`) is drawn **under that value** and
  reaches its control as `aria-invalid`; before it was a notice over the whole line.
- A value's warning (`path: ["lines", 0, "price"]`) goes in that cell.
- The line's notice (`flag`) is left for what points to the line and to no drawn cell (an `id` the
  server does not know).
- Each cell respects `states.lines.items[i]` (the price fixed by volume, read-only).

~~Next: editing in the cell~~ (done, see «Where a line is written»): a cell control is named with
`aria-label` (`FieldControl.standalone`), and only there.

## UI review: the queue (2026-11-04)

Reviewed against the code, the stories, web-ui 1.6 and composer 1.5, with Storybook screenshots
(story 28's modal, 29's panel and modal, 12's form, 18's windows).

**1. Opening a record anywhere.** Today:

| From                                       | What it offers                                                                                                | Missing                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Table row                                  | click → page; the name is composer's `RecordLink`: peek, side and window **only as icons on hover** (and ⇧/⌘) | modal; a visible «Abrir en…» usable by keyboard |
| «Rows» row and board card                  | click → page                                                                                                  | everything else                                 |
| many2one (`RelationValue`, `EntityPicker`) | modal by default and «Abrir en…» with all the destinations                                                    | —                                               |
| one2many (`RelatedList`)                   | click → the first of `opening.targets` (modal)                                                                | the other destinations                          |
| ⌘K                                         | page (composer's palette)                                                                                     | it is composer's: request                       |

web-ui already has what is needed: `List onPeek` + `rowClick="open"` (1.5+: the click opens the
page and 👁 peeks, without turning the row into a peek — the `AGENTS.md` trap about `onPeek` went
stale), `rowActions` / `RowOf.actions` for the rest, and its own words (`openIn`: «Abrir en un
modal», «Vista previa», «Abrir al costado», «Abrir en una ventana», «Abrir en…»).

**2. How it looks.**

- **The form** of `EntityRecord` puts all the fields in a one-column `div` of its own: on a wide
  page it is a narrow column and half a sheet empty (screenshots 11, 18). web-ui says it with
  `FormSection columns={2}` inside `Record.Paper` (its «Operación» template): two columns when
  wide, one when compact.
- **The empty rail**: `Record.Actions` was always there (because of a web-ui bug already solved),
  so a record without breadcrumbs, without pager and without actions draws an empty band under the
  modal's or panel's title (screenshot 29).
- **A table in a modal or a panel** splits each number into three lines («F- / 2026- / 0060») and
  each date into three (screenshot 29; and also on the page, screenshot 28). A list that is a
  field of a record opened in a modal or a panel should start as «rows».
- **The record in a modal** repeats the title (the modal's and the record's): it is web-ui's
  `Record`; it is noted, no other is drawn.

**3. More views.** `EntityList views` admits `table | rows | board`. web-ui also draws `sheet`
(spreadsheet, virtualized, coming from the table's columns), `report`, `pivot`, `calendar`,
`gantt` and `timeline`. The sheet comes for free; calendar and pivot need to ask the SERVER (a
date range, two grouped levels): grouping or filtering the page would be wrong (`AGENTS.md`).

**4. Sorting by several fields.** `useListing.order` is ONE `Sort`. web-ui's builder already
builds `order: [...]` and `EntitySearchBar` **drops** it. The table sorts by a header; the faces
without headers (`rows`, `board`) do not offer sorting (`List sortable`).

**5. The bar with a builder in every list of records.** `RelatedList` (one2many) and
`EntityPicker`'s chooser use `search="box"` (a text box): no filters or builder.

Order of work: 1 → 2 → 4 → 5 → 3 (sheet; calendar and server pivot at the end).

### Done (2026-11-04)

- **1. Opening** — `EntityList openTargets` (by default `targetsFor(api)`: modal, peek, side,
  page, window; from a modal, everything but modal) and `onOpenIn`. Pressing opens the page; web-ui's
  👁 (`onPeek` + `rowClick="open"`) peeks; **«Abrir en…»** (`OpenInMenu`, web-ui's `Menu` with its
  `openIn` words) goes visible beside the name in the table and on each row. The one2many gets the
  same through `RecordOpening`. The window was added to a related record's destinations. Story
  `32 · Abrir un registro donde haga falta` (fails without the menu).
- **2. How it looks** — the record uses web-ui's `FormSection`: two columns on a page and in a
  modal, one in a panel, window and peek (`api.surface`); the rail only if it carries something. A
  list inside a record that is not on a page starts as «rows» (`RecordOpening.narrow`). A code, a
  date or an amount is not split (`columnsOf`: `whitespace-nowrap`). Story `33 · Un registro se ve
bien donde se abra`, which measures geometry (a text's lines with a `Range`; a box gives a single
  rectangle even if it has three lines — the first version of the play did not fail without the
  change).
- **4. Sorting by several fields** — `listing.order` is a list; the builder reads and writes it,
  and it travels whole to the server; the table and the sort menu of the faces without headers
  (`sortable`) show and set the first. Found along the way: two changes in the same gesture (the
  builder applies filter AND order) overwrote each other — the second started from the render's
  state; now it starts from the last. `20 · PorVariosCampos` fails without each one.
- **5. The bar in every list of records** — the one2many and the «Buscar más…» chooser use the bar
  with filters and builder; the box is left for whoever asks for it (`search="box"`). Stories 09
  and 16.
- **3. More views** — `views` admits `sheet` (web-ui's spreadsheet with the table's columns); a
  list on screen that says nothing offers table, rows, board and sheet. Story `34 · Un conjunto,
varias formas de mirarlo`.

### Requests that come out of this

- **composer** — ⌘K always opens the page: let it accept «Abrir en…» or `RecordLink`'s modifiers
  (⇧ side, ⌘ window).
- **web-ui `FormSection`** does not narrow by its container: two columns in a 420 px panel crush
  the controls. Today the framework chooses 1 or 2 per surface; a container query would be better.
- **web-ui `DataColumn`** — a `nowrap` option (or that `mono` not split): today the framework
  wraps the cell in a `span`.
- ~~**web-ui order**~~ (solved with web-ui 1.7, see «web-ui 1.7») — `SortState` was ONE: the table
  could not show «Estado ↑, Total ↓» nor ⇧-click to add a field.
- **web-ui `CriteriaBuilder`** — the order chips and the «ordenar por…» list show the technical
  name (`amount_total`), not the model's label.
- **web-ui `SearchBar`** — with Enter it takes the first suggestion, which may be «Estado es
  0060» (a value the enum does not have) instead of the literal search.
- **web-ui `Record` in a modal** repeats the title: the modal's and the record's.
- **web-ui `List.Calendar`** does not say which range it shows (`onRangeChange`): without that the
  calendar can only draw the page (it would lie about the month) or bring everything (forbidden).
  With that, the framework asks the server for `date between start and end`.
- ~~**Pivot**~~ — done: `EntityList pivot={{ rows, columns, measures? }}` offers the `pivot` face;
  `usePivot` asks the server twice (by the two fields, and by the columns alone for their totals),
  never brings rows and only asks while it is the face being looked at; `pivotOf` folds it into
  web-ui's `Pivot` (`folded`) with the model's words («Pagada», «Efectivo»). Story `35 · Cruzar un
conjunto por dos campos` (fails if it does not ask). The grand total is not drawn: nobody
  answered it and cells are not added up.

## The company's time (2026-11-04)

A `datetime` is an **instant**: the server sends and receives it in UTC (`2026-03-12T14:30:00Z`).
A person reads and writes it in the time of the **business's place**, and that place is defined by
whoever is above the screens —the application or the company being worked with—: `SincproApp
timeZone` / `FrameworkProvider timeZone` (`"America/La_Paz"`). Without that, the browser's. It is
installed once, like the framework's words (`installTimeZone`), and installed again before drawing
if it changes (another company).

- **Reading**: `textOf` formats a `datetime` with that zone (the formatter is kept per zone).
- **Writing**: `controlFor` draws web-ui's `DateTimePicker` —which asks for the wall-clock time,
  `"YYYY-MM-DDTHH:MM"`— and what travels is again the instant. The conversions are pure and tested
  in Node (`wallTimeOf`, `instantOf`, `tests/zone.test.ts`): the offset is THAT day's (daylight
  saving time on each side of the change).
- **A `date`** is a calendar day, not an instant: it never moves.
- A date with time now **fits in a cell** on one line.

Story `37 · La hora de la empresa`: the same appointment reads 10:30 a. m. in La Paz and 3:30 p. m.
in Madrid; written an hour later in La Paz, it travels `15:30Z` (both fail if the control ignores
the zone).

## Your way: every level is replaced (2026-11-04)

What the model draws is a default. Until here, a record and a list could be redone piece by piece
(`RecordField as`, `EntityList cells`, `rowActions`, `presented`), but **the lines could not**:
their columns, cells, controls and dialog were fixed. Now each level has its entry point, and what
is not passed remains the model's:

| Level                                      | How it is replaced                                                               | Story  |
| ------------------------------------------ | -------------------------------------------------------------------------------- | ------ |
| A field                                    | `RecordField as` (your own widget)                                               | 12     |
| The lines' columns                         | `RecordField lines={{ columns }}` (the dialog still has all the fields)          | 36     |
| A line's cell                              | `lines.cells[field]`                                                             | 36     |
| The control of a line's field              | `lines.controls[field]` — in the cell and in the dialog; receives the whole line | 36     |
| Columns that are not fields                | `lines.extra` — a line's delivery, with a button that opens a modal              | 36     |
| The line's dialog                          | `lines.editor`                                                                   | —      |
| The cell of a list of records              | `EntityList cells`                                                               | 17, 18 |
| A whole face of the list                   | `EntityList faces` (web-ui's `List.Present`: the same set as the others)         | 36     |
| The related list inside a record           | `RecordField list={{ … }}` (everything `EntityList` takes)                       | 36     |
| The lines, without `RecordField`           | `RecordLinesEditor look={…}` (exported)                                          | —      |
| Opening something from a piece of your own | `useRecordOpening()` (exported): peek, modal, side, window                       | —      |

The rule of where a line is written is not broken: a field with its own control **fits** in the
cell, and a **required** field that the screen left out of the columns sends the line to the
dialog (`addingOf`, with `shown` and `own`; tests in `tests/lines.test.ts`). `adding` became
`lines.adding`. Each play of story 36 fails without its piece (tested: controls ignored, faces
undrawn, `list` not passed).

### Request to web-ui that comes out of this

- **`LineItems` / `EditableTable` — a row with its detail**: «invoice line → its picking, its
  billing» as an expandable sub-row (`rowDetail(line)`) and a per-line actions menu (`rowActions`,
  like `List`). Today it is built with `lines.extra` (a button that opens a modal or a peek); the
  detail under the row has nowhere to go.

## web-ui 1.7 (2026-11-04)

**Sorting by several fields, in the table too.** `sort` is `SortState[]` and `onSortChange`
receives the list (1.7 breaking change). `EntityList` passes it `listing.order` whole and writes
what comes back, whole: ⇧-click on a header adds a field, the sort menu reorders them, and it is
the same list the builder builds. Story `20 · VariosDesdeLosEncabezados` (fails if it keeps a
single field). criteria stays at 0.3.1 (it already was the version).

**1.7.1 and 1.7.2** (this round's requests): tables cut off the `Field` context, a column with
`text` draws the text, a control inside a `Field` is named by the `Field` (its `aria-label` is
ignored: `09 · DesdeUnaListaConDominio` looked for it by an `aria-label` inside a `Field` and was
adjusted), and Esc in the bar's panel closes only the panel.

**Controls with format** (password, card, email, phone, web, duration, mask, code, color;
`NumberInput format/units/rounding`; `Numeric format/signed`). The framework does not choose them
by itself: sincpro_framework's meta publishes `text`, `number`, `date`… and none says «this is an
email» or «this is money in Bs». Until the backend says it (a field `format`: `email`, `phone`,
`url`, `duration`, `monetary` with its currency), a screen sets them with `RecordField as`.
Request to the backend; nothing is guessed here from the field's name.

## Where a line is written, and adding to a one2many (2026-11-04)

**A line is written where it is.** It used to be a button on top that opened a dialog. Now it is a
single decision (`addingOf`, in `core/lines`, tested in Node): in the **table** —«Agregar una
línea» is its last row, a row is written in place, the pencil opens the whole line in its
dialog— as long as every field that is written fits in a cell; in the **dialog** if any does not
fit or if the screen asks for it (`RecordField adding="editor"`). A row that cannot be finished
where it was opened is a trap, so «inline» is never forced. What fits in a cell: text, number,
date, date with time (since «The company's time»), yes/no, options, list of words and a
**many2one of a declared entity** (the picker in the cell). What does not fit: an `embedded`
value, a many2one of an entity the application did not declare (it would be an id nobody types).
What is read-only does not count. In a narrow box web-ui draws cards that open the dialog.

- The columns are the line's **scalars**, like a form (`lineFields`): a many2one is its key
  (`product_code`), **named by its relation** («Cemento 50 kg», not «CEM-50»). Choosing a product
  leaves the chosen record beside the key (`EntityPicker onChange(id, chosen)`): the cell names it
  without asking again.
- A cell draws the model's text (`cell`): before, `LineItems` drew the raw value («1552.00»,
  «CEM-50») — only the search read `text`.
- **Fixed along the way**: the line's editor drew a many2one with `controlFor` (a `TextInput` with
  the key by hand). Now it is the same `RelationPicker` as the form.
- Inside a line —cell or dialog— «Buscar más…» is the picker's own chooser, never the
  workspace's: it opens outside the row (the row is confirmed on losing focus) or it would be a
  modal over the dialog.

**Adding to a one2many of its own entity.** `RelatedList` had no way: `embedded` turns off the
«Nuevo». Now it offers «Agregar», which opens the form of a new record **that already points to
this one** (`entity.newRef({ customer_id })`) where the view says (`RecordOpening.create`: in a
workspace, `api.pick` as a modal —at the side from a modal—); once created, it **answers**
(`api.answer` in `useRecordInWorkspace`, instead of `api.replace`) and the list is read again.
Never a table row: each child is an aggregate with its create, its rules and its preview. Without
a record yet there is nothing to point to: no button. Outside a workspace, neither
(`web/record/` does not import composer).

- What starts a new record travels in the reference as JSON in a param (`with`): a number stays a
  number, and it survives a reload and a link. `startingValuesOf` reads it; a hand-written `with`
  that is not an object is ignored, it does not break. `useRecord(entity, resource)` accepts the
  reference and starts with those values over the defaults. **A record view of your own has to
  pass `resource`** (not `resource.id`) to receive them.

Stories: `31 · AgregarEnLaTabla`, `UnProductoEnLaCelda`, `SinSuEntidadSeAgregaEnElDialogo`,
`AgregarEnElDialogoCambiarYGuardar`; `28 · AgregarUnaFacturaAlCliente`, `SinRegistroNoSeAgrega`.
Tested that they fail: with `addingOf` always on «inline», `SinSuEntidad…` fails; with the create
that never answers, `AgregarUnaFacturaAlCliente`.

Found:

- **A block inside a web-ui `Field` lends its id to every control.** `RecordField` wrapped the
  lines and the related list in `<Field>`: each cell control (and the list's bar) took the same
  `id` and the relation's name (`useFieldIds`). A one2many goes in `FormSection title`. web-ui
  could isolate it in `EditableTable` (see requests).
- **`aria-label` inside a `Field` doubles the name**: React Aria adds both sources («Precio
  Precio»). The control is named by itself only where nothing names it (`FieldControl.standalone`,
  `RelationPicker standalone`).
- **A relation resolves to its entity by `aggregate`** (declared in `entity()`) or by the meta
  already read. Without either, a line's product is not «declared» and the line goes to the dialog
  until the meta arrives. `productos` declares `aggregate: "Producto"`.

- **«Agrupar por» in the «Buscar más…» chooser** was there (the whole bar) but nothing tested it:
  `09 · AgruparEnElSelector` groups by city, opens a group and chooses from there (fails if the
  bar does not receive the groups).
- ~~**A date with time is edited as text**~~ (solved, see «The company's time»).

### Requests to web-ui that come out of this

- ~~**Escape in the bar's panel (filters, group) inside a `Dialog` closes the `Dialog`**~~
  (solved in web-ui 1.7.2): `09 · AgruparEnElSelector` closes the panel with Esc and checks that
  the chooser stays (fails with 1.7.1).

- ~~**`EditableTable` / `LineItems`**~~ (web-ui 1.7.1: `FieldBoundary`) — isolate the `Field`
  context for the cells.
- ~~**`LineItems`**~~ (1.7.1) — a column with `text` and no `cell` drew the raw `value`.
- ~~**Controls inside a `Field` with `aria-label`**~~ (1.7.1: `controlName`) — the name came out
  doubled.

## web-ui 1.8 and 1.9 (2026-11-04)

- **`Record placement`** — `EntityRecord` says where it is mounted: `card` in a modal (it is
  already a card), `page` on the page and the panels; the peek is compact and never carries a
  sheet. Before, web-ui guessed it from the rail (breadcrumbs, pager, actions), and the rail
  changes with the record on screen: the pager goes away when typing starts, the actions arrive
  after loading. The sheet appeared or went away, everything inside was remounted and the field
  lost focus. Composer has no «window» surface of its own (`page | panel | peek | modal`), so
  there is no separate case for it.
- **Heavy faces are loaded on use** (calendar, gantt, the builders' JSON editor). The framework
  does not import them directly. Measured with `make storybook` (minified, no gzip): a list's
  chunks, `List` + `EntityList`, went from 1 130 + 551 KB with 1.7.2 to 385 + 129 KB;
  `RecordCalendar` (299 KB), `RecordGantt` (271 KB) and `JsonEditor` (422 KB) stay apart and are
  downloaded only when shown.
- **The dark rail** with only the stage no longer changes with the first letter: it arrives by
  itself.
- **1.9: `Record.Audit`** speaks like the form (a label and its value, the person as `UserChip`).
  The author is optional: `EntityRecord` passes it only when the record says it, instead of the
  «—» that 1.8 asked for. The date goes the way the framework writes it in the rest of the
  record's facts.

## The forge console's gaps, closed (2026-11-04)

Those in the «The forge console migrated» table that were this package's, with their story:
`38 · Lo que forge todavía hacía a mano` (choosing «ninguno», not offering those already shared, a
Command with two keys and a disabled button), `11 · ConLaBarraDeLaAplicacion` and the tests
`cache`, `entity`, `view` and `edit`.

- **Two keys in the route** — `pathFor(route, id, body)`: `{id}` is the record's key and any other
  `{name}` is the body field with that name. sincpro_framework reads a route parameter as a DTO
  field (`{...body, ...path_params}`), so the body already names it. A missing key is a screen
  error, said before sending anything. It also holds for a nested create (`POST
/tenants/{tenant_id}/projects`).
- **«Ninguno» and `exclude`** — web-ui's `Picker` does not know how to empty a choice, so
  «ninguno» is the first option while nothing is typed. `exclude` is applied by the server; it
  needs the meta's key field, so without a known meta the first page arrives without excluding and
  the reading starts again when it arrives (the first attempt read the meta from the store in the
  same render in which it was saved and never asked again: the story caught it).
- **The cache** — it forgot by text prefix: `/facturas` deleted `/facturas-events`. Now by whole
  route or below, and each segment of the written route is a forgotten collection.
- **⌘K with scope and lazy views** — `entityView` accepts `search: { params }` and `load`. The
  promise of `load` is kept: the second opening is the same component (otherwise it would
  remount); if the chunk did not arrive, it is asked again.

- **Saving by speaking `Edit`** — `entity(…, { edit: "PUT /facturas/{id}/edit" })`: the route of
  sincpro_framework's `Edit` (`EntityEdits`) serves all three things, according to its `action`.
  `keep()` sends `save_draft`; `save()` sends `save`, with the whole record as the form has it, the
  changed fields, the draft version read and the saved version it started from; `discard()` sends
  `discard`, which also deletes the server's draft (before it was only forgotten here and came back
  with the next read). Without `edit`, saving still sends the changed fields with the version to
  `save`. The stories' server speaks the three actions (`12 · GuardarHablandoEdit`,
  `DescartarBorraElBorradorDelServidor`).
- **A key written on create** (a tenant's slug) — it already traveled: `creationOf` discards only
  the meta's FIXED `readonly`, so the backend publishes it with `readonly_when` (read-only when
  the record already exists), not with `readonly`. Deciding it with the form's state
  (`readonly_when` over the new record) was tried and reverted: a currency chosen and then locked
  by the lines stopped traveling on create. The test pins it with the two cases.

### Still open, with owner

- **Live data** (`useLive`: subscribe to an entity's facts and read again) — the contract is
  missing: sincpro_framework
  [#201](https://github.com/Sincpro-SRL/sincpro_framework/issues/201) (events over SSE) is still
  open. The client side already has where to plug it in: `cachedTransport.invalidate` and each
  reading's `reload()`.
- **A «reference to another entity» field** that draws the person or the link by itself — waits
  for the meta of [#230](https://github.com/Sincpro-SRL/sincpro_framework/issues/230) (open).
  Today it is declared by hand with `summary: { person: true }`.
- ~~**web-ui `Picker`** — no way to empty a choice; «ninguno» stands in as an option.~~ Done
  (2026-11-06): web-ui 2.1's `Picker onClear` — a × beside the name, or the name erased and the
  field left. `EntityPicker onClear`, and a record's many2one that is not required can be emptied
  (story `41 · UnaClaveOpcionalSeQuita`); `none` stays for an empty choice with a word of its own.
- **Per-row actions in an aggregate's lines** (`RecordLines`) — they do not go: the lines travel
  whole with their record and have no Commands of their own (adding, removing, undoing and
  reordering are the screen's). A one2many that is ANOTHER entity (`RelatedList`) already has
  them: it is an `EntityList` and accepts `commands` / `rowActions`. A screen action on a line
  would need web-ui's `LineItems` to draw it.
- Gaps 4 and 5 (forge), 15 (composer) and 16 (web-ui) were not touched.

## Everything opens in the workspace, and the front generates the id (2026-11-04)

Found when reviewing the modals: inside an application with composer, a hand-written
`EntityPicker` (the forge console's, `group_views` and `user_views`) opened web-ui's fixed
`Dialog` on «Buscar más…» and had no «Abrir en…»: only `RecordField` read how to open from the
view. And a new record of an entity with `edit` could not save a draft or be created through
`Edit`, although sincpro_framework contemplates it. Stories `39 · Todo se abre en el workspace`
and `17 · NaceConElIdQueGeneraElFront`; tests `ids` and `entity`.

- **The pickers read the workspace by themselves** — `EntityPicker` and `EntityTags` use the
  view's opening (`RecordOpening`, the one `entityView` gives) when the screen does not pass
  `onOpen` / `onBrowseAll`: the chosen one opens where the workspace puts it and «Buscar más…» is
  `api.pick` of the entity's list. What the screen passes still wins. `chooserIn` is left for
  whoever wires it by hand. The own chooser is left for a picker outside a workspace and for a
  line: the lines editor gives an opening **without** `choose` (also to the screen's own controls)
  and `ownChooser` asks for it anywhere else.
- **The chooser carries the picker's cut** — before, even when opened in the workspace, it offered
  the WHOLE entity: neither the `criteria`, nor the `exclude`, nor the scope of the named list.
  Now it travels in the reference (`chooserRef(query, scope)`, param `scope`: it survives a reload
  and a link) and the entity's view gives it to its list (`ListScopeProvider`), which `useListing`
  adds as one more scope — also to the list the application writes. Read from a URL it is untyped
  text: it is read with criteria's `readExpression` and one that cannot be read is not a cut. What
  does not travel from a named list is its columns and its title.
- **UUID v7 from the front** — sincpro_framework creates a new record under the `id` the client
  names («a UUID v7 it mints»); the draft and the saved record share it. `useRecord` generates
  that id (`newEntityId`, 32 hex, the same format and order as `new_entity_id`) once per new
  record, when the entity declares `edit` and its key is `id`: `keep()` saves the draft of a
  record that does not exist yet, `save()` saves it through the same `Edit` route and the hook
  becomes that record. A retry names the same record, never a second one. A new record's `values`
  do not carry what the framework writes (`id`, stamps), which `Edit` rejects. **Without `edit`
  no id is sent**: a `create` DTO is the application's and might not have it (no contract is
  invented); nor when the key is another field (an invoice's number, which the server sets). A new
  line still travels without id.

### Still open, with owner

- **Modal or window to open a related record** — composer's modal moves by its title but is not
  resized; the window is. Composer's README says a many2one opens in a window and web-ui's guide
  says modal (noted in «Composer 1.4 and web-ui 1.0»). Today the first of `targetsFor` is still
  the modal; deciding it belongs to the two guides, not to us.
- **sincpro_framework — `PreviewEntity.id`** is «the saved record being edited; `None` for a new
  one»: a new record with a saved draft is previewed with `id: null`.

## Typed commands and the core without React (2026-11-05)

Phase A of [`prd/PRD_01_generated-domain-and-client.md`](prd/PRD_01_generated-domain-and-client.md):
what does not wait for the backend's contract. Tests `command` (the compiler finds the errors:
each `@ts-expect-error` fails the build if the type stops catching it) and `index`.

- **`entity<T, C>`** — `C` (`CommandBodies`) says what each Command is sent with, by name.
  `useCommand(issues, "send").run(id, { mesage })` and `<CommandButton command="sned" …>` do not
  compile, and neither does a typed Command without a route (`EntityRoutes<C>` requires it). By
  default `C` is the loose shape as always, and a typed entity still works where `Entity<T>` is
  asked for: nothing that existed changes.
- **Writing the type arguments leaves the loose shape.** TypeScript does not infer a part: with
  `useCommand<Issue, Respuesta>(…)` (what forge does) `C` and the name go back to the default. For
  it to check, no argument is written. The answer typed from the contract (`output`) is left for
  when the generator arrives: a third parameter of `Entity`, without breaking `C`.
- **`useRowCommands` is not typed**: `Listing<T>` does not carry `C`. It stays with loose names.
- **`@sincpro/web-framework/core`** — the core's subpath: a script or a Node test imports it (and
  the client to be generated) without loading React. Checked: after `make build`,
  `import("@sincpro/web-framework/core")` from Node gives `restTransport`, and `dist/core` imports
  neither React nor web-ui.

## Generated from the contract: DTOs, client and entities (2026-11-05)

Phase B of [`prd/PRD_01_generated-domain-and-client.md`](prd/PRD_01_generated-domain-and-client.md).
`sincpro-web generate <contract.json> --out <folder> [--domain <name>] [--base <path>]` reads the
contract exported by sincpro_framework 3.32 (`export-client-contract`, #243) and writes
`domain.ts` (the DTOs, types only), `client.ts` (each operation as data and
`clientOf(transport)`), `entities.ts` (an `entity<T, C>()` per model that is listed) and
`contract.json` (the snapshot, for `metasOf`). Tested against forge's REAL contracts
(`stories/support/forge-contract/`: `project`, `auth`, `sandbox`): 3 345 lines in total (counted
with `wc -l`), which compile against today's API and are compared byte by byte (test `codegen`,
`make codegen-fixtures`). Story `40 · Desde el contrato` builds a screen from the generated code
alone: the list and «Enviar» without a hand-written route.

- **A record brings all its fields except its relations.** The contract of a forge model marks no
  field as required (all have defaults), but the server writes the whole record; only a relation
  (`one2many`, `many2one`, `many2many`) arrives when the read expands it. A read with a field mask
  brings less: the type says what a default read brings.
- **Each route comes from what the operation IS for its entity** (`role`), never from its path:
  the list is its `search`, the record its `get`, `edit` and `preview` theirs. With two of the same
  role and none `own`, the generator does not choose and says so in the file (forge: none today).
- **A command carries its record where its body names it** (`target`, `bodyFor`): the id goes in
  that field and `pathFor` takes it from there, whether it is in the route
  (`/issues/{issue_id}/messages`) or not (`POST /issues` with `project_id`). forge's `revokeShare`,
  written by hand, comes out on its own: `unshareProject` with `target: "project_id"` and
  `tenant_id` in the body.
- **criteria is imported, not written**; only the definitions that something reaches are written;
  two things with the same name in TypeScript are rejected, naming both.
- **`--base` strips the version** (`/v1`) that the export puts on each route and the transport
  already prepends; a route outside that base is rejected. **`--domain`** gives the entities' short
  key (`project:issue`): the contract's `context` is the bus's name (`sincpro-forge-project`) and
  the key is the workspace's business, so it is resolved here.
- **`tsc-alias` rewrote the texts the generator emits** (`from "@sincpro/web-framework"` came out
  `from "../index.js"` in the generated code): module names are built in parts.

### What the contract or the transport still do not allow

- **A GET that is neither a page nor a record** (`GET /me` in `auth`, two in `sandbox`) has no
  method: the `Transport` reads a GET only as `list` or `one`. A Query read in the port is needed
  before generating a method for it.
- **A command that creates with a chosen key** (`CommandRegisterProject`, with `project_id` a
  slug) comes out with `target: "project_id"` like one that runs on a record: `targets` does not
  distinguish «create with this key» from «run on this record». It works (`run(newSlug, body)`),
  but reads oddly; it disappears when forge creates through `Edit` (its iteration 6).
- **An entity's history** is not deduced: forge's is a `search` of `ProjectEvent`, not the
  `events` role. `history` is still declared by the screen.
- **The old-snapshot notice** (`onVersionDrift`) waits for a design: a `Meta` does not carry its
  version (`versionOf` reads it from the contract) and the library does not write to the console.

### With sincpro_framework #244

The contract is named by `bounded_context` (the prefix of each identity) and `alias` (the name
under which the gateway publishes it: `project`), and each value a record stores inside is one
more model, with a name (`Issue.project_snapshot` → `ProjectSnapshot`). The generator reads both
(and `context`, from a 3.32 contract): the entities' short key comes from the `alias`, without
`--domain`; only a model with `identity` is an entity (`entities.ts`, `metasOf`), and a value is a
named type. A list of keys as a target (`issue_ids`) carries no `target`: the body sends it whole.
**A value by `$ref` needs `@sincpro/criteria` 1.1**, which resolves it (`shapeOf` with `shapes`):
with 1.0.0 a screen loses a value's definition. This package asks for `^1.1.0`, and two tests pin
it: the transport reading an OpenAPI with a pointed value (`rest`) and `metasOf` over forge's
contract (`contract`) — both failed with 1.0.0.

### Requests to sincpro_framework that come out of this

- **`own`** (two operations of the same role), proposed in PRD_33 and awaiting approval.

## What was missing before the refactor (2026-11-05)

What the ROADMAP noted as «what the contract or the transport still do not allow», done, plus the
guide to adopt it: [`ADOPTION.md`](ADOPTION.md). Story `41 · Una clave que dice de quién es`;
tests `codegen`, `command`, `entity`, `rest`, `relation`, `contract`.

- **A command's answer, typed in the entity** (`Entity<T, C, A>`, `CommandAnswers`):
  `useCommand(issues, "sendIssue").run(…)` returns `CommandSendIssueAnswer` without type arguments
  (`AnswerOf`); the generator writes `A` from each `…Answer`. Writing `R` still wins.
- **A list under a record** (`/tenants/{tenant_id}/members`): `listRoute` fills each `{key}` from
  the list's parameters and sends the rest as query; without the key, it is rejected before
  sending anything. The generator no longer excludes them: `memberships` in `auth`, and
  `listTenantMembers(criteria, { tenant_id })`.
- **A GET that is neither a page nor a record** (`GET /me`): `Transport.read` (optional, so as not
  to break whoever implements the port) and `readRoute`, which says by name when a transport does
  not know how to read. The cache never keeps a read of its own. The generated client already has
  `getCaller`.
- **Per-row actions, typed**: `Listing<T, C>` carries its entity's commands and `RowCommand<T, C>`
  accepts only those names and each one's body.
- **A lone key that says whose it is** (`EntityID[Tenant]`, `relation: "auth.Tenant"` with no
  relation field beside it) is a many2one: `relationFieldOf` recognizes it with `held: false`,
  `entityFor` finds the entity by the model (`auth.Tenant` → `auth:tenant`, `Project` in its own
  bounded context, or the only one of that type), and on read its name is asked once per key
  (`useNameOf`). **What was found doing it:** the lines editor wrote `{ [key]: id, [relation]:
chosen }` — with a lone key they are the same field, and the chosen record ended up INSIDE the
  key.
- **An old snapshot is flagged**: `restTransport({ snapshot: versionsOf(contract), onVersionDrift
})` calls once per model and version when the server answers another than the snapshot's. Never
  an error.
- **`presented` keeps the typed commands and answers** (`Presented<T, C, A>`). I found it writing
  the guide: wrapping a generated entity made it loose and turned the check off.

### What is left, for the refactor

- **In a table, a lone key shows its id**: asking for a name per row does not scale; the right
  thing is for the server to expand the name on read.
- **`useNameOf` repeats a part of `useLookup`** (naming by key): unify them.
- **A list of keys** (`list[EntityID[Tag]]`, `text[]` with `relation`) has no control of its own
  yet: it would be `EntityTags` by keys.
- **Story `30 · EnElSelector` failed once** in the full suite (out of four runs): it asks for an
  option's NIT to be visible while the picker is being drawn. Alone it always passes; check
  whether the assertion should wait for the whole option.

## Open decisions

- **Transports**: REST today; JSON-RPC comes almost free (criteria's `rpcSource`). gRPC from a
  browser needs gRPC-Web or Connect in front of the `GrpcGateway`; the `Transport` port admits it,
  whether the framework serves it is to be decided.
- **OpenAPI** (reviewed against forge): reads have no schema (`GET /projects` and
  `/projects/{id}` answer `{}`, there is no `Project`), so an entity's meta is NOT preloaded from
  OpenAPI: it is preloaded with `FrameworkProvider metas` (a snapshot of the server's meta or
  `defineMeta`). Commands and value objects are well described — better than the meta: `Literal`
  and `list[str]`, which the meta sends as `unknown` —, and `metaFromSchema` + `completeMeta` read
  them. Also, the document weighs 11 MB because each list repeats criteria's schema (~620 KB)
  instead of a `$ref`: that is the framework's.
- **Measured performance**: formatting 2 000 rows × 8 fields went from 153 ms to 22 ms with one
  `Intl` formatter per language; the columns are memoized; the search text waits for a 200 ms
  pause; the meta is asked once per entity (`meta: false` afterwards).

## Split into layers: @sincpro/client-framework (2026-11-06)

What every platform shares left this package for
[@sincpro/client-framework](https://github.com/Sincpro-SRL/sincpro_client_framework) (0.1.0): the
transport (REST, memory, `readRoute`), `entity()` with its typed commands, the client contract,
the model definitions (`defineMeta`, `metaFromSchema`, `metaStore`), the ids and the generator
(`sincpro-client generate`, formerly `sincpro-web`). `Feature` and `ApplicationService` with
interceptors were also born there: a span per use case and the trace on every request. This
package imports them from there and does not re-export them (`tests/index.test.ts`).

- Staying here, because they belong to the screen: `explain` (`core/explain.ts`: a refusal in the
  words of the copy table) and `cachedTransport`, which now passes each call's headers
  (`CallOptions`) and keeps answers by the question.
- On `@sincpro/criteria` 2.0 (`selection` instead of `where`): the code did not use `.where()`.
- The tests of the transport, the entity, the memory, the meta, the wire, the contract and the
  generator now live in client-framework; the screen's stay here.
- **Left:** the own names with `where` (`ListDefinition.where`, the cut of `ListScopeProvider`,
  `listing.where`) still to align with `selection`; and the full suite still fails now and then
  under load (story 30, already noted, and in one run 09 and 29), although each passes alone.

## Towards 2.0: `selection`, services from the screen and optional telemetry (2026-11-06)

- **`selection` everywhere**, like criteria 2.0: `NamedFilter.selection`, `ListScope.selection`,
  `listing.selection` / `filter(selection)`. The bar uses web-ui's new API (`selectionOf`,
  `toggleNamed({ selection })`, `BuiltCriteria.selection`), which writes a filter per relation in
  criteria's shape (`{ through, selection }`): the backend rejected the old format `{ through,
match, where }`, and the `as Expression` cast hid it.
- **`useService(service)`**: a screen runs an application use case (a client-framework `Feature`
  or `ApplicationService`) and gets `run`, `busy`, `answer` and `error`. The trace and the report
  belong to the service. Story 42.
- **`./telemetry` (`browserTracer`) and `./errors` (`glitchtipReporter`)**: optional, built from
  the application's configuration (OTLP endpoint, DSN), their SDK loaded after the first render
  and as an optional peer. Without them nothing breaks. They wrap client-framework's adapters
  (`./opentelemetry`, `./sentry`), which work the same on mobile and in Node.
- **Intermittent stories, read in the code**: 09 and 30 asked once whether something was visible
  inside a window or a popover that was still appearing; now they wait. Story 29 walks almost ten
  scenarios in one `play` and runs out of time under load: **it remains to split it**.
- **Depends on publishing**: web-ui 2.0 (`selection` in the bar, and the builder's grouping in
  criteria's shape) and client-framework with the adapters and the single report of an error.

## The bounded context, built as in the backend (2026-11-06)

client-framework 0.3 changes how an application's logic is built: just like in
sincpro_framework, without «runtime» and without `bindServices`.

- **One folder per bounded context** (`domains/project/`): `dependencies.ts` (the type `ProjectDependencies` and
  `registerDependencies` with `addDependency`), `bounded_context.ts` (its `Feature`s and
  `ApplicationService`s typed with that type) and `index.ts`
  (`export const project = configProjectBoundedContext("project").register({ features, applicationServices })`).
  The dependencies are properties (`this.client`, `this.session`) and an ApplicationService calls
  its Features by name (`this.feature.Issues.close`).
- **It is used by name from anywhere**: `project.Issues.close(input)`; in a screen,
  `useService(project.Issues.close)` — a method is the same function every time it is read. The
  span carries the registered name (`project/Issues.close`, identity `project.Issues.close`), not
  the class's, which a production build renames.
- **Light and unfrozen**: `project` only keeps references, each service is created once when it is
  first asked for, and `project.with({ client })` / `project.scoped({ company_id })` give a variant
  that shares everything else (a test, a window of another company).
- **The process, once in `main`**: `configureProcess({ tracer, reporter, context })`, all optional.
  It is read on every call, so a bounded context can be defined before `main`.
- **The context is a port** (`ContextStore`, with the four methods of sincpro_framework's and
  `watch`): memory by default; the browser or the phone put their technology (sessionStorage, the
  screens' store, MMKV) behind the same API — `processContext.set({ tenant_id })`,
  `project.context`, `this.context` in a service. Here `useContextValues(level)` is added, which
  redraws the screen when it changes. Story 42 · `ElContextoLoVeLaPantallaYLoUsaElServicio`.
- **Depends on publishing** client-framework 0.3.0: the peer goes up to `^0.3.0`.
- **Left**: mobile on this API (today it has its own Feature with a global stack); the reads cache
  with TanStack Query, invalidated by a use case's writes; the typed domain events.

## Values on the wire (2026-11-06)

The day/instant conversions moved to **client-framework 0.4**: they are transversal — mobile reads
and types the same instant on the same wall clock — so `src/core/zone.ts` is gone and
`installTimeZone`, `timeZoneNow`, `wallTimeOf` and `instantOf` are imported from
`@sincpro/client-framework`, with the same signatures. They are not re-exported here
(`tests/index.test.ts` pins it): one zone, installed in one place. `FrameworkProvider timeZone`
installs it there.

client-framework 0.4 also brings the wire rules as sincpro_framework has them:

- **`valuesOf` / `readValues` / `rebuilt` / `pack` / `unpack`**: a decimal travels as text, a
  day is never an instant, bytes travel as `{"$bytes": …}`.
- **`Money`** (`{ amount, currency }`), with exact arithmetic.
- **`momentOf`**, and **`isDay` / `dayOf`**: a day as the server writes it, and the day it is at an
  instant on a zone's wall clock — what «today» means for a company.
- **`plainCodec`**, for a context store that persists.

Still to do here:

- `textOf` drawing a `Money` value.
- The date pickers use `dayOf` for «today», on the installed zone, not the browser's.

The line between the two: only what is transversal goes to client-framework. Formatting for a
person, the inputs and the browser's own libraries stay here.

**Depends on publishing** client-framework 0.4.0: the peer and the devDependency go up to
`^0.4.0`.

## The core, finished overnight (2026-11-06)

- **A Command's answer goes by the backend's name.** The generator (client-framework 0.5) writes
  `ResponseCancelIssue` — the output's own title — and keeps `CommandCancelIssueAnswer` as a
  deprecated alias; `stories/support/forge-contract/` was regenerated (`make codegen-fixtures`).
- **`textOf` draws a money and every digit of a decimal.** A `{ amount, currency }` value object
  reads in its currency, rounded to its decimals (`Money` from client-framework), the amount handed
  to `Intl` as text; a decimal longer than a float holds is drawn whole. An unknown code reads as
  «amount CODE».
- **A view that breaks is reported.** composer 1.6's `onViewError` tells the app; `SincproApp`
  hands it to `reportError` (client-framework) by default — the process's reporter, once, as
  `view <ref>`. A screen of its own passes `onViewError`.
- **«Today» is the company's day.** A date field hands web-ui's `DatePicker` the day it is on the
  installed zone (`dayOf(now, timeZoneNow())`, client-framework); its calendar marks that day and
  opens on it (`DatePicker today`, web-ui 2.1). Before, React Aria marked the browser's day.
- **Story 29 is four stories, one scenario each** (the list to the record; edit and save; a
  related record in a modal and from there beside it; previous and next): the long play that ran
  out of time under load is gone.
- **Depends on publishing:** client-framework 0.5 (`reportError`, the answer names), composer 1.6
  (`onViewError`) and web-ui 2.1 (`DatePicker today`); the peers here are `^0.5.0`, `^1.6.0` and
  `^2.1.0`.

## What a screen reads and writes is a use case (2026-11-06)

- **Every request the screens send is a use case of `screens`.** `FrameworkProvider` reads and
  writes through client-framework's `screensTransport`: a page is `screens/EntityReads.list`, a
  record `…/EntityReads.one`, a save, a draft or a Command `…/EntityWrites.send` — sincpro_framework's
  built-in `EntityReads`, on the client. So each one gets what any use case gets: its span, with
  its route (`http.route`); the trace on the request (`traceparent` — the backend's trace now
  starts in the screen); the process's context in `sincpro-context` (the company — before, the
  framework's own requests carried none); and a report only when it failed unexpectedly (a 5xx,
  nobody reached — a 4xx is the screen's to show). A bounded context's dependencies are not
  wrapped: there its use case is the one that runs.
- **A change of company reads every screen again, keeping what is on it.** `FrameworkProvider`
  hands the readings the process's context (`useFramework().context`): a list reads the same
  question again — its filter, order and page kept (`reading.reload()`); a record with nothing
  typed reads again, one being edited keeps what was typed (losing it is never the framework's
  decision); groups, pivots, names and the history read again. `SincproApp` forgets the cache
  first (`cachedTransport.invalidate()`, synchronously inside `processContext.set`): an answer of
  one company is never served in the other. An app with its own provider and cache forgets it the
  same way (`processContext.watch(() => cache.invalidate())`). Story `43 · La empresa viaja en
cada pedido`. **Found by the review:** the first version gave the screens another transport
  when the context changed — every reading started over, a list lost its filter and its page, a
  record what was typed.
- **Considered, not done:** forgetting by what a Command `reaches` — in forge's contracts it is
  always the Command's own entities, which the route already names: no evidence yet.

## An optional many2one can be emptied (2026-11-06)

- A record's many2one that is not required was impossible to empty: the picker could only change
  the choice. Now web-ui's `Picker onClear` (2.1) draws a × beside the name — and erasing the name
  and leaving the field empties it too —; `RelationPicker` passes it for a field that is not
  required, writing `null` in the key and in the record held beside it — in a record's field and
  in a line's cell alike (a line's key the line model does not require).
- **Found doing it:** `edit.set` built each change over the render's values, so two fields set in
  one gesture (the key and the record beside it) kept only the last. It builds on the latest now.

## A bounded context starts from its skeleton (2026-11-06)

- `sincpro-client scaffold <contract> --out src/domains/<alias>` (client-framework 0.5) writes,
  once, the files sincpro_framework's layout has — `infrastructure/dependencies.ts` (the
  generated client as `this.client`), `infrastructure/bounded_context.ts` (its `Feature` and
  `ApplicationService`), `services/index.ts` and `index.ts` (`export const project`) — and keeps
  every file already there. Proven by compiling what it writes beside forge's generated client
  (`tests/scaffold.test.ts` in client-framework). The «scaffolding» ARCHITECTURE §13 promised.

## The layers, checked (2026-11-06)

- `sincpro-client check --root src` (client-framework 0.5) is the «enforced, not recommended» of
  ARCHITECTURE §3: every import of the application resolved with its own TypeScript and
  `tsconfig` (path aliases included), checked against the layers — another bounded context only
  through its `index.ts` and only from `infrastructure/`; no React, web-ui, composer or the
  framework's screens in `domain/`, `adapters/`, `services/`; no composer or router in
  `components/`; within a bounded context, no layer imports what the table forbids (`domain/` its
  services, `services/` its components); `common` never imports a bounded context; nothing imports
  the entrypoints; and outside the bounded contexts (the entrypoints, `main.tsx`, a `lib/`) a
  bounded context is used through its `index.ts`. It follows a config of references (Vite's
  `tsconfig.app.json`), a monorepo of packages (`domains/<ctx>/src/<layer>`, a package named whole
  is its index), and it stops — never a green — on a missing root or tsconfig, a config that does
  not parse, or an alias no config resolves. The same on a phone (`react-native` is React).
  **Found by the review:** the first version read an unresolved alias as a package, so Vite's
  layout or a mistyped `--tsconfig` turned every rule off and printed green.
- **Found running it on forge's console** (read only, not changed): `domains/*/adapters/forge_*.tsx`
  import web-ui and web-framework — they are each entity's kit (`presented`), which the
  architecture puts in `components/<entity>/`; `domains/*/domain/{membership,issue}.ts` import
  web-ui; `entrypoints/console.tsx` reaches into four bounded contexts' insides instead of their
  `index.ts`. forge's to move; the check says each one with its file.

## A record screen of one's own keeps the framework's (2026-11-06)

- **`useRecordScreen(entity, { api, resource })`** — the level between `EntityRecord` and
  `useRecord`: everything the framework's record screen does, as values — read for editing, the
  workspace's breadcrumb, its name and its unsaved work told to the workspace, its history, the
  previous and next of the list it came from, and web-ui `Record`'s props (placement, name, state,
  unsaved work, the refusal in words — `explain` —, the audit). PROPS, never components: web-ui
  finds a record's regions by type. `EntityRecord` is written over it. Story `44 · Una pantalla
de registro propia`.
- **Found measuring the purpose against forge's console:** the four files PURPOSE named are gone;
  what is left in `src/shared` says what was missing — `record_screen.tsx` (this hook, 150
  lines), `value_lines.tsx` (a list of plain values inside an embedded field, edited with
  `LineItems`: the lines editor only knows lines of a model) and `action_table.tsx` (per-row
  actions on a record's parts: `RecordLines` takes none).
- **A list of values inside a record is written as lines** — `field.embedded(definition, { many:
true })` (a project's channels): `RecordField` draws the lines editor over the embedded
  definition, each value with its local key, the whole list back through the record's save. It
  drew nothing before. Story `45 · Valores dentro de un registro` — forge's `value_lines.tsx`.
- **A record's part is acted on from its row** — `RecordLines rowActions` (handed to web-ui's
  `List.Table`, where web-ui takes them — on the root a spread dropped them unseen): a group's member, a
  project's share, each with its button, running a Command of the record (the parts have no route
  of their own). Story `46 · Actuar sobre una parte del registro` — forge's `action_table.tsx`.
- With these three, what forge's `src/shared` still holds is forge's own (its session and access,
  its slugs, its transport) or waits for the backend (a person drawn across bounded contexts, #230).

## forge on 2.1 (2026-11-06)

forge's console (`~/dev/sincpro_forge/web`, 31 files) moved from web-framework 1.0, web-ui 1.11,
criteria 1 and composer 1.5 to web-framework 2.1, web-ui 2.1, criteria 2, composer 1.6 and
client-framework 0.5; its backend from sincpro_framework 3.31.1 to 3.32.0. On a branch of forge,
uncommitted.

- **The upgrade is one move.** 84 type errors, every one of them a name that left this package
  for @sincpro/client-framework (`entity`, `Transport`, `pathFor`, …). Moving the imports was the
  whole migration: typecheck, its 9 tests and its build green. Written in `ADOPTION.md`,
  «Upgrading from 1.x».
- **The contract comes from forge itself.** `make contract` exports it from the REST gateway forge
  serves (`export-client-contract sincpro_forge.entrypoints.http:rest web/contracts`) and
  `make client` generates `src/domains/<context>/generated/`, reproducibly. Its `auth` and
  `sandbox` are byte for byte `stories/support/forge-contract/`; `project` differs only by its
  MCP bindings (the fixture was exported with both wires) — the stories run on what forge serves.
- **The layers, checked on a real application.** `sincpro-client check` found 10 breaks: a
  `presented()` and the tones (web-ui's) in `adapters/` and `domain/`, and the console importing
  two bounded contexts' insides. Moved to `components/`, with an `index.ts` per bounded context:
  none left, and `make doctor` is in forge's `verify-format`. The rule held as written.
- **sincpro_framework 3.32 closed a workaround of forge's**: `FastApiGateway` points every list
  at one `Criteria` (`criteria_by_reference`, 2.5 MB per route before, is gone).

What the generated entities still lack against forge's hand-written ones, with its owner:

| #   | Gap                                                                                                                                                                                                                                                                                                                                                                                                           | Owner                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 1   | ~~An entity edited through `Edit` was generated reading its record without the caller's draft~~ (`one: "/projects/{id}"`): a draft kept on one visit never came back. **Solved** in the generator (`?draft=true` when the entity has `edit` and its `get` takes `draft`), release pending; forge's hand-written entities said it already                                                                      | client-framework                      |
| 2   | ~~Where an entity's history is~~: forge wrote `history: { route: "/project-events", type: "Project" }` by hand. **Solved**: each entity declares its `DomainEvents` (`GET /projects/{id}/events`), the contract publishes it as role `events`, the generator writes it as the entity's `history` and `useHistory` reads that route.                                                                           | —                                     |
| 3   | ~~A related record's shape: the contract typed a `many` relation as an array, a read answered a page~~. **Solved**: sincpro_framework publishes it as the collection a read answers (`{items, count, cursor}`, `reference: true` for one that is not a part), the generator types it `EntityCollection<X>` (from an old contract too), and `relatedOf` is client-framework's `collectionOf`; releases pending | sincpro_framework, then the generator |

Done in forge (2026-11-07): the generated entities and wire types in place of the hand-written
ones (commands renamed: `move` → `setProjectTenant`, `cancel` → `cancelIssue`, …), each record's
history from its `DomainEvents`, what a caller sends typed as `<Name>Input`, and the rules a
screen used to keep (`runnable`, `closed`) computed by forge. Next: `src/shared`'s `record_screen.tsx`, `value_lines.tsx` and `action_table.tsx` replaced by
`useRecordScreen`, `field.embedded(…, { many: true })` and `RecordLines rowActions` — then walked
against a running forge.

## A relation with a million children (2026-11-06)

How a to-many reads, counts and travels at any size — the same words in every repository
(@sincpro/client-framework's `UBIQUITOUS_LANGUAGE.md`: collection, part and reference, format,
export). On branches, uncommitted; the client side needs the next releases of criteria and
client-framework.

- **sincpro_framework**: a to-many is declared `EntityCollection[Line]` — recommended, a list
  works too —, immutable, edited the way a string is (`append`, `extend`, `remove`, `replace`);
  a parent's page of children is read with `LATERAL … LIMIT` on PostgreSQL (one parent with
  1 000 000 children: 376 ms → 6.9 ms for 40 of them), counted to a cap («at least 1000»), and a
  relation read whole is said in the log past ten thousand, never refused. A search's page
  travels as JSON or as Parquet (`format`; `auto` past `parquet_above`, a million, for a caller
  that reads Parquet), the cursor and the count in the file's footer. `Export[Entity, Streamed]`
  stays the word for «everything, as a file».
- **@sincpro/criteria**: `restSource({ decode })`, the seam another format plugs into;
  `FieldMeta.reference`.
- **@sincpro/client-framework**: `EntityCollection<T>`, `collectionOf` → `HeldCollection` (the same
  immutable edits), `isPartial`, `countOf`, `relatedCriteria`; `restTransport({ decoders })` and
  `@sincpro/client-framework/parquet` (`parquetDecoder`, over `hyparquet`): a Parquet page reads as
  the JSON one, each value as the wire writes it; the generator types a to-many
  `EntityCollection<X>`, an export as a `Download`.
- **Here**: `relatedOf` over `collectionOf` (the same rule as the backend's `is_partial`), a
  relation that only references other aggregates is never offered as lines to edit
  (`isReference`, `editableLines(value, field)`) — the backend would ignore them on save —,
  «Showing 2 of at least 1000» when the count is a floor, and `useRelated` asks through
  `relatedCriteria`, so a relation by a business key (`parent_field`, `related_field`) lists its
  records.

Next: an «Export» action on `EntityList` when the entity declares `export`, with its story; and
`FrameworkProvider` documenting `decoders: [parquetDecoder]` for an application whose lists may
ask for millions.

## Every screen follows every write (2026-11-12)

forge's console moved its actions to client-framework Features (use cases over the generated
client). Those write through `restOperations`, not through the screens' transport. So
`<SincproApp>`'s cache never heard them, and a screen that reloaded after «Cancel» read the old
issue for up to 30 s. forge worked around it by putting one cache under both doors
(Sincpro-SRL/sincpro_forge#23). Lists open beside never learned anything at all.

- **@sincpro/client-framework** (Sincpro-SRL/sincpro_client_framework#42): every write a transport
  of the framework sends is announced on the process's change feed (`processChanges`: `{ method,
route }`), whoever sent it. A preview or a dry run announces nothing (`changeOf`).
- **Here**:
  - **The rule.** What a write touches moved from the cache to `core/changes` (`touchedBy`,
    `touches`), and the cache, the readings and the names share it.
  - **The cache.** `cachedTransport.changed(change)` forgets as a write through it does, and
    `<SincproApp>` follows the feed with it. The cache is `bindableTransport`: since
    client-framework 1.8 a run binds only what says it may, and a context read through the cache
    lost its `sincpro-context`. Story 43's own transport says it too.
  - **The readings.** `useWrites(route)` counts the writes that touch a route, and every reading
    adds it to what it reads by, as it adds the company: `useListing`, `useRecord` (only with
    nothing typed: losing an edit is never the framework's decision), `useHistory`, `useGroups`,
    `usePivot`, `useNameOf`. Story 47.
  - **Actions.** `ServiceButton`: a use case as an action, with `CommandButton`'s gesture drawn
    once (`ActionButton`). Its dry run is the use case's own (`rehearse`). Story 48
    (Sincpro-SRL/sincpro_web_framework#28).
  - **N records** (Sincpro-SRL/sincpro_web_framework#29). Names are asked through one book per
    transport and company (`nameBook`): the keys asked in one tick go in one request per entity
    (`in`, in slices of 100), and are forgotten when a write touches their entity. The cache
    shares a question already flying: the request is cancelled only when every reader gave up,
    and a write while it flies keeps its answer from being stored. The ROADMAP's «asking for a
    name per row does not scale» is solved by batching, without waiting for the server to expand
    names.

Next: server-pushed changes, the same feed fed by sincpro_framework#201
(Sincpro-SRL/sincpro_client_framework#44); a cross-tab feed over `BroadcastChannel` when two tabs
must agree.
