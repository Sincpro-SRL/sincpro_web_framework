# PRD_02 · Investigación: lo que sostiene el marco de trabajo

Hecha el 2026-11-05: el código de los repos de Sincpro leído directamente, y la industria con
fuentes (versiones de `npm view` ese día). Lo que una fuente no confirmó se marca. Las decisiones
que salen de aquí están en [`../ARQUITECTURA.md`](../ARQUITECTURA.md) y el plan en
[`PRD_02_marco-de-trabajo.md`](PRD_02_marco-de-trabajo.md).

## 1. Lo que hay en casa

### sincpro_framework (Python) — la referencia más madura

- `Feature` y `ApplicationService` (`sincpro_abstractions.py`) sobre un bus por contexto
  (`UseFramework`); el ApplicationService ejecuta Features con `self.feature_bus(...)`.
- Cada ejecución abre un span `"<bounded_context>/<DTO>"` (`observability/tracing/span_execution.py`)
  con `sincpro.layer`, `sincpro.use_case`, `sincpro.outcome` y las claves del contexto; lo
  inesperado va a GlitchTip por `sentry-sdk`.
- Continúa una traza desde `traceparent` (`with_trace`, `with_parent_trace`); el gateway FastAPI
  copia también `tracestate`, el Starlette no. Las respuestas de problema traen `trace_id`.
- El contexto es un árbol (`GLOBAL → … → FEATURE`) con claves estándar (`user_id`, `tenant_id`,
  `correlation_id`…) y `to_client()`: lo que un frontend devuelve en el header `sincpro-context`.
  La identidad de quien llama vive aparte y no se puede escribir desde el contexto.
- Middleware = interceptores (`@bus.interceptor`), más `on_start`/`on_completion`/`on_failure`.
- **No hay** canal hacia el cliente (ni SSE ni WebSocket); el contrato del cliente no publica
  eventos (`introspection/metamodel.py` los excluye) ni nada de trazas. CORS es del proyecto.
- La guía `sincpro_framework_use_cases`: reusar un caso de uso es ejecutar su Command en el bus;
  un helper que envuelve el bus se salta Sentry y la traza — «el incidente sin nada en Sentry».

### @sincpro/mobile — interceptores, sin bus

- `Feature<Deps>` devuelve un Proxy (`interceptInstance`) que pasa cada método público por hooks
  `before`/`after`/`onError`; `tracingHooks` abre un span `Clase.método`. `ApplicationService`
  recibe sus Features construidas (`framework/feature.ts`, commit `e4607a1`, ya en `main`).
- El span activo vive en un **stack global** (`infrastructure/context_manager`): con dos llamadas
  async a la vez, los padres se cruzan y un pop saca la entrada de otro.
- `createAppShell` no llama `initTelemetry`: en las aplicaciones los spans no hacen nada.
- No existen `Stream`, `RuntimeContext` ni `ServiceRuntime`; el `UIEventBus` (mitt, debounce
  300 ms) y el `EventBus` persistido en SQLite sí.
- Las piezas puras (Feature, interceptores, contexto, `DomainModule`, `UIEventBus`) corren en un
  navegador; el resto arrastra Expo (`DomainEvent` usa `expo-crypto`, `Entity` usa SQLite).

### sincpro_mobile_distribution — la aplicación de referencia de mobile

Un contexto, 9 agregados, unos 285 archivos: `entrypoints/` (41: el módulo y el shell, 29
pantallas en `AppRoutes`, 29 subscribers, 2 crons, migraciones), `domain/` (40, con
`domain/common` para el lenguaje compartido), `adapters/` (23), `services/` (13, unas 3 900
líneas), `ui/` (168: pantallas con su `*.context.tsx`, wizards, componentes atómicos).

- El patrón de pantalla: un Provider con el estado, las llamadas a services y las suscripciones al
  `UIEventBus`; un componente que arma las vistas de mobile-ui; componentes que leen el contexto de
  su pantalla.
