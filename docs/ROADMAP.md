# Ruta de @sincpro/web-framework

Cómo se construye este paquete: **cada caso de uso es una historia de Storybook con su `play`**
(`make test` las corre con vitest en un Chrome real), y cada pieza de `core/` tiene su test en
`tests/`. Lo que un caso no puede hacer todavía aparece ahí primero, y entra a esta lista.

## Sólo web (decidido 2026-10-31)

Este paquete es el cliente **web** de sincpro_framework, casado con `@sincpro/web-ui` y
`@sincpro/web-composer`. Mobile (`sincpro_mobile`) tiene su propio core, con REST o gRPC: un
paquete genérico para las dos plataformas terminaría rebajando los requerimientos reales de
cada una. Lo que sí se comparte es el contrato con el servidor: `@sincpro/criteria`.

Adentro, tres carpetas con una dirección (`make doctor`):

| Carpeta | Sabe de                                          | Regla                                |
| ------- | ------------------------------------------------ | ------------------------------------ |
| `core`  | transporte, entidad, meta, qué texto es un valor | sin React ni DOM: se prueba en Node  |
| `react` | `useListing`, `useRecord`, el provider           | sin DOM ni web-ui: estado, no dibujo |
| `web`   | `@sincpro/web-ui`                                | —                                    |

Una sola entrada: `@sincpro/web-framework`.

## Fase 1 — leer (hecha)

| Caso de uso                                      | Historia                                   |
| ------------------------------------------------ | ------------------------------------------ |
| Una lista que se arma nombrando campos           | `01 · Una lista…`                          |
| Una lista sin nombrar nada (todos los escalares) | `01 · …Sin nombrar nada`                   |
| Buscar con la plantilla de la entidad            | `02 · Buscar…`                             |
| Un registro: datos, one2many con su total real   | `03 · Un registro…`                        |
| De la lista al registro y volver                 | `03 · …De la lista al registro`            |
| Sin acceso, no existe, condición ignorada        | `04 · Cuando el servidor dice que no`      |
| La meta de forge tal cual llega hoy              | `05 · La meta tal como la manda forge hoy` |

Transportes: `restTransport` (sincpro_framework REST) y `memoryTransport` (el mismo motor de
criteria, en memoria). Dominio a mano: `defineMeta` + `field.*`.

## Lo que encontramos que falta

### En otros paquetes

- ~~**`@sincpro/criteria` `restSource`**: pega `?criteria=` sobre una ruta con query propia y lo
  manda en base64url~~ — resuelto en criteria 0.3.1; `restTransport.list` ahora delega en él
  (ver «criteria 0.3.1»).
- ~~**`@sincpro/criteria-react` 0.3.0** declara `@sincpro/criteria@^0.1.0` como peer~~ —
  resuelto en 0.3.1 (`^0.3.0`).
- **forge no declara labels**: la historia 05 muestra `display_name` como encabezado.
- **La meta pesa ~97 KB por respuesta** en forge (aun sin filas): `useListing` ya la pide sólo
  en la primera página; el framework debería serializarla sin sus valores por defecto.
- **sincpro_framework**: tipos de `Literal` y `list[...]` dentro de un value object llegan
  como `unknown`; una referencia a otro contexto (`tenant_id`) no dice a qué apunta; no hay
  semántica de formato (email, url, monto); la meta no dice qué acciones tiene una entidad.

### En este paquete

- **Hecho después de la fase 1** (2026-10-31): búsqueda literal y many2one (`useLookup`,
  `EntityPicker`), composer (`entityView`, `EntityList` con `api`, selección publicada),
  edición (`useRecord` + `RecordField` + `dirtyOf`: hints vivos, preview, versión y 409,
  drafts), comandos con dry run (`useCommand`, `CommandButton`), historia (`useHistory`) y
  `<SincproApp>`. Historias 08–11.
- **Composer 1.0** (2026-10-31): ya no depende de web-ui y trae su propia piel. Este paquete
  la viste de web-ui (`webUiSkin`: íconos de lucide, `Peek`, `Dialog`, `Missing`) y
  `<SincproApp>` la usa por defecto; `useRecordInWorkspace` usa `setTitle`/`setDirty` para que
  la miga muestre el nombre real y descartar cambios pregunte antes.
- **Escala y caché** (2026-10-31): paginación por páginas con el cursor del servidor (por
  defecto) y techo en «cargar más»; `cachedTransport` con invalidación al escribir (activo en
  `SincproApp`); previews cancelados por el siguiente; `EntitySearchBar` como pieza suelta;
  vistas tabla/filas/tablero; `useRelated`/`RelatedList`; selector de `EntityPicker` que busca
  en el servidor. `web/` dividido en `list/`, `record/`, `workspace/`. Historias 15–16, 200 000
  filas.
- **Escala real**: desde web-ui 1.2 la tabla dibuja sólo las filas que se ven a partir de 200
  (`rowWindow`); el techo y las páginas siguen, porque traer filas sigue costando. Agrupar en el servidor ya está (ver «Agrupar»
  abajo); medir (sumas, promedios por grupo) todavía no tiene su pieza.
- **Fase 2 — editar** (hecha): `useRecord` con dirty, preview/onchange (`Preview` del framework),
  hints `*_when` evaluados con `matches`, guardar/descartar, conflicto 409, errores por campo
  (`Problem.errors`). `RecordField` con un control por tipo y `as` para reemplazarlo.
- **Fase 3 — actuar**: `useCommand` con dry-run (`DryRunnable` → `Preview(text, data)`),
  relaciones que cambian por comandos (compartir/revocar), historial (`/<ctx>-events`).
- **Fase 4 — relaciones y composer** (hecha en parte): `entityView` da la entidad a composer
  (lista, registro, ⌘K por `LiteralSearch`); `EntityList` con `api` abre y pone las migas;
  `EntityPicker` es el many2one. Falta: publicar la selección (`api.select`), `api.pick` desde
  el picker en una historia, y backlinks entre contextos.
- **Fase 5 — tableros**: bloques ligados a criteria, filtros globales con `dynamic.param`.
- ~~**web-ui `Record`** sin `Record.Actions` volvía a montar su papel cuando aparecía `dirty`~~
  — resuelto en web-ui (`RecordHeader`: `dirty` ya no decide el papel). Comprobado sacando
  `Record.Actions` de `12 · Un formulario…`: escribir «Llamar antes» no pierde el foco. La trampa
  salió de `AGENTS.md`.
- **web-ui `Picker`** (resuelto en web-ui 1.0: ver «Composer 1.4 y web-ui 1.0») ofrecía «ver todos…» sólo cuando tenía filas que no dibuja (y nunca si recibe
  `onLoadMore`): no puede decir «hay más en el servidor». `EntityPicker` no le pasa `onLoadMore`
  para que el selector siempre esté a mano; un `browsable` explícito es de web-ui.
- **web-ui `Picker`** filtra sólo lo que ya cargó y no sabe pedir más por texto: `EntityPicker`
  acota la página cargada, «cargar más» trae la siguiente y «buscar en todo» abre la lista. Un
  `Picker` que busque en el servidor es de web-ui.
- **web-ui `SearchBar`**: su campo tiene `choices` pero no la palabra de cada una, así que la
  barra ofrece «paid» donde la celda dice «Pagada»; y ofrece «Estado es Globex» con un valor
  que el enum no tiene. Los dos huecos de accesibilidad que encontraron los `play` (el input
  sin nombre con una ficha puesta y el botón del panel que decía «1») los cerró web-ui 1.2:
  `06 · Filtrar` ya los busca por su nombre.
- **Buscar por un campo de otro agregado** («cliente se llama Globex»): criteria compara sólo
  campos propios. Hace falta que la entidad publique el campo (`customer_name`) o que su
  plantilla de búsqueda lo incluya; no se resuelve en el cliente.
- **Ordenar**: `orderBy` le pide el orden al servidor; falta un caso que lo verifique.

## La consola de forge migrada (2026-10-31)

El criterio de éxito de `PURPOSE.md`: la consola de forge (`~/dev/sincpro_forge/web`) migrada a
0.1.0 con composer 1.0. Desaparecieron `forge_client.ts`, `forge_context.tsx`, `collection.tsx`,
`model.ts`, `history.ts` y `views.tsx`; `records.ts` quedó en dos tipos del cable y
`tenant_select.tsx` se quedó (hueco 2). `web/src` pasó de 3 049 a 2 195 líneas. Probado contra un
forge corriendo, como admin y como usuario de un tenant: listar, buscar, ordenar (llega al
servidor), vistazo, ⌘K, compartir, revocar, emitir token e historial.

Lo que no se pudo reemplazar, con su dueño:

