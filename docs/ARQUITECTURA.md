# El marco de trabajo web de Sincpro

Cómo se arma **cualquier** aplicación web de Sincpro — el backoffice del ERP, un POS, un portal
de clientes, un ecommerce — con una sola arquitectura (DDD + clean), el mismo vocabulario que
sincpro_framework en Python y que `@sincpro/mobile`, y con telemetría, errores y caché por
defecto. Este paquete da la base; la aplicación agrega, modifica o extiende sobre el código, en
lugares marcados.

- **Estado**: propuesta del 2026-11-05, para validar antes del refactor. El plan está en
  [`prd/PRD_02_marco-de-trabajo.md`](prd/PRD_02_marco-de-trabajo.md) y la investigación que la
  sostiene, con sus fuentes, en [`prd/PRD_02_investigacion.md`](prd/PRD_02_investigacion.md).
- Lo que el paquete ES y por qué existe sigue en [`PURPOSE.md`](PURPOSE.md); cómo se adopta lo
  generado desde el contrato, en [`ADOPCION.md`](ADOPCION.md).

## 1. Una sola arquitectura

El backend ya está marcado (forge: `sincpro_forge/entrypoints/` + `domains/{common,auth,…}`).
La web copia esa forma capa por capa; lo único nuevo es `components/`, porque el backend no
dibuja.

| sincpro_framework (forge)                                                         | Web                                                     | Qué es                                  |
| --------------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------- |
| `entrypoints/http.py` (compone los gateways)                                      | `entrypoints/<app>/` (compone los dominios en un shell) | Por dónde se entra. Compone, sin lógica |
| `entrypoints/subscriber.py`                                                       | `domains/<ctx>/entrypoints/live.ts`                     | Lo que llega de afuera, sin pantalla    |
| `domains/common/` (`infrastructure/`, `settings.py`)                              | `domains/common/`                                       | El dominio compartido                   |
| `domains/<ctx>/domain/`                                                           | `domains/<ctx>/generated/domain.ts` + `domain/`         | El lenguaje                             |
| `domains/<ctx>/adapters/`                                                         | `domains/<ctx>/generated/client.ts` + `adapters/`       | Los externos                            |
| `domains/<ctx>/services/` — un archivo por caso de uso                            | `domains/<ctx>/services/`                               | `Feature` y `ApplicationService`        |
| `domains/<ctx>/infrastructure/` (`framework.py`, `context.py`, `dependencies.py`) | `domains/<ctx>/infrastructure/`                         | El cableado del dominio                 |
| `domains/<ctx>/entrypoints/`                                                      | `domains/<ctx>/entrypoints/`                            | Sus vistas, sus eventos, sus widgets    |
| —                                                                                 | `domains/<ctx>/components/`                             | Las piezas de cada entidad              |

En mobile la misma forma existe (`DomainModule`, `Feature`, `ApplicationService` con
interceptores); lo que mobile tiene por ser offline — SQLite, cola persistente, migraciones,
crons de sincronización — no viene a web: aquí la verdad está en el servidor.

## 2. El árbol

Una aplicación:

```text
src/
├── entrypoints/               por dónde se entra: el shell, la sesión, el nivel App. Sin lógica
│   └── app.tsx
└── domains/
    ├── common/                el dominio compartido (§4)
    │   ├── domain/            el lenguaje compartido: Money, Address, la referencia a una persona
    │   ├── components/        cómo se dibuja ese lenguaje: MoneyField, AddressBlock, PersonAvatar
    │   ├── infrastructure/    lo transversal y no funcional (§5)
    │   └── settings.ts
    └── project/               un bounded context
        ├── generated/         del contrato: domain.ts, client.ts, entities.ts, contract.json — NUNCA se edita
        ├── domain/            tipos propios y reglas puras, sobre lo generado
        ├── adapters/          otros externos: un mapa, una impresora, un servicio de terceros
        ├── services/          un archivo por caso de uso (§6)
        ├── infrastructure/    framework.ts, context.ts, dependencies.ts (§5)
        ├── components/        lo compartido del dominio, suelto; lo de cada entidad en su carpeta
        │   └── issue/         su kit: fila, tarjeta, opción, controles de campo, secciones (§9)
        ├── entrypoints/       views/ (las pantallas), live.ts (tiempo real), widgets.ts
        └── index.ts           la superficie pública del dominio: lo único que se importa desde afuera
```

