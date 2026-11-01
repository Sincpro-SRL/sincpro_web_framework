# Para qué existe @sincpro/web-framework

> **Usar bien, juntas, las piezas con las que Sincpro construye software empresarial — el
> backend (sincpro_framework), criteria, web-ui y composer — para que una entidad se vea, se
> busque, se edite y actúe en la web con una declaración mínima, y que varias convivan en una
> misma pantalla.**

Es la guía contra la que se revisa cada cambio: una pieza que no sirve a algo de esta página no
entra.

## La premisa: abierto, con buenas prácticas por defecto

Esto va a ser como un ERP modular: alguien tiene que poder agregar sus casos raros sin pedirnos
permiso. Por eso:

- **Damos defaults, nunca jaulas.** Cada pieza se usa en tres niveles, y cualquiera se puede
  saltar:

  | Nivel             | Qué escribe quien la usa                        | Ejemplo                           |
  | ----------------- | ----------------------------------------------- | --------------------------------- |
  | 1. Declarativo    | nombra campos y entidades                       | `<EntityList columns={[...]}/>`   |
  | 2. Hooks          | arma su propia pantalla con nuestro estado      | `useListing` + `List` de web-ui   |
  | 3. Piezas sueltas | va directo a criteria, al transporte o a web-ui | `transport.list(route, criteria)` |

- **Lo que damos son buenas prácticas, no reglas de negocio.** La regla vive en el backend; acá
  se lee lo que el backend publica (meta, hints, preview) y nunca se reimplementa.
- **Se puede hacer y deshacer.** Agregar una pieza no obliga a nada más, y sacarla no rompe lo
  demás: una pantalla que deja `EntityList` sigue teniendo `useListing`.
- **El objetivo es resolver casi toda integración de forma sana acá**, con la tecnología de
  Sincpro, para que cada app no escriba su propio cliente, su propio formateo ni su propio
  manejo de errores (lo que forge tuvo que hacer).

## Qué pone cada proyecto de Sincpro