| #   | Hueco                                                                                                                                                                                                                                                                                                                             | Dueño                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| 1   | `commands` sólo llena `{id}`: `POST /projects/{id}/shares/{tenant}/revoke` y `POST /users/{email}/tenants/{tenant}/leave` van por `transport.send`                                                                                                                                                                                | web-framework                    |
| 2   | `EntityPicker` sin opción «ninguno» (forge escribe «sin tenant» como `""`) ni `exclude` (compartir oculta los tenants que ya lo tienen): `TenantSelect` sigue en forge, ahora sobre `useListing` + `lookupOf`. Agregar un usuario a un tenant sí usa `EntityPicker`                                                               | web-framework                    |
| 3   | `entityView` cubre lista y registro, no alta: `new-project`, `new-tenant` y `new-user` son `ViewSpec` a mano                                                                                                                                                                                                                      | web-framework                    |
| 4   | Permisos: `caller === "admin"` decide vistas y páginas; `useHistory` pide el historial aunque quien mira no pueda leerlo (forge contesta 403 y la vista lo omite: un request perdido por registro). Permisos y grupos son de negocio, fuera del framework (`PURPOSE.md`)                                                          | forge                            |
| 5   | Labels: `project` y parte de `auth` ya los declaran (backend sin commitear), pero `id`, `created_at` y las `choice_labels` de `Role` («member») no. La UI no los tapa                                                                                                                                                             | backend de forge                 |
| 6   | `<SincproApp>` es dueño de su workspace y no dibuja barra: los menús de la barra de la app no pueden hacer `workspace.start(ref)`, y su raíz `h-dvh` no deja lugar a una barra alrededor. forge monta las piezas (`FrameworkProvider` + `Composer` con `webUiSkin` + las tres tablas de textos)                                   | web-framework                    |
| 7   | `cachedTransport` olvida sólo la primera parte de la ruta escrita: compartir (`/projects/…`) deja viejo `/project-events` 30 s, y unirse a un tenant (`/users/…`) deja viejos los miembros de `/tenants/{id}`. forge no monta la caché                                                                                            | web-framework                    |
| 8   | La búsqueda ⌘K de `entityView` usa `entity.list` sin `params`: en forge `/projects` sin `tenant_id` son los proyectos SIN tenant, así que ⌘K nunca encuentra un proyecto de un tenant. O `entityView` acepta un scope, o forge lista todos para el admin                                                                          | web-framework + backend de forge |
| 9   | `historyOf` lee un hecho sin `label` como su id (`01a18fc5…`); la consola decía «Cambio registrado». Falta esa palabra en `frameworkCopy`                                                                                                                                                                                         | web-framework                    |
| 10  | `EntityList`/`RecordLines` no exponen acciones por fila (el `List` de web-ui ya tiene `rowActions`): las membresías de un usuario («Quitar») siguen como tabla a mano, con `relatedOf` + `textOf`                                                                                                                                 | web-framework                    |
| 11  | `CommandButton` no tiene `disabled`: «Mover» (sin cambio de tenant) y «Compartir» (sin tenant elegido) usan `useCommand` + `Button`                                                                                                                                                                                               | web-framework                    |
| 12  | `entityView` recibe los componentes, no un `load`: las vistas dejaron de ser chunks perezosos y el bundle de forge quedó en uno de 1,5 MB                                                                                                                                                                                         | web-framework                    |
| 13  | ~~La vista «filas» de `EntityList` arma la fila sólo con display + campos~~: **resuelto** con `presented(entidad, { row })` — las etiquetas («compartido», «inactivo») van en `row.tags` (ver «Cómo se ve un registro»)                                                                                                           | web-framework                    |
| 14  | `webUiSkin` le daba al composer los íconos de lucide a 24 px (su default) dentro de controles de 22 px: el vistazo/al lado/ventana de un link y el marco del panel se veían más grandes que el nombre. **Arreglado en `skin.tsx`** (16 px, como los glifos del composer), falta release; forge usa `DEFAULT_ICONS` mientras tanto | web-framework                    |
| 15  | El composer dibuja un ícono de la piel como `<Icon />` sin tamaño ni clase, y su CSS no acota el `svg` de `.sc-control`: cualquier piel con íconos de otro tamaño desborda. Acotarlo en `.sc-control svg` lo hace robusto                                                                                                         | composer                         |
| 16  | `Record` no tiene densidad: en un panel o el vistazo el título, los hechos y la actividad tienen el mismo tamaño que en una página, y un hecho monoespaciado largo (un email) se pega al siguiente                                                                                                                                | web-ui                           |

## Ciclo de vida y operación (2026-10-31)

Lo que una app de negocio necesita de un registro además de leerlo y editarlo. Cada cosa vive
donde tiene que vivir: el comportamiento acá, el componente en web-ui, el contrato en el backend.

| Caso de uso                                    | Historia / test                      | Estado                               |
| ---------------------------------------------- | ------------------------------------ | ------------------------------------ |
| Crear con los `default` de la meta             | `17 · Crear un registro`             | ✅ `useRecord(entidad, "")`          |
| Al crearse, la pantalla pasa a ser el registro | `17 · …SeCreaYSeVuelveElRegistro`    | ✅ por la identidad de la respuesta  |
| Reintentar un alta o un Command sin duplicarlo | `17 · ReintentarNoDuplica`, `tests/` | ✅ `Idempotency-Key` (`retryKeys`)   |
| «Nuevo» en la lista, en página o ventana       | `18 · Las ventanas de composer`      | ✅ `entity.newRef()` + `api.replace` |
| Elegir un registro con el selector de composer | `18 · ElegirEnUnaVentana`            | ✅ `chooserIn` + `api.answer`        |
| Many2one acotado por otro campo                | `09 · AcotadoPorOtroCampo`           | ✅ `criteria` en `EntityPicker`      |

Con esto el hueco 3 de la consola de forge (`new-project`, `new-tenant`, `new-user` como
`ViewSpec` a mano) se cierra: `create` en la entidad, `newRef()` y la vista del registro con id
vacío.

### Encontrado al escribirlo