- **Lo que no hay que repetir**: un contexto global de 34 miembros (sesión, geo, settings, ruta,
  zona, formato, escáner, servidor…); contextos de wizard de 483 y 506 líneas; un service por
  agregado (`SaleOrderService`: 615 líneas, unos 28 métodos); `UIEventBus.on/off` a mano en cada
  pantalla — su propio roadmap anota que `off()` nunca encuentra el handler envuelto.
- **Lo que no viene a web**: SQLite como verdad, sincronizar con subscribers y crons, una pantalla
  por vez sin URL, wizards a pantalla completa.

### sincpro_web_composer

- `WorkspaceStore`: página, paneles, peek, modales, foco, selección; el estado en el hash de la URL.
- La vista recibe `api` **sólo como prop** (no hay `useApi()`), con `context.focused()`,
  `context.selection()`, `over`, `choosing`, `surface` y los `params` de la `ResourceRef`.
- **No hay** eventos entre vistas ni entre pestañas; el `ErrorBoundary` de `ViewHost` sólo hace
  `console.error`; `StoreOptions.onChange` existe «para telemetría» y nadie lo usa.

### sincpro_forge/web — el único consumidor

- Monta `SincproApp` con el transporte (`Authorization` y `X-Forge-Tenant`), las vistas de
  `entityView` y cinco entidades; las metas salen del documento de discovery.
- Casi todo pasa por el framework; no hay `fetch` crudo. Pero: vistas de 789/462/354 líneas, sin
  `services/` ni `components/`, entidades con su TSX en `adapters/`, un `record_screen` que repite
  `EntityRecord`, permisos (`useAccess`) en las vistas, sin telemetría ni errores, sin el cliente
  generado (usa 1.0.0).

### @sincpro/web-framework

- Sin trazas, sin reporte de errores, sin tiempo real.
- `cachedTransport` olvida al escribir pero **no avisa**: cada componente recarga su propia lista
  (`rowCommands.ts`, `RelatedList.tsx`); guardar en un modal no refresca la página.
- `useRecord` (530 líneas) mezcla 25 llamadas a hooks de React con 5 llamadas al transporte: un
  caso de uso que sólo se puede ejecutar desde una pantalla.

## 2. Telemetría y errores en el navegador

