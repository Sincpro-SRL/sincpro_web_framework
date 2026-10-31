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
  dibuja entera — por eso el techo y las páginas); agrupar y medir en el servidor
  (`useBuckets` de criteria-react) no tiene todavía su pieza en `EntityList`.
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
- **web-ui `Picker`** ofrece «ver todos…» sólo cuando tiene filas que no dibuja (y nunca si recibe
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
