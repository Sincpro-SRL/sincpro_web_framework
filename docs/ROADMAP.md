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

- **`@sincpro/criteria` `restSource`**: pega `?criteria=` sobre una ruta con query propia y lo
  manda en base64url, y el REST del framework 3.27 sólo lee JSON plano. `restTransport` lo
  esquiva; hay que arreglarlo en criteria y acordar el formato con el framework.
- **`@sincpro/criteria-react` 0.3.0** declara `@sincpro/criteria@^0.1.0` como peer: yarn
  avisa «incorrect peer dependency» con criteria 0.3.
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
- **Pendiente para escala real**: la tabla de web-ui no virtualiza filas (una página grande se
  dibuja entera — por eso el techo y las páginas). Agrupar en el servidor ya está (ver «Agrupar»
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
- **web-ui `Record`** sin `Record.Actions` vuelve a montar su papel cuando aparece `dirty`: el
  campo que se está escribiendo pierde el foco después de la primera letra. Mientras web-ui no
  lo arregle, un registro editable lleva `Record.Actions` siempre (está en `AGENTS.md`).
- **web-ui `Picker`** (resuelto en web-ui 1.0: ver «Composer 1.4 y web-ui 1.0») ofrecía «ver todos…» sólo cuando tenía filas que no dibuja (y nunca si recibe
  `onLoadMore`): no puede decir «hay más en el servidor». `EntityPicker` no le pasa `onLoadMore`
  para que el selector siempre esté a mano; un `browsable` explícito es de web-ui.
- **web-ui `Picker`** filtra sólo lo que ya cargó y no sabe pedir más por texto: `EntityPicker`
  acota la página cargada, «cargar más» trae la siguiente y «buscar en todo» abre la lista. Un
  `Picker` que busque en el servidor es de web-ui.
- **web-ui `SearchBar`**: su campo tiene `choices` pero no la palabra de cada una, así que la
  barra ofrece «paid» donde la celda dice «Pagada»; y ofrece «Estado es Globex» con un valor
  que el enum no tiene. Dos huecos de accesibilidad que encontraron los `play`: con una ficha
  puesta el input pierde el placeholder y queda **sin nombre accesible**, y el botón del panel
  muestra «1» y ese texto **reemplaza su nombre** «Filtrar, agrupar y favoritos». Son de web-ui.
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
| 13  | La vista «filas» de `EntityList` arma la fila sólo con display + campos: las etiquetas que forge ponía en `List.Rows` («compartido», «inactivo») sólo caben como celda de la tabla                                                                                                                                                | web-framework                    |
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
- **composer — una vista no sabe que la abrieron para elegir**: `api.answer` existe siempre y no
  hace nada si no hay quien espere. Viaja como parámetro `pick` de la referencia
  (`entity.chooserRef()`); lo correcto es que composer lo diga (`api.choosing`).
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

- **web-ui — la tabla agrupa la página**: `DataTable` arma los grupos con las filas que tiene y
  cuenta `getLeafRows()`; ignora `group.piles`. Por eso, agrupada, la lista se ve en filas, que sí
  dibuja los montones que recibe. Pedido: que la tabla dibuje `piles` contados afuera.
- **web-ui — un montón no dice «hay más»**: un grupo abierto muestra su primera página (50) y su
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
| Agrupar en el servidor                              | «Agrupar por», `useGroups`                       | 19, 15     | ✅     | web-ui: la tabla agrupa la página              |
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
| Líneas editables (one2many)                         | —                                                | —          | ❌     | backend #229; web-ui `LineItems` ya está       |
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
- **web-ui — las sugerencias de la barra no tienen rol**: «Nombre del cliente · contiene Globex»
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