- **OpenTelemetry JS 3.0.0** (20-oct-2026) eliminó `sdk-trace-web`/`sdk-trace-base`; el paquete es
  `@opentelemetry/sdk-trace` (3.1.0) con `StackContextManager`. Las instrumentaciones de fetch/XHR
  clásicas están deprecadas y las nuevas (`opentelemetry-browser`) son 0.x experimentales; la guía
  oficial aún dice «experimental and mostly unspecified».
  [releases](https://github.com/open-telemetry/opentelemetry-js/releases) ·
  [v3.0.0](https://github.com/open-telemetry/opentelemetry-js/releases/tag/v3.0.0) ·
  [opentelemetry-browser](https://github.com/open-telemetry/opentelemetry-browser) ·
  [guía](https://opentelemetry.io/docs/languages/js/getting-started/browser/)
- Contexto async en el navegador: Zone.js es lo único que sobrevive un `await` (parchea globales);
  AsyncContext de TC39 sigue en Stage 2. → **pasar el contexto explícito** y que el transporte
  escriba `traceparent`.
  [AsyncContext](https://tc39.es/proposal-async-context/)
- Exportar sólo OTLP/HTTP a un Collector propio con `cors.allowed_origins`; muestreo y redacción en
  el Collector; `sampled=00` desde el navegador hace que el backend (`ParentBased`) descarte.
  [otlpreceiver](https://github.com/open-telemetry/opentelemetry-collector/blob/main/receiver/otlpreceiver/README.md)
- **Sentry JS 11.11 → GlitchTip**: errores, breadcrumbs, source maps (debug IDs), releases y logs
  funcionan; replay, trazas distribuidas y transacciones de carga no. El span streaming de v11 no
  lo lee GlitchTip. `dataCollection` recolecta más por defecto (headers, cookies, bodies, IP): en
  un ERP hay que restringirlo. No mezclar `browserTracingIntegration` con OpenTelemetry propio.
  [GlitchTip CLI](https://glitchtip.com/documentation/cli) ·
  [comparación](https://betterstack.com/community/comparisons/sentry-vs-glitchtip/) ·
  [v10→v11](https://docs.sentry.io/platforms/javascript/migration/v10-to-v11/) ·
  [opciones](https://docs.sentry.io/platforms/javascript/guides/react/configuration/options/) ·
  [React](https://docs.sentry.io/platforms/javascript/guides/react/usage/)
- **Grafana Faro 2.13**: errores, logs, Web Vitals, sesiones, replay; sus trazas siguen en OTel 2.x
  (lo que 3.0 eliminó); protocolo propio vía Alloy. Útil sólo si se quiere RUM completo en Grafana,
  y aun así con GlitchTip para los errores.
  [changelog](https://raw.githubusercontent.com/grafana/faro-web-sdk/main/CHANGELOG.md) ·
  [faro.receiver](https://grafana.com/docs/alloy/latest/reference/components/faro/faro.receiver/)

**Adoptar**: span por caso de uso con el nombre del backend, `traceparent` escrito por el
transporte, OTel en entrada aparte y perezosa, Sentry SDK → GlitchTip sólo para errores,
recolección restringida, `trace_id` como código de soporte. **Evitar**: auto-instrumentar,
Zone.js, dos SDKs de trazas, cuerpos de formulario como atributos.

## 3. Estado y caché

| Paquete                   | Versión             | gzip    |
| ------------------------- | ------------------- | ------- |
| `@tanstack/react-query`   | 5.106.1             | 13,3 kB |
| `zustand`                 | 5.0.16              | 0,5 kB  |
| `jotai`                   | 3.0.1               | 3,3 kB  |
| `swr`                     | 2.5.1               | 5,7 kB  |
| `@reduxjs/toolkit`        | 2.14.0              | 14,6 kB |
| `@refinedev/core`         | 5.0.12 (abril 2026) | —       |
| `react-admin` / `ra-core` | 5.15.5              | —       |
| `@tanstack/db`            | 1.0.0-rc.1.3        | —       |

- **TanStack Query**: claves jerárquicas; `invalidateQueries` por prefijo marca viejo y vuelve a
  pedir sólo lo montado — lo que le falta a `cachedTransport`. Deduplica, distingue
  `isPending`/`isFetching`, `placeholderData`, mutaciones optimistas y en serie por `scope.id`,
  Suspense, devtools; persiste en IndexedDB (`persistQueryClient`, `setMutationDefaults`,
  `resumePausedMutations`). Es el único de los comparados con mutaciones sin conexión.
  [invalidación](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation) ·
  [mutaciones](https://tanstack.com/query/latest/docs/framework/react/guides/mutations) ·
  [persistencia](https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient) ·
  [comparación](https://tanstack.com/query/latest/docs/framework/react/comparison)
- `broadcastQueryClient` (entre pestañas) es experimental y rompe en menores: mejor un
  `BroadcastChannel` propio con eventos de invalidación.
  [broadcast](https://tanstack.com/query/latest/docs/framework/react/plugins/broadcastQueryClient)
- **Context es inyección, no estado**: cada consumidor se re-dibuja en cada cambio.
  [Erikson](https://blog.isquaredsoftware.com/2021/01/context-redux-differences/) ·
  [TkDodo](https://tkdodo.eu/blog/zustand-and-react-context)
- **Un store por instancia**: Zustand `createStore` + Context + `useState(() => createStore(props))`.
  [Zustand](https://zustand.docs.pmnd.rs/learn/guides/initialize-state-with-props)
- **refine** (v5: React 19, TanStack Query v5): providers como objetos planos (data, auth,
  notification, i18n, router, live, auditLog); `liveProvider` convierte eventos en invalidación
  (`liveMode` auto/manual/off). El core no publica desde abril de 2026.
  [v5](https://refine.dev/blog/refine-v5-announcement) ·
  [live](https://refine.dev/docs/realtime/live-provider/) ·
  [invalidate](https://refine.dev/docs/data/hooks/use-invalidate/)
- **react-admin**: `ra-core` headless con dos UIs (MUI y Shadcn); `mutationMode` undoable;
  `addOfflineSupportToQueryClient`; el tiempo real es de pago; los Guessers «no en producción».
  [ra-core](https://marmelab.com/ra-core/features/) ·
  [realtime](https://marmelab.com/react-admin/Realtime.html) ·
  [ListGuesser](https://marmelab.com/react-admin/ListGuesser.html)
- Lo que hacen mal y aquí no: comandos de dominio como «custom» sin tipos ni invalidación,
  generación adivinando desde datos, control de acceso en el cliente.
- **TanStack DB** (1.0 RC1, 29-oct-2026): consultas vivas sobre colecciones del cliente — choca con
  «nunca filtrar en la página», salvo subconjuntos acotados (el catálogo del POS).
  [RC1](https://tanstack.com/blog/tanstack-db-1.0-rc1-going-all-in-on-oracles)

## 4. UIs empresariales guiadas por metadatos y su extensión

- **SAP Fiori elements + FPM**: anotaciones → List Report / Object Page; columnas, secciones y
  acciones propias con `position: { placement, anchor }` sobre claves estables; building blocks
  que conservan draft y side effects; «la Extension API como única interfaz soportada»; capas
  VENDOR → CUSTOMER → USER (el orden exacto de capas, de conocimiento previo). Punto débil:
  encontrar el ancla inspeccionando el DOM.
  [extension points](https://learning.sap.com/courses/developing-an-sap-fiori-elements-app-based-on-a-cap-odata-v4-service/using-extension-points_d613eea6-2548-4db3-a7c1-2ef9b52653b5) ·
  [anclas](https://github.com/SAP-docs/sapui5/blob/main/docs/06_SAP_Fiori_Elements/finding-the-right-key-for-the-anchor-6ffb084.md) ·
  [FPM](https://learning.sap.com/courses/developing-an-sap-fiori-elements-app-based-on-a-cap-odata-v4-service/getting-an-overview-of-the-flexible-programming-model_fc9ea1ee-20a8-4add-b3f9-c8c8e3701ae0)
- **Power Apps PCF**: el control declara sus propiedades `bound`/`input`/`output` con un tipo de
  campo; capas managed/unmanaged; los formularios se fusionan por sección y el conflicto cae en
  una pestaña generada.
  [manifest](https://learn.microsoft.com/en-us/power-apps/developer/component-framework/manifest-schema-reference/property) ·
  [capas](https://learn.microsoft.com/en-us/power-platform/alm/solution-layers-alm)
- **Odoo (OWL)**: registros por string con `force`, `patch()` que muta en global, herencia de
  vistas por XPath: todo extensible, y ahí empieza el caos (orden de carga, `replace`, XPath que
  se rompe al actualizar).
  [registries](https://www.odoo.com/documentation/18.0/developer/reference/frontend/registries.html) ·
  [patch](https://www.odoo.com/documentation/18.0/developer/reference/frontend/patching_code.html)
- **Salesforce LWC**: el componente declara dónde puede ir (`targets`) y qué configura el admin;
  la página le inyecta `recordId`; se elige la página de la más específica a la menos.
  [App Builder](https://developer.salesforce.com/docs/platform/lwc/guide/use-config-for-app-builder.html)
- **Backstage, sistema de frontend nuevo** (RC 1.0 en 1.49): extensión = id + `attachTo` + output
  tipado + `configSchema`; un id por extensión; el override crea otra sin mutar; componentes
  intercambiables por referencia tipada.
  [extensions](https://backstage.io/docs/frontend-system/architecture/extensions) ·
  [overrides](https://backstage.io/docs/frontend-system/architecture/extension-overrides) ·
  [swappable](https://backstage.io/docs/frontend-system/building-plugins/swappable-components)

**Copiar**: id + slot + contrato tipado (Backstage); ancla con `placement` y bloques que conservan
el comportamiento (Fiori); el control tipado por tipo de campo (PCF); el componente que declara
dónde puede ir (Salesforce); capas ordenadas con la personalización como dato. **Evitar**:
`patch()`, XPath, registros por string con `force`, anclas buscadas en el DOM, reglas de
visibilidad en la UI, variantes que se forkean.

## 5. Arquitectura para varias aplicaciones

- **Feature-Sliced Design 2.1**: capas app → pages → widgets → features → entities → shared, un
  slice no importa otro de su capa, API pública por slice. Se toma la API pública, el «pages-first»
  y la idea de widget; no se toman sus nombres de capa — su «feature» es una interacción con UI y
  aquí una Feature es un caso de uso sin UI.
  [layers](https://feature-sliced.design/docs/reference/layers) ·
  [public API](https://feature-sliced.design/docs/reference/public-api) ·
  [excessive entities](https://feature-sliced.design/docs/guides/issues/excessive-entities)
- **Hacer cumplir fronteras**: workspaces estrictos de pnpm (entre packages) + dependency-cruiser
  (grafo resuelto, reglas por carpeta, CLI) desde `make doctor`; eslint-plugin-boundaries si se
  quiere aviso en el editor; las reglas de Nx necesitan proyectos y Conformance es de pago.
  [dependency-cruiser](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md) ·
  [boundaries](https://www.jsboundaries.dev/)
- **Repos**: la plataforma (criteria, web-ui, composer, web-framework) sigue publicada; cada
  producto con varias aplicaciones, un monorepo con pnpm (catálogos para una versión de React y
  web-ui) y un package compilado por dominio.
  [catalogs](https://pnpm.io/11.x/catalogs) ·
  [internal packages](https://turborepo.dev/docs/core-concepts/internal-packages)
- **Shells**: Vite SPA para backoffice y POS; PWA con outbox idempotente (Background Sync sólo en
  Chromium); portal en SPA salvo que haga falta SSR; tienda con SSR — React Router en modo
  framework, a evaluar contra TanStack Start (su 1.0 estable se confirmó en una fuente
  secundaria); Next.js App Router no como default (todo hook pide `"use client"`).
  [Background Sync](https://caniuse.com/background-sync) ·
  [React Router](https://remix.run/blog/react-router-v8) ·
  [TanStack Start](https://tanstack.com/start/latest/docs/framework/react/comparison) ·
  [Next.js](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- **Micro-frontends** (Module Federation 2.0 estable): no entre dominios propios; sólo para
  extensiones de terceros instaladas en tiempo de ejecución.
  [MF 2.0](https://www.infoq.com/news/2026/04/module-federation-2-stable)
- **Andamiaje**: extender el generador propio, que ya lee el contrato, en vez de plop/hygen.
- **DDD en el frontend**: los hooks son adaptadores finos sobre los casos de uso, y los casos de
  uso se prueban en Node con un transporte falso.
  [FSD + clean](https://feature-sliced.design/blog/frontend-clean-architecture) ·
  [Sperl 2026](https://www.benedikt-sperl.de/blog/2026-03-16-domain-driven-design-in-frontend-applications)

## 6. Tiempo real y medios

- **SSE** primero: reconecta solo, reanuda con `Last-Event-ID`, sin límite de conexiones sobre
  HTTP/2-3; `EventSource` no manda headers (cookie, ticket corto o el paquete `eventsource` v4
  con un `fetch` propio); heartbeats y `X-Accel-Buffering: no` en proxies. WebSocket para chat o
  colaboración; WebTransport aún no para un ERP. El patrón: el servidor empuja un evento chico y
  el cliente invalida y vuelve a leer.
  [eventsource](https://github.com/EventSource/eventsource) ·
  [SSE](https://websocket.org/comparisons/sse/) ·
  [TkDodo](https://tkdodo.eu/blog/using-web-sockets-with-react-query)
- **Subidas**: presigned PUT, multipart para lo grande (Uppy 6); tus si hace falta reanudar de
  verdad. `fetch` sigue sin progreso de subida: XHR con `upload.onprogress`. Captura con
  `getUserMedia` + `MediaRecorder` (webm/opus, luego mp4/AAC). WebRTC necesita SFU, TURN y
  señalización: es de la aplicación.
  [Uppy S3](https://uppy.io/docs/aws-s3/) ·
  [request streams](https://caniuse.com/wf-fetch-request-streams)