Un producto con varias aplicaciones (backoffice, POS, portal, tienda) es un monorepo
(workspaces de pnpm): cada aplicación es un entrypoint y cada dominio un package que las
aplicaciones comparten.

```text
sincpro_<producto>_web/
├── entrypoints/
│   ├── backoffice/            SPA + composer (SincproApp)
│   ├── pos/                   SPA + PWA sin conexión
│   ├── portal/                SPA, o SSR si hace falta
│   └── shop/                  SSR (SEO)
└── domains/
    ├── common/
    ├── ventas/                package: exports ".", "./react", "./web", "./workspace"
    └── inventario/
```

Sólo existen las carpetas que tienen algo: una entidad sin piezas propias no tiene carpeta y se
dibuja desde su meta (crecer con evidencia, como dice la guía de arquitectura de Sincpro).

## 3. Las capas y lo que cada una importa

| Capa                       | Puede importar                                           | Nunca                                              |
| -------------------------- | -------------------------------------------------------- | -------------------------------------------------- |
| `generated/`, `domain/`    | criteria, el `core` del framework, `common/domain`       | React, DOM, un adapter                             |
| `adapters/`                | `domain/`, el `core` del framework                       | React                                              |
| `services/`                | `domain/`, `adapters/` (por `deps`), `common`            | React, web-ui, composer, `window`, otro dominio    |
| `infrastructure/`          | todo lo anterior, `common/infrastructure`                | componentes                                        |
| `components/`              | `services/` (por hooks), `domain/`, web-ui, el framework | composer, un router, otro dominio                  |
| `entrypoints/`             | todo lo del dominio, composer                            | otro dominio                                       |
| `common/`                  | sólo a sí mismo y al framework                           | ningún dominio                                     |
| `entrypoints/<app>` (raíz) | el `index.ts` de cada dominio                            | el `src/` interno de un dominio, reglas de negocio |

- **Un dominio nunca importa a otro.** Se hablan por referencia (`dominio:tipo/id`): una relación
  `relation: "auth.Tenant"` se dibuja con el kit que publica `auth`, resuelto por el registro de
  dominios del shell (`entityFor`, historia 41). Lo que dos dominios comparten de verdad va a
  `common`.
- **Otra entidad del mismo dominio** se importa sólo por su `index.ts`.
- **Se hace cumplir, no se recomienda**: el framework trae un preset de reglas
  (dependency-cruiser) que el `make doctor` de cada aplicación corre, igual que hoy el del
  framework.

## 4. `common`, el dominio compartido

El lenguaje que hablan dos o más dominios, y lo transversal.

- **Entra**: un tipo o valor que usan 2+ dominios (`domain/`), el componente que lo dibuja
  (`components/`), la infraestructura transversal (`infrastructure/`), la configuración
  (`settings.ts`).
- **No entra**: services ni entrypoints — `common` no orquesta y no se entra por ahí, igual que en
  forge (`domains/common/` tiene `infrastructure/` y `settings.py`); nada de un solo dominio «por
  si acaso»; lo que un dominio ofrece a otro (el picker de tenants es de `auth`).
- Todos importan de `common`; `common` no importa a ningún dominio.

> La guía de Sincpro (`sincpro_architecture_guidelines` §3.1 y §6) dice `shared/` y prohíbe
> `common/`, pero el backend de forge usa `common/`. Se eligió `common`; la guía se corrige para
> que web, backend y guía digan lo mismo.

## 5. `infrastructure`, en dos lugares

La regla para decidir: si al cambiarlo por otro equivalente cambia el comportamiento del negocio,
es un adapter; si es cableado, un cliente sin negocio o algo no funcional, es infraestructura.

| Dónde                       | Qué                                                                                                                                                                                                                                                                                                                                       | En forge                                                    |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `common/infrastructure/`    | El **cliente raw** (el transporte con su base, headers y auth), la sesión y quién llama (`/me`), el contexto global, la telemetría y el reporte de errores (sus adaptadores y configuración), el `QueryClient`                                                                                                                            | `access.py`, `context_store.py`, `database.py`, `events.py` |
| `<dominio>/infrastructure/` | `framework.ts`: la instancia del dominio — su cliente generado sobre el transporte de `common`, sus services, sus kits, vistas, widgets y fuentes en vivo. `context.ts`: el contexto del dominio. `dependencies.ts`: lo que recibe cada Feature (el cliente, settings, el servicio de otro dominio por su `index.ts`, nunca sus archivos) | `framework.py`, `context.py`, `dependencies.py`             |