Composer [#6](https://github.com/Sincpro-SRL/sincpro_web_composer/issues/6) quedó resuelto en
composer 1.1.0 (`useCrumbs`, ya instalado). El
[#5](https://github.com/Sincpro-SRL/sincpro_web_composer/issues/5) estaba mal diagnosticado: no
era de composer (ver abajo). Pedidos abiertos en sincpro_framework:
[#228](https://github.com/Sincpro-SRL/sincpro_framework/issues/228) (un alta contesta su
identidad), [#229](https://github.com/Sincpro-SRL/sincpro_framework/issues/229) (escribir las
líneas de un agregado) y [#230](https://github.com/Sincpro-SRL/sincpro_framework/issues/230)
(acciones, referencias y formato en la meta; los permisos quedan en la aplicación, ver
`PURPOSE.md`).

- **useRecord** (arreglado): con el id nuevo, un render mostraba el registro anterior bajo la
  identidad nueva — la pantalla leía `record.customer` de un formulario vacío. Ahora un estado
  sólo se muestra para el id con que se leyó.
- **Una lista en un panel se quedaba vacía** (arreglado; era de acá, no de composer — composer #5
  lo contestó). Una lista angosta (ventana, panel lateral, teléfono) web-ui la dibuja como filas
  después del primer pintado (`useNarrowList`), pida lo que pida la pantalla; `EntityList` sólo
  escribía `List.Rows` si la pantalla pedía esa vista, así que ahí no dibujaba nada. Ahora la
  escribe siempre. El test veía «la fila se desconecta» porque apretaba la fila de la tabla que
  web-ui acababa de reemplazar.
- **web-ui — una `List` sin cara de filas** cae igual a filas cuando es angosta y no dibuja nada.
  Debería quedarse en la cara que tiene, o avisar.
- ~~**composer — una vista no sabe que la abrieron para elegir**~~: composer ya lo tiene en main
  (#12, después de 1.4.0): `api.choosing` y `pick(…, { question })`. Cuando se publique, `PICK_PARAM`
  (`entity.chooserRef()`, `EntityList`) se reemplaza por `api.choosing`.
- **La miga de un registro con su nombre real** (arreglado con composer 1.1.0): `EntityList` y las
  vistas de las historias dibujan la miga con `useCrumbs(api)`, que sigue a `setTitle`; con
  `api.crumbs()` en el render quedaba la referencia («Nuevo», «C-004»). El peer pasó a `^1.1.0`.
- **web-ui `Picker`** (resuelto en web-ui 1.0, que además trae `onCreate`): no ofrecía «ver todos…» cuando dibujaba todas sus filas, así que con
  pocos registros el selector de composer necesita un botón propio. Tampoco tiene «crear
  "Globex"…» (crear desde el selector), que ya podría usar `newRef()`.
- **Duplicar** no se hace en el cliente: copiaría el número correlativo. Falta que el backend
  publique qué campos no se copian (`copy: false`, como Odoo) o un `Duplicate`.
- **Líneas editables** (one2many): web-ui ya tiene `LineItems`; falta el contrato del backend para
  escribir las líneas de un agregado (reemplazar el conjunto o comandos por línea).
- **Una alta que no contesta su identidad** (forge contesta `{project_id}`, no `{id}`): el hook
  deja la respuesta en `edit.created` y la pantalla decide. Mejor que el framework conteste la
  identidad bajo el nombre de la `identity` de la meta.

## Agrupar (2026-10-31)

Agrupar una lista es gestión de datos, no tablero: estaba en la fase 5 junto con los tableros y
nunca llegó. Ahora «Agrupar por», en el panel de la barra, ofrece los campos `groupable` de la
meta (una fecha con sus cortes) y la lista muestra los grupos **contados por el servidor** sobre
todo el conjunto (`useGroups`: la pregunta de la lista + `group_by`, con techo de 100 grupos). Un
grupo empieza cerrado y sus filas se piden al abrirlo, con el criteria del propio grupo. El
servidor en memoria también contesta grupos (`answerGroups` de criteria), como el backend.
Historias `19 · Agrupar` y `15 · AgruparDoscientosMil` (cuatro grupos de 50 000, cincuenta filas
al abrir uno).

Lo que falta, con su dueño:

- ~~**web-ui — la tabla agrupa la página**~~ (resuelto con web-ui 1.4, ver «web-ui 1.4»): `DataTable` arma los grupos con las filas que tiene y
  cuenta `getLeafRows()`; ignora `group.piles`. Por eso, agrupada, la lista se ve en filas, que sí
  dibuja los montones que recibe. Pedido: que la tabla dibuje `piles` contados afuera.
- ~~**web-ui — un montón no dice «hay más»**~~ (resuelto con web-ui 1.4: `group.onMore`): un grupo abierto muestra su primera página (50) y su
  total real en el encabezado, pero no puede ofrecer «cargar más» adentro.
- **acá — medir**: sumas y promedios por grupo (`measures`) ya los contesta el servidor; falta
  mostrarlos en el encabezado del grupo.

## Casos de UI con datos: dónde está cada uno (2026-10-31)

El mapa contra el que se mide lo que falta. «Dueño» es quien tiene que moverse para cerrarlo.

| Caso                                                | Cómo se usa                                      | Historia   | Estado | Dueño de lo que falta                          |
| --------------------------------------------------- | ------------------------------------------------ | ---------- | ------ | ---------------------------------------------- |
| Lista paginada por el cursor del servidor           | `useListing` + `EntityList`                      | 01, 15     | ✅     |                                                |
| Buscar literal (plantilla de la entidad)            | `search="box"`, `listing.search`                 | 02, 09     | ✅     |                                                |
| Filtrar con barra, constructor y filtros con nombre | `EntitySearchBar`, `filters`                     | 06         | ✅     |                                                |
| Ordenar en el servidor                              | encabezado → `order`                             | 20         | ✅     |                                                |
| Agrupar en el servidor                              | «Agrupar por», `useGroups`                       | 19, 15     | ✅     | «Ver N más» en un grupo (web-ui 1.4)           |
| Medir por grupo (sumas)                             | `EntityList sums`, `useGroups` (`sumsOf`)        | 19         | ✅     | backend: cómo se agrega cada campo             |
| Listas con dominio (sub-filtro fijo)                | `defineList`, `useListing(lista)`, `listView`    | 21         | ✅     |                                                |
| Una vista de lista propia con la misma búsqueda     | `List` de web-ui + `EntitySearchBar` (nivel 2)   | 21         | ✅     |                                                |
| Varias caras del mismo conjunto                     | `views`                                          | 15         | ✅     |                                                |
| Relaciones dentro de un registro                    | `RelatedList`, `RecordLines`                     | 16         | ✅     |                                                |
| Elegir un registro (many2one)                       | `EntityPicker`                                   | 09, 12     | ✅     |                                                |
| …acotado por otro campo                             | `criteria`                                       | 09         | ✅     |                                                |
| …desde una lista con dominio                        | `EntityPicker entity={lista}`                    | 09         | ✅     |                                                |
| …buscando en todos, como tabla                      | botón «Buscar en todos», `columns`               | 09         | ✅     |                                                |
| …con el selector de composer                        | `chooserIn`, `api.pick`                          | 18         | ✅     |                                                |
| …con un selector propio                             | `useLookup` (literal en el servidor)             | 09         | ✅     |                                                |
| Búsqueda literal DENTRO del desplegable             | `EntityPicker` (`Picker onSearch`)               | 26         | ✅     | web-ui 1.1.0                                   |
| Buscar en una tabla: literal primero, con Enter     | `EntitySearchBar` (`SearchBar literal`), box     | 26         | ✅     | web-ui 1.1.0                                   |
| Crear desde el selector («Crear "Globex"…»)         | —                                                | —          | ❌     | backend + acá (web-ui 1.0 ya tiene `onCreate`) |
| Leer, editar, preview, hints, 409, drafts           | `useRecord`, `RecordField`                       | 03, 10, 12 | ✅     |                                                |
| Crear con los valores por defecto                   | `useRecord(entidad, "")`, `newRef()`             | 17, 18     | ✅     | backend #228 (alta → identidad)                |
| Duplicar                                            | —                                                | —          | ❌     | backend (`copy: false`)                        |
| Archivar / eliminar                                 | —                                                | —          | ❌     | backend (convención)                           |
| Anterior / siguiente desde el registro              | `EntityRecord` + el rastro de la lista (`Trail`) | 29         | ✅     |                                                |
| Líneas editables (one2many)                         | `RecordField name="lines"` (`RecordLinesEditor`) | 31         | ✅     |                                                |
| …escritas en la tabla o en el diálogo               | `addingOf`, `RecordField adding`                 | 31         | ✅     |                                                |
| …con un many2one en la línea (un producto)          | `RelationPicker` en la celda                     | 31         | ✅     |                                                |
| Agregar a un one2many de entidad propia             | «Agregar» de `RelatedList`, `newRef(values)`     | 28         | ✅     |                                                |
| Comandos con prueba en seco                         | `useCommand`, `CommandButton`                    | 10         | ✅     |                                                |
| Reintentar sin duplicar                             | `Idempotency-Key`, `retryKeys`                   | 17         | ✅     |                                                |
| Acciones por fila                                   | `commands`, `useRowCommands`                     | 23         | ✅     |                                                |
| Acción masiva sobre «todos los que cumplen»         | —                                                | —          | ❌     | backend + acá                                  |
| Exportar lo filtrado                                | —                                                | —          | ❌     | backend (`data_analysis`) + acá                |
| Página, vistazo, panel, ventana, ⌘K                 | `entityView`, `RecordLink`                       | 08, 13, 18 | ✅     |                                                |
| Lista y detalle que la sigue                        | `useFollowed`                                    | 22         | ✅     |                                                |
| La miga con el nombre real                          | `useCrumbs` (composer 1.1)                       | 18         | ✅     |                                                |
| Abrir en un modal (y «Abrir en…»)                   | `openIn`, `RelatedRecord`                        | 25         | ✅     |                                                |
| Un registro en cada tamaño (tarjeta, enlace)        | `summaryOf`, `cardOf`, `relationOf`              | 24         | ✅     | web-ui: tarjeta sin cara redonda               |
| Contexto del llamado (empresa, zona horaria)        | —                                                | —          | ❌     | acá                                            |
| Filtros guardados por persona                       | —                                                | —          | ❌     | backend                                        |

Encontrado en esta vuelta:

- **useListing perdía lo tipeado antes de que llegara la definición** (arreglado): sin plantilla
  no había qué llenar, y nada volvía a preguntar. `EntityList` lo escondía porque no dibuja la caja
  hasta tener la meta; un selector propio lo mostró (09 · UnSelectorPropio).
- ~~**web-ui — las sugerencias de la barra no tienen rol**~~ (resuelto en web-ui 1.4: `option`): «Nombre del cliente · contiene Globex»
  son `span` sin `option`; un lector de pantalla no las anuncia y un `play` las busca por texto.
- **web-ui — lo que viene** (sin publicar en 0.2.0): `List readOnly`, «vistazo/abrir» como
  acciones de fila, `collapseAfter` y limpiar todo en la barra, y la medición angosta antes del
  primer pintado. Al publicarse: `EntityList` pasa `readOnly` y deja de dibujar sus aperturas.
- **composer — modal como superficie** (en curso, avisado): cuando exista, el chooser de
  `EntityPicker` y la confirmación de un comando deberían abrirse con él en vez del `Dialog`.

## Composer 1.4 y web-ui 1.0 (2026-10-31)

Composer pasó a `^1.4.0` y web-ui a `^1.0.0`, las dos publicadas. Mientras web-ui 1.0 no estaba
en npm se iteró con un `npm pack` de `~/dev/sincpro_web_ui` puesto en `node_modules` (`yarn link`
traería un segundo React); la CI, con el peer todavía en `^0.2.0`, no compilaba (`OpenTarget`,
`onOpenIn`). Lección: el peer sube en el mismo commit que usa la API nueva.

Nada de lo que este paquete importa de web-ui desapareció (lo que 1.0 quita — `Drill`,
`CommandPalette`, `LookupDialog`, `ContactCard` — no se usaba). Con las dos versiones nuevas
pasan las 128 pruebas; dos `play` cambiaron porque el `Picker` cambió:

- **web-ui `Picker` ofrece siempre «Buscar más…»** cuando recibe `onBrowseAll` (como opción, con
  cuántos más hay en su nombre). Se cierran los dos huecos de «ver todos…» de arriba. Queda
  redundante el botón «Buscar en todos» que `EntityPicker` dibuja al lado (`browse`): falta
  decidir si se va.

Lo que trae y todavía no se usa acá: `OpenTarget` («Abrir en…» en `RelationValue`, `Picker` y
`TagsField`), `onCreate` / `onCreateAndEdit`, `List onChoose` / `rowClick` / `readOnly`, avatares
en `Picker`, `TagsField`, filas y tarjetas, `RecordCard`, `RelationCard`, calendario, Gantt,
línea de tiempo y pivote. De composer: el modal (`Destination.Modal` con `size`), `api.over`,
`api.pick` que contesta cualquier valor, `createTestApi`, modo teléfono y `RecordLink draggable`.

Encontrado al leerlos, con su dueño:

- **web-ui — `ListView` mira por defecto** (`rowClick = "peek"`), contra su propia guía
  («tocar una fila → página»). Mientras no cambie, `EntityList` tiene que pasar `rowClick="open"`
  si pasa `onPeek`.
- **composer — su README dice que un many2one abre en ventana**; la guía de web-ui («Nuestro
  estilo») dice modal. Hay que alinear uno de los dos.
- **web-ui y composer exportan los dos un `RecordLink`**: el de web-ui es el nombre que abre, el
  de composer el que sabe de destinos (`draggable`). Mismo nombre, dos cosas.
- **composer sigue sin `api.choosing`**: el parámetro `pick` de `entity.chooserRef()` se queda.
- **web-ui `Picker` no expone lo tipeado** mientras se escribe (sólo al pedir «Buscar más…»): la
  búsqueda literal dentro del desplegable sigue esperando.

## Un registro, y abrirlo (2026-10-31)

La base de los componentes de gestión de registros: **qué se sabe de un registro** y **dónde se
abre**, iguales para toda entidad.

- **El resumen** (`summaryOf`, en `core/`): nombre (el `display` de la meta), descripción,
  estado, tipo, imagen y quién lo creó y cambió. Cada parte es el campo que la entidad declara
  (`entity(…, { summary: { image: "logo" } })`) o el nombre de costumbre (`description`,
  `state`/`status`, `type`, `image`/`avatar`/`photo`/`logo`, `created_at`, `created_by`,
  `updated_at`, `updated_by`); con meta, sólo campos que la meta tiene. Lo que falta es `null`
  y no se dibuja. `person: true` le da cara redonda (foto o iniciales). `useSummaryOf(entidad)`
  lo da con la meta y el idioma de la aplicación; `cardOf` y `relationOf` lo vuelven las props
  de `RecordCard` y `RelationValue`. Historia `24 · Un registro, en cada tamaño`; tests en
  `tests/summary.test.ts`.
- **Abrir** (`openIn`, `targetsFor`, `RECORD_SIZE`, en `web/workspace/`): el `OpenTarget` de
  web-ui traducido a composer una sola vez. Un relacionado abre en **modal** del tamaño de un
  registro (760×560) y «Abrir en…» ofrece vista previa, al costado y página; **desde adentro de
  un modal** (`api.over`), al costado o en vista previa — pedir un modal ahí abre al costado.
  `RelatedRecord` es el many2one leído: resumen + `openIn`. Historia
  `25 · Abrir un registro relacionado`; tests en `tests/open.test.ts` (`createTestApi`).

Encontrado:

- **web-ui `RecordCard` no tiene cara de persona**: `media` es siempre un cuadrado (`Thumb`),
  así que la tarjeta de un contacto muestra la foto cuadrada y, sin foto, nada — el enlace
  (`RelationValue media.person`) sí dibuja la cara redonda o las iniciales. Pedido: `media.person`
  en `RecordCard`, como en `RelationCard`.
- **El backend no publica las partes del resumen**: qué campo es el estado, la imagen o el
  autor sale de la convención o de `entity()`. Va con
  [#230](https://github.com/Sincpro-SRL/sincpro_framework/issues/230) (formato en la meta).
- **El estado no tiene tono**: se dibuja neutro. Que «Bloqueado» sea rojo es una regla del
  dominio: la meta tendría que decirlo (un tono por valor), no un diccionario de acá.

- **Una lista que se vuelve a preguntar** (arreglado acá): `EntityList` le pasaba a web-ui
  `loading` en cada pregunta, y web-ui cambia las filas por un esqueleto: al tipear, la tabla
  parpadeaba y un clic en una fila podía caer sobre una que ya no estaba (la CI, más lenta, lo
  mostró en `09 · BuscarEnTodosConUnaTabla`). Ahora el esqueleto es sólo de la primera lectura.
  **web-ui**: le falta un estado «refrescando» — las filas quedan y algo discreto dice que se
  está preguntando.

Lo que sigue, sobre esta base: `EntityPicker` completo (avatar, «Abrir en…», «Buscar más…» como
modal de composer, crear), `EntityTags` (many2many que agrega), y `RecordField` que elige el
control de una relación solo — para eso falta saber a qué entidad apunta una relación
(`SincproApp entities` hasta que el backend lo publique).

## Buscar como se espera (2026-10-31)

Había tres búsquedas y cada una hacía otra cosa: el selector cargaba 50 y **filtraba en el
navegador** (un cliente fuera de esos 50 «no existía» aunque se escribiera su nombre exacto), la
caja de una tabla preguntaba **a cada tecla**, y la barra ofrecía primero **un solo campo**
(«número contiene Globex») en vez de la búsqueda literal de la entidad. Ahora es una regla:
el texto es la búsqueda literal, la contesta el servidor; en el selector mientras se escribe, en
la tabla con Enter. Historia `26 · Buscar como se espera` (las tres fallaban antes).

Lo que hizo falta en **web-ui** (rama `literal_search` en `~/dev/sincpro_web_ui`, con sus
pruebas): `Picker onSearch` (no filtra ni corta: las opciones son la respuesta), `Picker
valueLabel` (el nombre del elegido fuera de la página), `SearchBar literal` (la ficha «Buscar
«X»» con el filtro que da quien la usa, primero salvo que el modelo lea la pregunta), y un
arreglo: `decimal`/`monetary` se leían como texto y «total <= 1000» no se podía preguntar.

Acá: `useLookup` abre con 10 y sabe el nombre del elegido (lo recuerda, o lo pide una vez por su
clave), `EntityPicker` le pasa lo tipeado al servidor, `EntitySearchBar` da la literal con
`matching(meta, texto)` y la caja busca con Enter (`listing.search(texto, { now: true })`).

**Publicado**: web-ui 1.1.0 trae todo lo de arriba, y el peer de este paquete pasó a `^1.1.0` en el mismo cambio que lo usa (la lección de la 1.0).

**Varios registros (many2many)** — `EntityTags`, historia `27`: la misma búsqueda para N, sobre
`TagsField onSearch` (web-ui, misma rama). Abre con 10, busca en el servidor (un correo que
ninguna ficha muestra), los elegidos no vuelven como opción y se nombran estén donde estén: los
que nunca se vieron se piden en **una** pregunta por su clave (`in`). Una persona
(`summary: { person: true }`) se elige por su cara, en `EntityPicker` y en `EntityTags`
(`lookupOf` lleva la imagen del resumen).

Pendiente: el botón «Buscar en todos» al lado del selector (`browse`) ya repite el «Buscar más…»
del desplegable; queda prendido por defecto hasta decidir si se va.

## Las relaciones se arman solas (2026-10-31)

`<RecordField name="customer_id" />` ya es el many2one, sin `as`: `relationFieldOf` lee de la
meta qué relación hay detrás de un campo (la relación misma o su clave escalar,
`identified_by`) y a qué agregado apunta (`relation: "Cliente"`); `entityFor` lo resuelve a la
entidad que la aplicación declaró (`SincproApp entities` / `FrameworkProvider entities`), por
el `aggregate` que declara (`entity(…, { aggregate })`), el de su meta o su clave. El campo es
un `EntityPicker` de esa entidad (búsqueda literal en el servidor, los diez, «Buscar más…»),
y en sólo lectura el nombre como `RelationValue`. Historia `28`; tests en
`tests/relation.test.ts`.

Dónde abre lo dice la vista: `RecordOpening` (en `web/record/`, sin composer) lo llena
`entityView` con `openIn` y `targetsFor` — un modal por defecto, al costado desde adentro de un
modal — y «Buscar más…» como `api.pick` de la lista de la entidad (modal; al costado desde un
modal). Fuera de un espacio de trabajo el formulario no abre nada.

Encontrado / pendiente:

- **one2many por nombre** (hecho, historia `28 · UnOne2manyQueAbreSusFilas`):
  `<RecordField name="invoices" />` es la lista de la entidad del otro lado, filtrada a este
  registro por el servidor (`RelatedList`: busca, ordena y pagina — nunca la página que trajo el
  registro), y una fila abre su registro donde dice la vista: un modal sobre el cliente; desde
  ese modal, su cliente abre al costado. Es el one2many de Odoo sin su techo de filas en memoria.
- **many2many por nombre**: todavía no. Se lee como una página (`{items, count}`) y escribirlo
  necesita el contrato del backend (#229); `EntityTags` sirve cuando el valor es una lista de
  claves. **Líneas editables** (`LineItems`): mismo contrato.
- **«Buscar más…» lleva lo tipeado** (hecho, historia `28 · BuscarMasConLoEscrito`):
  `chooserRef(query)` lo pone en la referencia (`q`), y la lista que elige arranca buscada — la
  barra con la ficha «Buscar «Glo»», la caja con el texto. Viaja en la referencia, así sobrevive
  a una recarga como cualquier parámetro. `chooserIn` ignora lo que no es texto (un `onClick`
  le pasa el evento).
- **Local**: la primera corrida de `make test` después de sumar imports nuevos a veces falla
  al importar el setup de Storybook («Unexpected token»): es el optimizador de Vite rehaciendo
  su caché; la siguiente pasa. No apareció en la CI. Si aparece, `optimizeDeps.include`.

## Una aplicación sin escribir pantallas (2026-10-31)

`entityView(entidad, { transport, name })` ya no pide pantallas: sin `list`, es `EntityList`;
sin `record`, es **`EntityRecord`** — el registro dibujado desde la meta (`formOf`): su
nombre, tipo y estado arriba (el resumen), los campos en el orden del modelo (un many2one por su
clave, como selector), cada one2many en su pestaña (la lista de la entidad del otro lado, o las
líneas que trajo), la autoría al pie (`Record.Audit`), «Guardar / Descartar», el conflicto, el
borrador recuperado, los consejos del servidor y la historia si la entidad la declara. `fields`,
`pages` y `actions` eligen y suman. Historia `29` (de la lista al registro, editar, guardar,
el cliente en un modal, una factura suya al costado); tests en `tests/form.test.ts`.

Encontrado al mirarlo (capturas) y al correrlo:

- **useRecord parpadeaba al guardar** (arreglado): releer el registro ponía `record: null` y
  la pantalla entera pasaba por el esqueleto — perdía el foco, el scroll y el clic que caía en
  ese momento (la suite completa lo mostró: «Abrir en un modal» se perdía). Ahora releer el
  MISMO registro lo deja en pantalla hasta la respuesta; un id nuevo sí empieza «cargando».
- **Una lista de palabras (`text[]`) era un área de texto** de una por renglón: ahora son
  fichas (`TagsField`), y escribir una nueva la agrega.
- **Una lista relacionada repetía la columna que apunta al registro** que la contiene («Cliente»
  en las facturas de un cliente, igual en todas las filas): `RelatedList` la deja fuera.
- **El backend publica campos de búsqueda como editables** (`customer_name`, la copia del nombre
  del cliente para buscar): el formulario los muestra como texto. Debería marcarlos `readonly`
  (o no publicarlos como campos del formulario); no se tapa acá.

## Anterior y siguiente (2026-10-31)

Un registro abierto desde una lista sabe dónde está: «50 / 64» y dos flechas
(`Record.Pager`), que lo reemplazan en el lugar (`api.replace`, sin miga), como el pager de
Odoo. Odoo guarda en el navegador los ids de toda la búsqueda y se corta en lo cargado; acá la
lista deja un **rastro** (`Trail`, `core/trail.ts`): la página en pantalla, los cursores del
servidor alrededor y la pregunta. Al borde de la página, `stepIn` pide la vecina con la misma
pregunta y el mismo tamaño — el siguiente del último de la página 4 000 es una consulta, igual
de barata que la primera. El rastro viaja como el parámetro `from` de la referencia; la fila y su
nombre (`RecordLink`) abren la misma, así que la vista previa, el panel y la ventana también lo
tienen. Mientras hay algo sin guardar no hay flechas: primero «guardar / descartar». Historia
`29 · AnteriorYSiguiente` (cruza el borde de la página); tests en `tests/trail.test.ts`.

Límites: el rastro vive en memoria (una recarga lo pierde: el registro se abre sin flechas), y
se guardan los de las últimas 50 listas.

## Cuánto suma cada grupo (2026-10-31)

Agrupada, una lista dice cuánto **suma** cada grupo, no sólo cuántos hay: «Pagada · 22 · Total
53.976», sumado por el servidor sobre todas las facturas del estado (`grouping.measures`, que
el backend y el servidor en memoria ya contestaban). Por defecto se suma lo que el registro
CALCULA — un número exacto de sólo lectura (un total, un saldo); lo que la persona escribe (un
descuento, un porcentaje, un límite) no, porque sumar porcentajes no dice nada (`sumsOf`).
`EntityList sums` elige, `sums={false}` apaga. web-ui: `Pile.detail`, que `GroupHeader` ya sabía
dibujar y la lista no le pasaba. Historia `19 · CadaGrupoConSuTotal`; tests en
`tests/measure.test.ts`.

Encontrado:

- **Los grupos se pedían dos veces** (arreglado): sin la meta todavía no se sabe qué sumar, así
  que se preguntaba sin sumas y otra vez al llegar la meta, y los encabezados se reemplazaban
  bajo el puntero (`21 · AgrupadaDesdeElPrincipio` lo atrapó en la suite completa). Ahora, sin
  `sums` explícitas, los grupos esperan a la meta y preguntan una vez.
- **backend**: la meta no dice cómo se agrega un campo (sumar, promediar, nada — el
  `group_operator` de Odoo). Cuando lo publique, `sumsOf` lo lee y la regla de «exacto y de
  sólo lectura» se retira.
- **Una suma que llega como número** se escribe sin decimales fijos («53.976»): la meta no dice
  la escala de un monto. El backend real la manda como decimal en texto y conserva sus dígitos.

## Escribir antes de que llegue el modelo (2026-11-01)

**useListing ignoraba lo tipeado en una red lenta** (arreglado). La pausa de tipeo (200 ms)
llamaba al `refine` del render en que se armó: si se escribía antes de que llegara la meta y la
meta llegaba DENTRO de la pausa, el framework preguntaba bien («Globex», con la plantilla) y
enseguida el temporizador viejo preguntaba sin filtro y la cancelaba — la lista quedaba entera.
La CI lo mostró como una historia intermitente (`09 · UnSelectorPropio`: con 250 ms de latencia
dependía del orden de dos temporizadores). Ahora el temporizador llama al `refine` vigente; la
historia `09 · EscribirAntesDeQueLlegueElModelo` lo fija con la meta llegando a los 120 ms, y
fallaba siempre antes del arreglo.

## web-ui 1.3 (2026-11-03)

El peer pasó de `^1.1.0` a `^1.3.0`. Nada de lo que este paquete importa cambió de nombre; con
la versión nueva pasan todas las pruebas después de dos ajustes de `play`:

- **La tabla dibuja sólo lo que se ve desde 200 filas** (1.2): `15 · CargarMasTieneTecho`
  contaba `<tr>` y vio 33 de 200. Ahora lee `aria-rowcount` (lo que la tabla tiene) y además
  comprueba que de 300 no dibuja 300.
- **La barra conserva sus nombres con fichas puestas** (1.2): `06 · Filtrar` ya no busca el input
  por estructura, y comprueba «Filtrar, agrupar y favoritos, 1 puesto». Con una ficha el input
  es `textbox` «Buscar»; sin fichas, `searchbox`: el rol cambia con el estado (web-ui).
- **`09 · BuscarEnTodosConUnaTabla` falló una vez con toda la suite** (sola, 5 de 5): miraba
  si el encabezado se veía apenas aparecía, y el diálogo entra con un fundido. Ahora espera.

Lo que trae y todavía no se usa acá: `List.Present` (una presentación propia con el mismo
conjunto) y la plantilla «Operación · sobre N registros».

En `main` de web-ui, sin publicar: `DataTable onMore` / `ListSet.more` (la tabla dibuja los
montones contados afuera y ofrece «Mostrar N más»: cierra los dos pedidos de «Agrupar»),
`createCopy` (un solo mecanismo de textos para web-ui, composer y la app: candidato a
reemplazar `installFrameworkCopy` y las tres tablas de `SincproApp`) y `Panes`.

El remontado de `Record` sin `Record.Actions` lo resolvió web-ui después (ver arriba).
El estado «refrescando», `media.person` en `RecordCard` y las sugerencias con rol los trajo la
1.4 (abajo).

## web-ui 1.4 (2026-11-03)

El peer pasó a `^1.4.0`. Lo que se usa ya:

- **«Actualizando la lista…»** (`state.refreshing`): `EntityList` lo pasa cuando vuelve a
  preguntar con filas (o grupos) en la mano; el esqueleto sigue siendo sólo de la primera
  lectura. Historia `02 · SeVeQueEstaPreguntando` (falla sin el cambio).
- **La barra es un `combobox`** y sus sugerencias son `option` (antes `textbox`/`searchbox` y
  botones): un lector de pantalla las anuncia. Cuatro `play` (06, 26, 29) buscaban los roles
  viejos; ahora `combobox` «Buscar» y `option`. La caja suelta (`search="box"`) sigue siendo
  `searchbox`.
- **La tarjeta tiene cara** (`RecordCard media.person`): `cardOf` dibuja a una persona o
  empresa redonda, con iniciales si no hay foto — igual que el enlace (`relationOf`); las dos
  comparten `mediaOf`. En la tarjeta la cara es `aria-hidden` (el nombre está escrito al lado):
  `24 · CadaEntidadDiceLoQueTiene` la busca dibujada, no anunciada.

- **Agrupado, la lista conserva su cara**: la tabla dibuja los montones que contó el servidor,
  así que `EntityList` ya no cae a «filas» al agrupar. Y **«Ver N más» dentro de un grupo**
  (`group.onMore`): `useGroups.more(bucket)` lee la página siguiente del grupo con el cursor del
  servidor y la agrega, hasta un techo de 500 filas por grupo (`maxRows`), como la lista.
  `15 · AgruparDoscientosMil` abre «Banco» (50 de 50 000), pide más (100) y comprueba que es una
  tabla; falla sin `onMore` y con la cara forzada a filas.
- ~~**Hueco de web-ui**: el botón dice «Ver 49.950 más» y trae 50; en el techo sigue~~ —
  resuelto en web-ui 1.5 (`Pile.more`, ver «web-ui 1.5»).
- ~~El techo de 500 por grupo no tiene prueba propia~~ — la tiene desde 1.5 (historia 15).

`createCopy` para la tabla de textos del framework espera la decisión del contexto.

## criteria 0.3.1 (2026-11-03)

`@sincpro/criteria` y `@sincpro/criteria-react` pasaron a `^0.3.1`. La 0.3.1 arregla en
`restSource` lo que forge había encontrado (manda el criteria como JSON plano y respeta la query
propia de la ruta), así que `restTransport.list` ya no arma la URL a mano: delega en
`restSource` y sólo traduce su `RestError` a `TransportError`. `one()` y `send()` siguen acá —
criteria no los tiene—. Los tests de `tests/rest.test.ts` (query propia, JSON plano, cabeceras
que rotan, rechazo con su problema) pasan igual por `list`.

## Cómo se ve un registro, dicho una vez (2026-11-03)

Propuesta de forge: definir por entidad cómo se dibuja un registro y usarlo en todas partes.
Lo que ya existía y no cambia: el **nombre** es del backend (`meta.display`, el `display_name`
de Odoo; un nombre compuesto como «[C-004] Globex» va como campo calculado del agregado con
`DEFAULT_DISPLAY` apuntándole), la **búsqueda** también (`meta.search`), y las **partes** del
registro son del resumen (`entity(…, { summary })`).

Lo nuevo es **cómo se dibuja**: `presented(entidad, { option, row, card })` en `web/list/presentation.ts`.

- Cada tamaño contesta las **props** de la pieza de web-ui (`PickerItem`, `RowOf`, `RecordCard`)
  y van **encima** del default (`over`): se da sólo lo que cambia; sin presentación nada cambia.
- `option` → `EntityPicker` (todo `PickerItem`: `meta`, `aside`, `tags`, `avatar`, `haystack`…),
  `EntityTags` (nombre y cara: es lo que un chip tiene) y ⌘K de `entityView` (nombre y detalle:
  ⌘K es texto). `row` → la cara «filas» de `EntityList`, y por eso también la tarjeta del
  tablero cuando no hay `card`. `card` → el tablero, con `onOpen` de la lista.
- **Por qué no `entity(…, { present })`** como se propuso: `core/` no importa React ni web-ui
  (`make doctor`), así que no puede nombrar un `ReactNode` ni las props de web-ui. `presented()`
  envuelve la entidad en `web/` y devuelve la misma entidad con su presentación: se pasa a todo
  lo que recibe una entidad.
- **Por qué props y no componentes**: web-ui mantiene el teclado, el resaltado de lo tipeado, la
  regla de qué hace un clic y la accesibilidad de cada pieza; un componente de la app en lugar
  de una opción los perdería. Es el mismo motivo de `factsOf` / `columnsOf`.
- `LookupOption` lleva ahora la fila (`record`): con ella se dibuja la opción.
- Historia `30 · Cómo se ve un registro, dicho una vez` (selector, filas, tablero, y sin
  presentación igual que antes; los dos primeros fallan sin `presentationOf`) y un test de ⌘K en
  `tests/lookup.test.ts`. Cierra el hueco 13 de forge: las etiquetas de una fila van en `row`.

Lo que tiene que moverse en **web-ui** para ir más allá:

- **`Picker` y `TagsField` no aceptan un dibujo propio** de la opción — web-ui 1.5 trae
  `renderOption`; `presented` todavía no lo ofrece: con las ranuras alcanza, y una opción propia
  se sumaría como `option` que devuelve un nodo (pendiente, sin caso que lo pida).
- ~~**`List.Board card` no recibe la regla de clic**~~ — web-ui 1.5 `card(item, ways)`:
  `EntityList` usa `ways.press` (abrir, o elegir en un selector).
- ~~**`TagOption` no tiene `meta`**~~ — web-ui 1.5: `EntityTags` pone el `meta` de la opción (o la
  clave) debajo del nombre en la lista, nunca en el chip. Historia 30.

## Estado y contexto (2026-11-03)

No hace falta un store nuevo: cada estado ya tiene dueño (README, «Where state lives»). Lo global
es `FrameworkProvider`; lo que el backend ve en cada pedido va en los `headers` del transporte
(su `sincpro-context`); lo que lleva una apertura es de composer — `params`, `api.over`,
`pick(…, { question })` + `api.choosing`, `api.context`. Un análisis anterior le pidió todo esto a
composer porque sólo había leído `api.context`: está en `AGENTS.md` como trampa.

Lo que sí falta, y es de acá:

- **Un registro nuevo no toma los `params` con que se abrió** como valores iniciales: «nueva
  factura» desde un cliente debería llegar con el cliente puesto (el `default_*` del `context` de
  Odoo). `useRecord(entidad, "")` arranca sólo con los `default` de la meta.
- **El front no manda `sincpro-context`**: se puede hoy con `headers`, falta una historia que lo
  muestre (la empresa activa).
- ~~**Líneas editables de un agregado**~~ — hechas (ver «Las líneas de un agregado»).
- sincpro_framework#228 (la identidad en la respuesta de un alta) se cerró: es el DTO de cada
  caso de uso; lo de forge (`{project_id}` con identidad `id`) se corrige en forge.

## web-ui 1.5 y composer 1.5 (2026-11-03)

Los peers pasaron a `^1.5.0`. De web-ui 1.5 se usa:

- **«Ver 50 más de 49.950»** (`Pile.more`): `useGroups.brings(bucket)` dice cuántas filas trae el
  próximo «más» de un grupo, o `false` en el techo (500) o sin página siguiente — entonces el grupo
  dice «Se muestran 500 de 50.000» y el botón se va. `15 · AgruparDoscientosMil` llega al techo
  (bajando la tabla: desde 200 filas el pie del grupo sólo se dibuja cuando se ve); falla sin
  `brings`.
- **`card(item, ways)`** y **`TagOption.meta`** (arriba, «Cómo se ve un registro»).

composer 1.5 trae `api.choosing` y `pick(…, { question })`. Todavía no se usa: `PICK_PARAM` en la
referencia sigue marcando el selector (sobrevive a una recarga; `choosing` no, a propósito).
Pasarse es un cambio de comportamiento que hay que decidir.

## Las líneas de un agregado (2026-11-03)

Contrato de sincpro_framework (3.28 más el `path` de las advertencias, sin publicar): las líneas
viajan como la **lista completa y en orden**, en el mismo comando que el agregado y con su versión
(sin ella, la lista completa borraría una línea que otro agregó). Una línea leída lleva su id; una
**nueva va sin id** —el servidor rechaza uno que no conoce y pone el suyo—. Un error apunta a la
celda con `#/values/lines/1/qty`; el preview dice el estado de cada celda en
`states.lines.items[i]` (`fields` hasta 3.28.1) y cada advertencia trae `{message, field, path}` con
`path = ["lines", 1, "price"]`.

Lo hecho (historia `31 · Las líneas de una factura`, tests `edit` y `lines`):

- **`RecordField name="lines"`** de un one2many sin entidad propia dibuja `LineItems` y escribe la
  lista entera con `edit.set` (dirty, preview, guardar y descartar como cualquier campo). Agregar,
  quitar, deshacer y reordenar son de la pantalla: no hay comandos por línea en el cable.
- **La clave de una línea nueva** se guarda aparte (`core/lines`, un `WeakMap` sobre la línea), pasa
  a cada copia editada y se reconcilia **por posición** con lo que contesta el preview.
- **Sólo una lista entera se edita**: un registro que trajo una página de sus líneas (20 de 120) las
  dibuja de lectura (`RecordLines`), porque escribirla entera borraría las que no trajo.
- **Errores**: `errorsByField` no reconocía el `#` (todo caía en la clave `"#"`) y cortaba al primer
  tramo (el error de una celda caía en `lines`). Ahora `pathOf` lee `#/…`, `/…` y caminos, saca
  `values/` y conserva el camino entero (`lines/1/qty`); `errorAt` encuentra el de un campo o de
  adentro de él. Un error o una advertencia de una línea se dice EN la línea (`flag`).
- **Estados por línea**: `states.lines.items[i]` (`fields` hasta 3.28.1) ya no se pierde: `edit.cell(name, i, campo)` es el
  hint del modelo de la línea refinado por el servidor; el diálogo de la línea lo respeta.
- **Un callback de `LineItems` corre tarde** («Deshacer» en un aviso, segundos después): parte de
  la lista de AHORA, no de la del render que lo creó. Un play lo encontró (sumaba una línea de más).

Encontrado contra el backend real (estaba mal y las historias no lo veían, porque el servidor
falso usaba los mismos nombres):

- **Las advertencias** traen `message`, no `text`: el front dibujaba avisos vacíos. Corregido
  (`Advice` es `{message, field, path}`, en `core`).
- **Guardar el borrador** mandaba `{values, expected}`; el `Edit` del framework es
  `{id, values (el registro entero), changed, version, origin_version, action}` y contesta
  `ResponseEdit` con `draft: {version, origin_version, kept_at, stale}`. Corregido el cuerpo y la
  lectura de la respuesta; `12 · UnBorradorEnElServidor` guarda dos veces (la segunda falla si la
  versión no viaja).
- **Leer un registro con borrador**: el framework contesta el registro YA con el borrador puesto y
  `draft` sin `values`; el front hacía `setTyped(draft.values)` (indefinido) y se rompía. Ahora
  lo tolera y lo marca «restaurado». **Abierto**: guardar ese borrador es `Edit` con
  `action: "save"`, y `useRecord.save` usa la ruta `save` con lo cambiado (nada, en ese caso).
  Hay que decidir si una entidad con borradores guarda por `Edit`.
- ~~**El working tree de sincpro_framework renombra la respuesta del preview**~~ — publicado en
  3.28.2 (ver abajo); el front ya lee los nombres nuevos.

Medido con 2 000 líneas (Node, test temporal sobre `core`):

| Qué                                               | Costo                                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------ |
| `changesOf` en cada tecla, con las líneas tocadas | 0,34 ms                                                                  |
| Pedido de preview / respuesta                     | 172 KB / 178 KB por pausa de 300 ms                                      |
| Reconciliar claves por posición                   | 0,02 ms                                                                  |
| `flag` de cada línea                              | 50 ms → **0,39 ms** (un `findIndex` por línea; ahora un mapa por render) |

El costo real es el cable: cada preview manda y recibe la lista entera. Es el contrato (lista
completa); si pesa, lo que cambia es el contrato del backend, no comandos inventados acá.

## sincpro_framework 3.28.2 y web-ui 1.6 (2026-11-03)

**sincpro_framework 3.28.2** publica el vocabulario de formularios: `PreviewEntity`,
`ResponsePreviewEntity`, `warn_form`, `apply_values`, `read_only`. En el cable cambia lo que
contesta un preview y un `Edit`: `fields → states` y `advice → warnings` (cada una
`{message, field, path}`); el pedido (`{values, changed, id}`, y el `Edit`) no cambia, y el error
sigue en `#/values/lines/3/quantity`. Contra 3.28.2 el front perdía en silencio los estados por
línea y las advertencias: ahora lee `states` / `warnings` (`useRecord`), y el servidor falso
contesta igual. `31 · Las líneas de una factura` falla con los nombres viejos.

**web-ui 1.6** trae `cellState(línea, columna)` en `LineItems` (solo lectura, obligatorio, oculto,
error y aviso por CELDA) y `rowState`, y ventana de filas desde 200 en `EditableTable` (2 000
líneas: 273 → 36 ms por tecla, medido por web-ui). `RecordLinesEditor` lo usa:

- El error que apunta a una celda (`#/values/lines/3/quantity`) se dibuja **debajo de ese valor**
  y llega a su control como `aria-invalid`; antes era un aviso sobre la línea entera.
- La advertencia de un valor (`path: ["lines", 0, "price"]`) va en esa celda.
- El aviso de la línea (`flag`) queda para lo que apunta a la línea y a ninguna celda dibujada
  (un `id` que el servidor no conoce).
- Cada celda respeta `states.lines.items[i]` (el precio fijado por volumen, de lectura).

~~Sigue: editar en la celda~~ (hecho, ver «Dónde se escribe una línea»): un control de celda se
nombra con `aria-label` (`FieldControl.standalone`), y sólo ahí.

## Revisión de la UI: la cola (2026-11-04)

Revisado contra el código, las historias, web-ui 1.6 y composer 1.5, con capturas de Storybook
(modal de la historia 28, panel y modal de la 29, formulario de la 12, ventanas de la 18).

**1. Abrir un registro en cualquier lugar.** Hoy:

| Desde                                      | Qué ofrece                                                                                                                      | Falta                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Fila de la tabla                           | clic → página; el nombre es `RecordLink` de composer: vistazo, costado y ventana **sólo como íconos al pasar el mouse** (y ⇧/⌘) | modal; un «Abrir en…» visible y por teclado |
| Fila de «filas» y tarjeta del tablero      | clic → página                                                                                                                   | todo lo demás                               |
| many2one (`RelationValue`, `EntityPicker`) | modal por defecto y «Abrir en…» con todos los destinos                                                                          | —                                           |
| one2many (`RelatedList`)                   | clic → el primero de `opening.targets` (modal)                                                                                  | los demás destinos                          |
| ⌘K                                         | página (paleta de composer)                                                                                                     | es de composer: pedido                      |

web-ui ya tiene lo necesario: `List onPeek` + `rowClick="open"` (1.5+: el clic abre la página y 👁
mira, sin convertir la fila en vistazo — la trampa de `AGENTS.md` sobre `onPeek` quedó vieja),
`rowActions` / `RowOf.actions` para el resto, y sus propias palabras (`openIn`: «Abrir en un
modal», «Vista previa», «Abrir al costado», «Abrir en una ventana», «Abrir en…»).

**2. Cómo se ve.**

- **El formulario** de `EntityRecord` mete todos los campos en un `div` propio de una columna: en
  una página ancha queda una columna angosta y media hoja vacía (capturas 11, 18). web-ui lo dice
  con `FormSection columns={2}` dentro de `Record.Paper` (su plantilla «Operación»): dos columnas
  en ancho, una en compacto.
- **El riel vacío**: `Record.Actions` iba siempre (por un bug de web-ui ya resuelto), así que un
  registro sin migas, sin pager y sin acciones dibuja una banda vacía bajo el título del modal o
  del panel (captura 29).
- **Una tabla en un modal o en un panel** parte cada número en tres renglones («F- / 2026- / 0060»)
  y cada fecha en tres (captura 29; y también en la página, captura 28). Una lista que es un
  campo de un registro abierto en un modal o un panel debería empezar en «filas».
- **El registro en un modal** repite el título (el del modal y el del registro): es el `Record` de
  web-ui; se anota, no se dibuja otro.

**3. Más vistas.** `EntityList views` admite `table | rows | board`. web-ui dibuja además
`sheet` (planilla, virtualizada, que sale de las columnas de la tabla), `report`, `pivot`,
`calendar`, `gantt` y `timeline`. La planilla sale gratis; calendario y pivote necesitan
preguntarle al SERVIDOR (un rango de fechas, dos niveles agrupados): agrupar o filtrar la página
estaría mal (`AGENTS.md`).

**4. Ordenar por varios campos.** `useListing.order` es UN `Sort`. El constructor de web-ui ya
arma `order: [...]` y `EntitySearchBar` lo **tira**. La tabla ordena por un encabezado; las
caras sin encabezados (`rows`, `board`) no ofrecen ordenar (`List sortable`).

**5. La barra con constructor en toda lista de registros.** `RelatedList` (one2many) y el selector
de `EntityPicker` usan `search="box"` (una caja de texto): sin filtros ni constructor.

Orden de trabajo: 1 → 2 → 4 → 5 → 3 (planilla; calendario y pivote del servidor al final).

### Hecho (2026-11-04)

- **1. Abrir** — `EntityList openTargets` (por defecto `targetsFor(api)`: modal, vistazo,
  costado, página, ventana; desde un modal, todo menos modal) y `onOpenIn`. Apretar abre la
  página; el 👁 de web-ui (`onPeek` + `rowClick="open"`) mira; **«Abrir en…»** (`OpenInMenu`,
  `Menu` de web-ui con sus palabras `openIn`) va visible al lado del nombre en la tabla y en cada
  fila. El one2many recibe lo mismo por `RecordOpening`. La ventana se sumó a los destinos de un
  relacionado. Historia `32 · Abrir un registro donde haga falta` (falla sin el menú).
- **2. Cómo se ve** — el registro usa `FormSection` de web-ui: dos columnas en página y modal,
  una en panel, ventana y vistazo (`api.surface`); el riel sólo si lleva algo. Una lista dentro
  de un registro que no está en una página empieza en «filas» (`RecordOpening.narrow`). Un
  código, una fecha o un monto no se parten (`columnsOf`: `whitespace-nowrap`). Historia
  `33 · Un registro se ve bien donde se abra`, que mide geometría (renglones de un texto con un
  `Range`; una caja da un solo rectángulo aunque tenga tres renglones — la primera versión del
  play no fallaba sin el cambio).
- **4. Ordenar por varios campos** — `listing.order` es una lista; el constructor la lee y la
  escribe, y viaja entera al servidor; la tabla y el menú de orden de las caras sin encabezados
  (`sortable`) muestran y ponen el primero. Encontrado de paso: dos cambios en un mismo gesto
  (el constructor aplica filtro Y orden) se pisaban — el segundo partía del estado del render;
  ahora parte del último. `20 · PorVariosCampos` falla sin cada uno.
- **5. La barra en toda lista de registros** — el one2many y el selector de «Buscar más…» usan la
  barra con filtros y constructor; la caja queda para quien la pida (`search="box"`).
  Historias 09 y 16.
- **3. Más vistas** — `views` admite `sheet` (la planilla de web-ui con las columnas de la
  tabla); una lista en pantalla que no dice nada ofrece tabla, filas, tablero y planilla.
  Historia `34 · Un conjunto, varias formas de mirarlo`.

### Pedidos que salen de esto

- **composer** — ⌘K abre siempre la página: que acepte «Abrir en…» o los modificadores de
  `RecordLink` (⇧ al costado, ⌘ ventana).
- **web-ui `FormSection`** no se angosta por su contenedor: dos columnas en un panel de 420 px
  aplastan los controles. Hoy el framework elige 1 o 2 por superficie; mejor una container query.
- **web-ui `DataColumn`** — una opción `nowrap` (o que `mono` no parta): hoy el framework envuelve la
  celda en un `span`.
- ~~**web-ui orden**~~ (resuelto con web-ui 1.7, ver «web-ui 1.7») — `SortState` era UNO: la
  tabla no podía mostrar «Estado ↑, Total ↓» ni ⇧-clic para sumar un campo.
- **web-ui `CriteriaBuilder`** — las fichas de orden y la lista de «ordenar por…» muestran el
  nombre técnico (`amount_total`), no la etiqueta del modelo.
- **web-ui `SearchBar`** — con Enter toma la primera sugerencia, que puede ser «Estado es 0060» (un
  valor que el enum no tiene) en vez de la búsqueda literal.
- **web-ui `Record` en un modal** repite el título: el del modal y el del registro.
- **web-ui `List.Calendar`** no dice qué rango muestra (`onRangeChange`): sin eso el calendario
  sólo puede dibujar la página (mentiría sobre el mes) o traer todo (prohibido). Con eso, el
  framework le pide al servidor `fecha entre inicio y fin`.
- ~~**Pivote**~~ — hecho: `EntityList pivot={{ rows, columns, measures? }}` ofrece la cara
  `pivot`; `usePivot` le pregunta al servidor dos veces (por los dos campos, y por las columnas
  solas para sus totales), nunca trae filas y sólo pregunta mientras es la cara que se mira;
  `pivotOf` lo pliega en el `Pivot` de web-ui (`folded`) con las palabras del modelo («Pagada»,
  «Efectivo»). Historia `35 · Cruzar un conjunto por dos campos` (falla si no pregunta). El total
  general no se dibuja: nadie lo contestó y no se suman celdas.

## A tu manera: cada nivel se reemplaza (2026-11-04)

Lo que el modelo dibuja es un default. Hasta acá, un registro y una lista se podían rehacer pieza
por pieza (`RecordField as`, `EntityList cells`, `rowActions`, `presented`), pero **las líneas
no**: sus columnas, celdas, controles y diálogo eran fijos. Ahora cada nivel tiene su punto de
entrada, y lo que no se pasa sigue siendo del modelo:

| Nivel                                      | Cómo se reemplaza                                                              | Historia |
| ------------------------------------------ | ------------------------------------------------------------------------------ | -------- |
| Un campo                                   | `RecordField as` (widget propio)                                               | 12       |
| Las columnas de las líneas                 | `RecordField lines={{ columns }}` (el diálogo sigue teniendo todos los campos) | 36       |
| La celda de una línea                      | `lines.cells[campo]`                                                           | 36       |
| El control de un campo de la línea         | `lines.controls[campo]` — en la celda y en el diálogo; recibe la línea entera  | 36       |
| Columnas que no son campos                 | `lines.extra` — la entrega de una línea, con un botón que abre un modal        | 36       |
| El diálogo de la línea                     | `lines.editor`                                                                 | —        |
| La celda de una lista de registros         | `EntityList cells`                                                             | 17, 18   |
| Una cara entera de la lista                | `EntityList faces` (`List.Present` de web-ui: el mismo conjunto que las demás) | 36       |
| La lista relacionada dentro de un registro | `RecordField list={{ … }}` (todo lo que toma `EntityList`)                     | 36       |
| Las líneas, sin `RecordField`              | `RecordLinesEditor look={…}` (exportado)                                       | —        |
| Abrir algo desde una pieza propia          | `useRecordOpening()` (exportado): peek, modal, costado, ventana                | —        |

La regla de dónde se escribe una línea no se rompe: un campo con control propio **cabe** en la
celda, y un campo **obligatorio** que la pantalla dejó fuera de las columnas manda la línea al
diálogo (`addingOf`, con `shown` y `own`; tests en `tests/lines.test.ts`). `adding` pasó a
`lines.adding`. Cada play de la historia 36 falla sin su pieza (probado: controles ignorados,
caras sin dibujar, `list` sin pasar).

### Pedido a web-ui que sale de esto

- **`LineItems` / `EditableTable` — una fila con su detalle**: «línea de factura → su picking, su
  facturación» como sub-fila desplegable (`rowDetail(línea)`) y un menú de acciones por línea
  (`rowActions`, como `List`). Hoy se arma con `lines.extra` (un botón que abre un modal o un
  vistazo); el detalle debajo de la fila no tiene dónde ir.

## web-ui 1.7 (2026-11-04)

**Ordenar por varios campos, también en la tabla.** `sort` es `SortState[]` y `onSortChange`
recibe la lista (rotura de 1.7). `EntityList` le pasa `listing.order` entero y escribe lo que
vuelve, entero: ⇧-clic en un encabezado suma un campo, el menú de orden los reordena, y es la
misma lista que arma el constructor. Historia `20 · VariosDesdeLosEncabezados` (falla si se queda
con un solo campo). criteria sigue en 0.3.1 (ya era la versión).

**1.7.1 y 1.7.2** (los pedidos de esta ronda): las tablas cortan el contexto del `Field`, una
columna con `text` dibuja el texto, un control dentro de un `Field` lo nombra el `Field` (su
`aria-label` se ignora: `09 · DesdeUnaListaConDominio` lo buscaba por un `aria-label` dentro de un
`Field` y se ajustó), y Esc en el panel de la barra cierra sólo el panel.

**Controles con formato** (contraseña, tarjeta, correo, teléfono, web, duración, máscara, código,
color; `NumberInput format/units/rounding`; `Numeric format/signed`). El framework no los elige
solo: la meta de sincpro_framework publica `text`, `number`, `date`… y ninguno dice «esto es un
correo» o «esto es plata en Bs». Hasta que el backend lo diga (un `format` del campo: `email`,
`phone`, `url`, `duration`, `monetary` con su moneda), una pantalla los pone con `RecordField as`.
Pedido al backend; nada se adivina acá por el nombre del campo.

## Dónde se escribe una línea, y agregar a un one2many (2026-11-04)

**Una línea se escribe donde está.** Era un botón arriba que abría un diálogo. Ahora es una sola
decisión (`addingOf`, en `core/lines`, probada en Node): en la **tabla** —«Agregar una línea» es
su última fila, una fila se escribe en el lugar, el lápiz abre la línea entera en su diálogo—
siempre que cada campo que se escribe quepa en una celda; en el **diálogo** si alguno no cabe o si
la pantalla lo pide (`RecordField adding="editor"`). Una fila que no se puede terminar donde se
abrió es una trampa, así que «inline» nunca se fuerza. Cabe en una celda: texto, número, fecha,
sí/no, opciones, lista de palabras y un **many2one de una entidad declarada** (el picker en la
celda). No cabe: una fecha con hora, un valor `embedded`, un many2one de una entidad que la
aplicación no declaró (sería un id que nadie tipea). Lo que es de sólo lectura no cuenta. En una
caja angosta web-ui dibuja tarjetas que abren el diálogo.

- Las columnas son los **escalares** de la línea, como un formulario (`lineFields`): un many2one
  es su clave (`product_code`), **nombrada por su relación** («Cemento 50 kg», no «CEM-50»). Elegir
  un producto deja el registro elegido junto a la clave (`EntityPicker onChange(id, chosen)`):
  la celda lo nombra sin preguntar otra vez.
- Una celda dibuja el texto del modelo (`cell`): antes `LineItems` dibujaba el valor crudo
  («1552.00», «CEM-50») — sólo la búsqueda leía `text`.
- **Arreglado de paso**: el editor de la línea dibujaba un many2one con `controlFor` (un
  `TextInput` con la clave a mano). Ahora es el mismo `RelationPicker` del formulario.
- Dentro de una línea —celda o diálogo— «Buscar más…» es el selector propio del picker, nunca el
  del workspace: se abre fuera de la fila (la fila se confirma al perder el foco) o sería un modal
  sobre el diálogo.

**Agregar a un one2many de entidad propia.** `RelatedList` no tenía cómo: `embedded` apaga el
«Nuevo». Ahora ofrece «Agregar», que abre el formulario de un registro nuevo **que ya apunta a
éste** (`entity.newRef({ customer_id })`) donde dice la vista (`RecordOpening.create`: en un
workspace, `api.pick` como modal —al costado desde un modal—); creado, **contesta** (`api.answer`
en `useRecordInWorkspace`, en vez de `api.replace`) y la lista se vuelve a leer. Nunca una fila de
la tabla: cada hijo es un agregado con su alta, sus reglas y su preview. Sin registro todavía no
hay a qué apuntar: no hay botón. Fuera de un workspace, tampoco (`web/record/` no importa
composer).

- Lo que arranca un registro nuevo viaja en la referencia como JSON en un param (`with`): un
  número sigue siendo número, y sobrevive a un reload y a un link. Lo lee `startingValuesOf`; un
  `with` escrito a mano que no es un objeto se ignora, no rompe. `useRecord(entidad, resource)`
  acepta la referencia y arranca con esos valores sobre los defaults. **Una vista de registro
  propia tiene que pasar `resource`** (no `resource.id`) para recibirlos.

Historias: `31 · AgregarEnLaTabla`, `UnProductoEnLaCelda`, `SinSuEntidadSeAgregaEnElDialogo`,
`AgregarEnElDialogoCambiarYGuardar`; `28 · AgregarUnaFacturaAlCliente`, `SinRegistroNoSeAgrega`.
Probado que fallan: con `addingOf` siempre en «inline» falla `SinSuEntidad…`; con el alta que nunca
contesta, `AgregarUnaFacturaAlCliente`.

Encontrado:

- **Un bloque dentro de un `Field` de web-ui le presta su id a cada control.** `RecordField`
  envolvía las líneas y la lista relacionada en `<Field>`: cada control de celda (y la barra de la
  lista) tomaba el mismo `id` y el nombre de la relación (`useFieldIds`). Un one2many va en
  `FormSection title`. web-ui podría aislarlo en `EditableTable` (ver pedidos).
- **`aria-label` dentro de un `Field` duplica el nombre**: React Aria suma las dos fuentes
  («Precio Precio»). El control sólo se nombra solo donde nada lo nombra
  (`FieldControl.standalone`, `RelationPicker standalone`).
- **Una relación se resuelve a su entidad por `aggregate`** (declarado en `entity()`) o por la meta
  ya leída. Sin ninguno de los dos, un producto de una línea no es «declarado» y la línea va al
  diálogo hasta que la meta llegue. `productos` declara `aggregate: "Producto"`.

- **«Agrupar por» en el selector «Buscar más…»** estaba (la barra entera) pero nada lo probaba:
  `09 · AgruparEnElSelector` agrupa por ciudad, abre un grupo y elige desde ahí (falla si la barra
  no recibe los grupos).
- **Una fecha con hora se edita como texto** (`controlFor`): web-ui ya tiene `DateTimePicker`, pero
  pide la hora LOCAL (`"YYYY-MM-DDTHH:MM"`) y el servidor manda UTC. Usarlo es decidir la zona
  horaria del que llama («Contexto del llamado», abierto): no se adivina acá.

### Pedidos a web-ui que salen de esto

- ~~**Escape en el panel de la barra (filtros, agrupar) dentro de un `Dialog` cierra el
  `Dialog`**~~ (resuelto en web-ui 1.7.2): `09 · AgruparEnElSelector` cierra el panel con Esc y
  comprueba que el selector sigue (falla con 1.7.1).

- ~~**`EditableTable` / `LineItems`**~~ (web-ui 1.7.1: `FieldBoundary`) —
  aislar el contexto de `Field` para las celdas.
- ~~**`LineItems`**~~ (1.7.1) — una columna con `text` y sin `cell` dibujaba el `value` crudo.
- ~~**Controles dentro de un `Field` con `aria-label`**~~ (1.7.1: `controlName`) — el nombre salía
  doble.

## Decisiones abiertas

- **Transportes**: REST hoy; JSON-RPC sale casi gratis (`rpcSource` de criteria). gRPC desde
  un navegador necesita gRPC-Web o Connect delante del `GrpcGateway`; el puerto `Transport`
  lo admite, falta decidir si el framework lo sirve.
- **OpenAPI** (revisado contra forge): las lecturas no tienen esquema (`GET /projects` y
  `/projects/{id}` responden `{}`, no existe `Project`), así que la meta de una entidad NO se
  precarga desde OpenAPI: se precarga con `FrameworkProvider metas` (un snapshot de la meta
  del servidor o `defineMeta`). Los comandos y los value objects sí están bien descritos —
  mejor que la meta: `Literal` y `list[str]` que la meta manda como `unknown` —, y
  `metaFromSchema` + `completeMeta` los leen. Además el documento pesa 11 MB porque cada
  lista repite el esquema de criteria (~620 KB) en vez de un `$ref`: es del framework.
- **Rendimiento medido**: formatear 2 000 filas × 8 campos bajó de 153 ms a 22 ms con un
  formateador `Intl` por idioma; las columnas se memorizan; el texto del buscador espera una
  pausa de 200 ms; la meta se pide una vez por entidad (`meta: false` después).