| Proyecto                | Pone                                                                                                                                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sincpro_framework`     | Entidades, criteria, `EntityReads` (Get, GetMany, **LiteralSearch**, Search, Preview), comandos y dry-run, **drafts**, eventos (`/<ctx>-events`), permisos, protocolos (REST, JSON-RPC, gRPC, MCP) |
| `@sincpro/criteria`     | El contrato con el servidor: Criteria, Meta, Page, Problem, `matches`                                                                                                                              |
| `@sincpro/web-ui`       | Cómo se ve: `List`, `Record`, `SearchBar`, `Picker`, `Activity`, `Dialog`…                                                                                                                         |
| `@sincpro/web-composer` | Dónde se abre y el contexto: página, peek, ventana, paneles, selección compartida, ⌘K, atajos                                                                                                      |
| **este paquete**        | El pegamento: entidad + meta + estado + comandos + actividad, dibujados con web-ui y abiertos con composer                                                                                         |
| La aplicación           | Qué es una factura                                                                                                                                                                                 |

## Las abstracciones

| Abstracción                  | Qué resuelve                                                                             | Estado                      |
| ---------------------------- | ---------------------------------------------------------------------------------------- | --------------------------- |
| `Transport`                  | El puerto hacia el backend: REST hoy, JSON-RPC/gRPC después                              | ✅ REST + memoria           |
| `Meta`                       | Qué es cada campo: del servidor, a mano (`defineMeta`) o completada con OpenAPI          | ✅                          |
| `entity()`                   | La declaración única: lista, registro, comandos, historial, su clave para composer       | ✅                          |
| `useListing` / `EntityList`  | N registros: criteria, barra de búsqueda, constructor, paginación                        | ✅                          |
| `useLookup` / `EntityPicker` | **Búsqueda literal**: el select de un many2one y ⌘K (`LiteralSearch`)                    | ✅                          |
| `useRecord`                  | 1 registro: leer, editar, preview, hints, **draft**, guardar, conflicto                  | ✅                          |
| `useCommand`                 | Las acciones de una entidad, con dry-run antes de lo destructivo                         | ✅                          |
| `useHistory`                 | Eventos de negocio (y comentarios, cuando el backend los tenga) → `Record.Activity`      | ✅                          |
| `entityView()`               | La entidad como vistas de composer: abrir, buscar en ⌘K, sus acciones                    | ✅ (`entityView`)           |
| `<SincproApp>`               | El contexto de la aplicación: transporte, idioma, metas, composer, atajos                | ✅                          |
| `defineList` / `listView`    | Una entidad con un corte fijo (por cobrar, borradores): dato, lista y vista              | ✅                          |
| `useGroups`                  | Agrupar en el servidor: grupos contados sobre todo el conjunto, filas al abrir           | ✅                          |
| `useFollowed`                | Un panel de detalle que sigue el registro en el que está la persona                      | ✅                          |
| `summaryOf` / `useSummaryOf` | Lo que se sabe de cualquier registro: nombre, descripción, estado, tipo, imagen, autoría | ✅ (`cardOf`, `relationOf`) |
| `EntityRecord` / `formOf`    | El registro de cualquier entidad dibujado desde su meta, sin escribir la pantalla        | ✅                          |
| `EntityTags`                 | Varios registros (many2many): búsqueda literal en el servidor, con caras                 | ✅                          |
| `RecordField` + `entities`   | Un many2one / one2many armado solo desde la meta (`relationFieldOf`, `entityFor`)        | ✅                          |
| `openIn` / `RelatedRecord`   | Abrir un registro donde corresponde: modal por defecto, nunca un modal sobre otro        | ✅                          |

### Búsqueda literal

Un texto tipeado es **siempre la búsqueda literal de la entidad** — su plantilla (`meta.search`,
el `LiteralSearch` del framework), todos sus campos a la vez — y la contesta el **servidor**.
Cambia sólo cuándo se pregunta:

- **Para elegir un registro** (many2one, «compartir con», ⌘K): abre con los **primeros 10 en el
  orden de la entidad**, y mientras se escribe pregunta al servidor (`useLookup` +
  `Picker onSearch`). El elegido conserva su nombre aunque no esté entre los diez. «Buscar más…»
  abre la lista entera para elegir (`api.pick`).
- **En una tabla**: con **Enter**, nunca a cada tecla. La barra ofrece primero «Buscar «X»» (la
  plantilla), salvo que el modelo lea lo escrito como pregunta suya — un operador
  («total <= 1000»), un valor de un enum («pagada»), el nombre de un campo —: entonces eso va
  primero y la literal al final. La caja simple (`search="box"`) busca lo mismo, con Enter.

Buscar por un campo de **otra** entidad («facturas del cliente Globex») no se resuelve en el
cliente: criteria compara campos propios, así que la entidad publica el campo
(`customer_name`) o lo incluye en su plantilla.

### Drafts

Dos niveles, que no se mezclan:

1. **Lo que se está tipeando** vive en el cliente (`useRecord`): dirty, preview, hints. Se
   pierde al cerrar, y está bien.
2. **Un draft del servidor** (`Drafts` del framework, en Redis con versión): para una edición
   larga, un wizard, el mismo registro en dos pestañas. `useRecord` lo guarda con la versión
   que leyó; si otra pestaña guardó antes, el servidor responde **409** y la pantalla lo dice
   en vez de pisarlo. La respuesta de un registro ya trae la clave `draft` (lo vimos en forge).

Un draft que **otros** tienen que ver (una factura en aprobación) no es un draft: es un
registro con estado `draft`.

### Contexto de la aplicación y composer

Composer ya resuelve el contexto: dónde se abre algo, la selección que una vista publica y otra
lee, ⌘K, Escape compartido, mover el foco entre paneles. Este paquete **no lo repite: lo usa.**

- Una entidad se vuelve vistas de composer (`entityView`): su lista, su registro, su búsqueda
  en ⌘K (con `LiteralSearch`) y sus acciones (con `useCommand`, y su atajo dibujado en ⌘K).
- `EntityList` publica su selección (`api.select`), así un panel de al lado la sigue.
- Los links a otra entidad son referencias (`dominio:tipo/id`), nunca imports: dos contextos
  se hablan por referencia.

### Varias entidades en una pantalla

Tres formas, de la más común a la más especial:

1. **Un registro con sus relaciones**: las líneas de una factura, los miembros de un tenant
   (`RecordLines`), con su total real.
2. **Varias vistas a la vez** (composer): la lista en la página, el detalle en un panel que
   sigue la selección, otra entidad en una ventana.
3. **Una vista de integración**: conciliar un extracto con facturas. La vista recibe las dos
   referencias, muestra el dry-run y termina en **un** comando del servidor — la UI orquesta la
   interacción, el servidor orquesta la transacción.

## Qué NO hace

- No es para mobile: `sincpro_mobile` tiene su propio core.
- No maneja sesión ni login (de la app), no tiene router (composer), no es un gestor de estado
  general.
- No tiene registro de widgets por nombre en texto: un control se reemplaza con `as`, en código.
- No dibuja logs técnicos: la actividad de un registro son eventos de negocio.
- No guarda reglas de negocio: si una regla importa, la cumple el backend.

## Cómo se sabe que cumple

Reescribir la web de forge (`~/dev/sincpro_forge/web`) con este paquete. Si desaparecen
`shared/views.tsx`, `forge_client.ts`, `history.ts` y `tenant_select.tsx`, y cada pantalla queda
en entidad + JSX, cumple. Lo que no desaparezca es lo que falta.

## Preguntas abiertas

- **Comentarios**: no vimos en sincpro_framework un concepto de comentarios sobre un registro
  (el «chatter» de Odoo). Hay que definir su contrato en el backend antes de dibujarlo.
- **Acciones de una entidad**: la meta no dice qué comandos tiene una entidad. Hasta que lo
  publique, se declaran en `entity()`.
- **Permisos y grupos** (decidido 2026-10-31): lógica de negocio, fuera de este paquete.