## 6. Los servicios: `Feature` y `ApplicationService`

**Toda la lógica de la aplicación vive en servicios**, y los servicios son de dos tipos — los de
sincpro_framework y de mobile:

- **`Feature`**: un caso de uso. Recibe sus dependencias (`deps`: el cliente generado, otro
  adapter) y hace una cosa.
- **`ApplicationService`**: igual que una Feature, más la única diferencia: ejecuta Features de
  **su** dominio. Nunca otro ApplicationService.

```ts
// domains/project/services/send_issue.ts
export class SendIssue extends Feature<{ project: ProjectClient }> {
  execute(input: SendIssueInput) {
    return this.deps.project.sendIssue(input);
  }
}

// domains/project/services/close_issue.ts
export class CloseIssue extends ApplicationService<{
  preview: PreviewClose;
  send: SendIssue;
}> {
  async execute(input: CloseIssueInput) {
    const preview = await this.features.preview.execute(input); // span hijo
    if (preview.warnings.length > 0) return { blocked: preview };
    return this.features.send.execute({ ...input, message: "cerrado" }); // span hijo
  }
}
```

**Sin bus, con interceptores** — como `@sincpro/mobile` (`interceptInstance` + hooks
`before`/`after`/`onError`): cada método público de una Feature pasa por los interceptores del
framework, y eso da **por defecto**, sin que el autor escriba nada:

1. **la traza**: un span por caso de uso, `<dominio>/<Feature>`, con atributos `sincpro.*`; el
   transporte escribe `traceparent` y el backend continúa la MISMA traza (§8);
2. **el error**: lo inesperado se reporta con su `trace_id`; lo que el servidor ya explicó (una
   validación, un conflicto) no (§8);
3. **el contexto**: quién llama, el tenant, la ventana — una foto por llamada (§7).

Una diferencia con mobile, a propósito: mobile guarda el span activo en un **stack global** (push
en `before`, pop al terminar la promesa). Con dos llamadas async a la vez se cruzan — la segunda
toma a la primera como padre y la primera, al terminar, saca la entrada de la segunda. En un
workspace web hay varias vistas pidiendo a la vez, así que aquí **cada llamada lleva su contexto**:
la llamada de un ApplicationService les da a sus Features su span como padre. La API para el autor
es la misma; el arreglo vuelve a mobile.

Las reglas son las de `sincpro_framework_use_cases`, sin excepción:

- Reusar un caso de uso es **ejecutar su Feature**; nunca una función exportada de otro service
  («helper», `existing_*`, `*_command(…)`), porque se salta la traza y el error.
- `domain/` no recibe adapters: un lookup que comparten dos Features es un adapter en `deps`.
- Un service no importa React: se prueba en Node con `memoryTransport`, sin dibujar nada.
- Lo que publica el backend (meta, preview, `Problem`) un service lo lee y lo usa; la regla de
  negocio que el backend valida no se copia.

**El framework trae sus propias Features** para lo que toda entidad hace — listar, leer un
registro, editar con preview y draft, guardar con conflicto, ejecutar un comando con dry-run,
buscar literal, el historial, agrupar, pivotear — que hoy viven dentro de los hooks. Pasadas a
Features, una pantalla generada tiene traza y errores sin escribir nada, y un ApplicationService de
la aplicación puede componerlas con las suyas.

## 7. Los niveles de contexto y dónde vive el estado

| Nivel         | Cuánto vive                         | Qué lleva                                                                                                                                      | Quién lo abre                                      |
| ------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **App**       | La sesión                           | Quién llama, tenant/empresa, idioma, zona horaria, transporte, `QueryClient`, telemetría, el registro de dominios                              | `entrypoints/<app>` con `common/infrastructure`    |
| **Dominio**   | Mientras el dominio está cargado    | Su cliente sobre SU backend (cada contexto trae su base en `bindings`), sus entidades y metas, sus services, el prefijo de sus claves de caché | `<dominio>/infrastructure/framework.ts`            |
| **Ventana**   | Lo que dura una apertura            | Qué se abrió (`ResourceRef` con `params`), sobre qué (`over`), si está eligiendo (`choosing`), dónde (`surface`)                               | composer; el framework lo expone a los componentes |
| **Registro**  | Lo que dura un registro en pantalla | La edición, el draft, las líneas, el preview, los errores                                                                                      | el framework (store por instancia)                 |
| **Ejecución** | Una llamada a un service            | Una foto de los niveles de arriba más el span padre                                                                                            | los interceptores                                  |

- Cada nivel lee el de arriba, nunca el de abajo ni el del costado.
- Un service nunca lee React: recibe la foto de la ejecución.
- Lo que el backend tiene que ver viaja en headers: `sincpro-context` y `traceparent`.

**Dónde vive cada tipo de estado** (detalle y fuentes en la investigación):

| Estado                                                                                                        | Con qué                                                                 | Por qué                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lo que dice el servidor (listas, registros, metas)                                                            | **TanStack Query**, debajo de los hooks — reemplaza a `cachedTransport` | Invalida por clave y **avisa a todo lo montado**: guardar en un modal refresca la lista de la página; dos ventanas que leen lo mismo hacen un pedido; persiste en IndexedDB para el POS |
| Dependencias y niveles (transporte, cliente, ventana)                                                         | **Context de React**, sólo para inyectar                                | Context re-dibuja a todos sus consumidores en cada cambio: es inyección, no un store                                                                                                    |
| Lo que cambia con cada tecla, acotado a una instancia (un registro en edición, el carrito del POS, un wizard) | **Un store por instancia** (Zustand vanilla: `createStore` + Context)   | Selectores sin re-dibujar el formulario entero; nace de las props y se prueba aislado                                                                                                   |
| Lo que la persona eligió (columnas, filtros, vistas guardadas)                                                | Datos — en el servidor, nunca en `localStorage` como verdad             | Viaja con la persona; el framework lo valida                                                                                                                                            |

Las claves de caché salen de una sola fábrica por entidad (`[dominio, entidad, "list", criteria]`,
`[dominio, entidad, "record", id]`, `["meta", dominio, modelo]`) y lo público es
`invalidate(entidad, ids?)`, nunca las claves crudas. Qué otras entidades toca un comando lo debe
publicar el backend; mientras no lo haga, se invalida la entidad y lo que la ruta nombra, como hoy.

## 8. Telemetría y errores, por defecto

Como en sincpro_framework: el autor de una Feature no abre spans ni captura errores; lo hace el
marco.

- **Trazas**: una costura `Tracer` en el `core` (sin dependencia de OpenTelemetry) y un adaptador
  OpenTelemetry (`@opentelemetry/sdk-trace` 3.x, OTLP/HTTP, propagador W3C) en una entrada aparte
  que se carga sin bloquear el primer dibujo: quien no lo usa paga 0 bytes. **Un span por caso de
  uso**, no por clic ni por fetch: nada de auto-instrumentar ni de Zone.js. El transporte escribe
  `traceparent`/`tracestate` sólo hacia orígenes propios (nunca a una pasarela de pago). Se exporta
  al mismo Collector que el backend y mobile; el muestreo y la redacción, en el Collector.
- **Errores**: un gancho `onError(error, { traceId, problem })` que disparan los interceptores, un
  límite de error por ventana y el de la raíz (`createRoot(…, { onUncaughtError })`). El adaptador
  al SDK de Sentry apuntando a **GlitchTip** — el mismo lugar que el backend — va en otra entrada,
  con la recolección de datos restringida por defecto (en un ERP los cuerpos son facturas y
  clientes) y sin el tracing de Sentry (dos trazas por pedido no). Se reporta lo inesperado; un
  `Problem` que el servidor explicó, no.
- **Código de soporte**: el `trace_id` del `Problem` se muestra en `Refused` («código de soporte»),
  con su texto en la tabla de copy.
- **De la aplicación**: el DSN, el endpoint del Collector, las tasas, el release, la subida de
  source maps y el CORS que acepta `traceparent`, `tracestate` y `sincpro-context`.

## 9. Componentes por entidad y extensión

Una entidad sube de nivel sólo cuando lo necesita:

| Nivel                | Qué hay                                                                                                                                                                 | Dónde                            |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **N0**               | Está en el contrato: regenerar y ya tiene lista, registro, picker, ⌘K y comandos, dibujados desde su meta                                                               | Nada, ni carpeta                 |
| **N1 — presentar**   | Cómo se ve: su fila, tarjeta, opción; el control de un campo, tipado por entidad y campo                                                                                | `components/<entidad>/` (su kit) |
| **N2 — insertar**    | Una sección, columna, acción o ficha en un **slot**, `{ after \| before: ancla }`. El ancla la publica el backend (un campo, una sección de los form hints, un comando) | el kit                           |
| **N3 — vista nueva** | Una vista armada con los bloques del framework (`RecordField`, el editor de líneas, `useRecord`), que conservan draft, preview y comandos                               | `entrypoints/views/`             |
| **N4 — reemplazar**  | Una pantalla escrita entera sobre services y hooks                                                                                                                      | `entrypoints/views/`             |

Para dibujar una pieza de una entidad se busca, en orden: la entidad, el `components/` de su
dominio, `common/components`, el default del framework según la meta.

**Precedencia**, de menor a mayor: default del framework < dominio dueño < aplicación < diseño del
tenant (dato) < elección de la persona (dato). Las capas de código se resuelven al arrancar; las de
datos sólo eligen, ordenan y configuran lo que ya existe, validado contra su esquema.

**Lo que mantiene el orden** (lo que hacen SAP Fiori, Power Apps PCF, Salesforce y Backstage, y lo
que no hace Odoo):

- cada extensión tiene un id único; dos con el mismo id en la misma capa son un error al arrancar;
- un override crea algo nuevo; nada muta en global — **nunca `patch()`**: si falta un slot, se
  agrega al framework y se anota en el ROADMAP;
- un ancla que no existe es un error en desarrollo y en los tests, no un «va al final»;
- sólo las listas (secciones, columnas, acciones, fichas) se fusionan, por ancla; en lo demás
  gana la capa de arriba;
- los componentes se asignan por referencia tipada, **nunca un widget nombrado por string**;
- visibilidad y reglas las manda el backend; las variantes van por superficie (página, peek,
  modal, POS, portal) y por aplicación, nunca por rol — los permisos son negocio.

**Widgets** (fichas del home, del POS, bloques del portal, el costado de un registro): los declara
el dominio dueño — id estable (`ventas:widget/por-cobrar`), el host donde puede ir (`Home`,
`PosGrid`, `PortalPage`, `RecordAside`, cada uno con su tipo), su esquema de configuración y su
dato, siempre del servidor (conteos y sumas que el servidor agrega). La aplicación arma el catálogo
de cada host con imports; el diseño del tenant es un dato `{ host, items: [{ id, config, orden }] }`
validado contra ese catálogo. El único string es el id persistido, resuelto contra un catálogo
cerrado y tipado.

## 10. Tiempo real y medios

- **Tiempo real es un entrypoint**, nada más (`entrypoints/live.ts`): una fuente (`LiveSource`,
  SSE primero, con reanudación por `Last-Event-ID`) trae `{ entidad, tipo, ids, model_version }`
  y lo que hace es invalidar — el dato se vuelve a leer por su camino normal. Un registro con
  cambios sin guardar no se pisa: se marca «cambió en el servidor». Entre pestañas, un
  `BroadcastChannel` propio lleva el mismo evento, nunca datos. La fuente del lado del servidor
  es sincpro_framework#201 (eventos por SSE).
- **Medios**: subir con progreso es un adapter (XHR, con una función que firma la URL; multipart
  para lo grande); grabar audio o video (`getUserMedia` + `MediaRecorder`) es un adapter del
  navegador; el reproductor y el grabador son de web-ui; una llamada (WebRTC: SFU, TURN,
  señalización) es de la aplicación, con su señalización como fuente en vivo.

## 11. Los shells: una arquitectura, varias aplicaciones

Los dominios no saben en qué aplicación corren: sin router, sin `window` a nivel de módulo, la
configuración y la sesión entran por los niveles de contexto o los headers del transporte, y sus
services son funciones async puras (un loader de SSR llama la misma Feature).

| Aplicación         | Shell                                                                 | Lo propio                                                                                                                                                                                                                                               |
| ------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backoffice / ERP   | SPA (Vite) + composer (`SincproApp`)                                  | Muchas ventanas a la vez, ⌘K, la UI por defecto desde la meta                                                                                                                                                                                           |
| POS                | SPA + PWA                                                             | Sin conexión: la caché persistida en IndexedDB, las ventas en cola en orden por caja, la clave de idempotencia es el UUID v7 del cliente (`newEntityId`); se vacía al volver `online`/`visibilitychange` (Background Sync no está en Safari ni Firefox) |
| Portal de clientes | SPA; SSR sólo si hace falta                                           | Páginas, no ventanas                                                                                                                                                                                                                                    |
| Ecommerce          | SSR (React Router en modo framework, a evaluar contra TanStack Start) | SEO; nunca rastros a terceros                                                                                                                                                                                                                           |

No hay micro-frontends entre dominios propios: monorepo y carga perezosa por vista. Module
Federation sólo si algún día se instalan extensiones de terceros en tiempo de ejecución.

## 12. Qué da el framework y qué escribe la aplicación

| El framework                                                                                                      | La aplicación                                     |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `Transport` y sus implementaciones; `entity()`; meta y discovery                                                  | Su `common/infrastructure`: base, headers, sesión |
| `Feature` y `ApplicationService` con interceptores; sus Features de entidad                                       | Sus Features y ApplicationServices                |
| Los niveles de contexto; TanStack Query debajo de los hooks; el store por instancia                               | Qué dominios carga cada aplicación                |
| Telemetría y errores: la costura, los adaptadores, el código de soporte                                           | DSN, Collector, muestreo, source maps             |
| La UI por defecto desde la meta (N0) y los slots (N1–N2)                                                          | Sus kits, vistas y widgets                        |
| El shell del backoffice (`SincproApp`)                                                                            | Los shells de POS, portal y tienda, su login      |
| El generador (`sincpro-client generate`, de @sincpro/client-framework) y el andamiaje (`new domain/feature/view`) | `make client`, `make verify-client`               |
| El preset de reglas de import para `make doctor`                                                                  | Correrlo en su CI                                 |

## 13. Lo que ya existe y dónde cae

| Hoy (1.1.0)                                                                                  | En el marco                                                                                       |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `Transport`, `restTransport`, `memoryTransport`                                              | Adapters — se quedan                                                                              |
| `cachedTransport`                                                                            | Lo reemplaza TanStack Query (`invalidate`)                                                        |
| `entity()` con comandos y respuestas tipados, `bodyFor`, `listRoute`                         | Se quedan; la entidad generada es el adapter de cada dominio                                      |
| Meta, discovery por ETag, `relationFieldOf`, `entityFor`, textos                             | Se quedan; la meta pasa a ser una consulta con `staleTime` infinito                               |
| `useListing`, `useRecord`, `useCommand`, `useLookup`, `useHistory`, `useGroups`, `usePivot`… | Su lógica pasa a Features del framework; los hooks quedan como entrypoint de UI, con la misma API |
| `EntityList`, `EntityRecord`, `RecordField`, pickers, líneas, `CommandButton`, `presented`   | Componentes: N0 y N1; `presented` crece hasta el kit                                              |
| `SincproApp`, `entityView`, `listView`, skin                                                 | El shell del backoffice; recibe dominios                                                          |
| `FrameworkProvider`                                                                          | Nivel App                                                                                         |
| `ListScopeProvider`, `RecordOpeningProvider`                                                 | Nivel Ventana                                                                                     |
| `sincpro-client generate`                                                                    | `generated/` por dominio, más el andamiaje                                                        |
| Drafts, preview, conflicto, `newEntityId` (UUID v7), zona horaria, tabla de copy             | Se quedan                                                                                         |
| `make doctor`                                                                                | Más el preset para aplicaciones                                                                   |

**El framework por dentro** mantiene sus entradas publicadas (`.`, `./core`, `./codegen`) y suma:
los servicios y los interceptores (sin React), y dos entradas que nada más importa — la
telemetría y el reporte de errores — igual que hoy el generador.

## 14. Lo que no se hace

- Un bus de eventos de UI al estilo mobile: el refresco entre ventanas es la invalidación de la
  caché, y el tiempo real es un entrypoint.
- Un `dataProvider` CRUD con «custom» para todo lo demás (refine, react-admin): los comandos de
  dominio son de primera clase, tipados desde el contrato.
- Generar código adivinando desde datos de muestra: se genera desde el contrato.
- Control de acceso en el cliente, auditoría en el cliente.
- `patch()`, XPath sobre estructura, registros por string, `force`.
- Un contexto global de 34 miembros (la lección de distribution): cada cosa en su nivel.
- Context como store de estado que cambia seguido.
- Router, `window` o almacenamiento dentro de un dominio.
