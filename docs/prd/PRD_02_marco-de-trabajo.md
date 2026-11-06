# PRD_02: el marco de trabajo — una arquitectura para toda aplicación web de Sincpro

- **Estado**: 2026-11-05, propuesta para validar. La arquitectura está en
  [`../ARQUITECTURA.md`](../ARQUITECTURA.md); la investigación con sus fuentes en
  [`PRD_02_investigacion.md`](PRD_02_investigacion.md).
- **Repos**: este (el grueso), `sincpro_framework` (eventos por SSE, entidades afectadas, CORS),
  `sincpro_web_composer` (error por ventana), `sincpro_mobile` (contexto por llamada),
  `sincpro_internal_mcp` (la guía: `common`), `sincpro_forge/web` (primer adoptante).

## El problema

Lo hecho hasta hoy es la capa de entidades: leer, buscar, editar y actuar sobre lo que el servidor
publica, y el cliente generado desde el contrato. Funciona y está publicado (sincpro_framework
3.32.0, criteria 1.1.0, web-framework 1.1.0). Lo que falta es el **marco**: dónde vive la lógica de
una aplicación, cómo se separan los dominios, cómo se extiende sin desordenar, y lo que el backend
da gratis y la web no tiene — telemetría y errores.

Lo dice forge, el único consumidor:

- Las vistas son archivos enormes con todo junto: `project_views.tsx` tiene 789 líneas y 11
  componentes que mezclan estado, llamadas y dibujo.
- No hay `services/` ni `components/`; las entidades se declaran con su presentación (TSX) en
  `adapters/`.
- `shared/record_screen.tsx` repite, por su propio comentario, «los mismos pasos que
  `EntityRecord`».
- Sin telemetría, sin reporte de errores; una escritura en una ventana no refresca otra.

Y lo dice distribution, la aplicación de referencia de mobile (ver la investigación): un contexto
global de 34 miembros, contextos de pantalla de 300 a 500 líneas escritos a mano, un service por
agregado de 600 líneas y suscripciones a eventos escritas pantalla por pantalla.

## Objetivos

1. **Una sola arquitectura** para backoffice, POS, portal y ecommerce, con el vocabulario de
   sincpro_framework (`entrypoints/`, `domains/<ctx>/{domain,adapters,services,infrastructure,entrypoints}`,
   `domains/common`) más `components/`.
2. **Toda la lógica en servicios** — `Feature` y `ApplicationService` con interceptores, como
   mobile — que dan **telemetría y errores por defecto**, con la traza continuada en el backend.
3. **Estado sin inventar**: TanStack Query para lo del servidor, Context para inyectar, un store por
   instancia para lo que cambia con cada tecla.
4. **Extender con orden**: N0 (cero código) → N1 (presentar) → N2 (slots con ancla) → N3 (vista) →
   N4 (reemplazar), con precedencia determinista y widgets declarados por el dominio dueño.
5. **Rápido de replicar**: del contrato a una entidad funcionando sin código; andamiaje para un
   dominio, una Feature o una vista en un comando; reglas de import que fallan en CI.

## Fuera de alcance

- Un bus de eventos de UI; micro-frontends entre dominios propios.
- Permisos, roles y grupos: son negocio y viven en el backend.
- Reglas de negocio en el cliente; control de acceso o auditoría en el cliente.
- Los shells de POS, portal y tienda como producto: el marco los hace posibles; construirlos es de
  cada producto.

## Fases

Cada fase termina en algo que falla hoy: un test en `tests/` para la lógica, una historia con
`play` para el caso de uso. La aplicación de referencia — un ERP chico (`common`, ventas,
inventario) sobre el servidor en memoria — nace en la fase 1 y crece en cada una: es la historia
que manda, y lo que no se pueda escribir limpio en ella es una pieza que le falta al marco.

| Fase                               | Qué                                                                                                                                                                                                                                                                                | Termina cuando                                                                                                                                                                                                                                 |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0 — Marcar**                     | Validar `ARQUITECTURA.md`; llevarla a `PURPOSE.md` y `AGENTS.md`; corregir la guía de Sincpro (`common`)                                                                                                                                                                           | Las decisiones abiertas (abajo) contestadas                                                                                                                                                                                                    |
| **1 — Servicios, traza y errores** | `Feature` y `ApplicationService` con interceptores (API de mobile, contexto por llamada); la costura `Tracer`; el adaptador OpenTelemetry y el de errores (Sentry SDK → GlitchTip) en entradas aparte; el transporte escribe `traceparent`; `Refused` muestra el código de soporte | Un ApplicationService con dos Features da spans anidados `<dominio>/<Feature>` y el pedido sale con `traceparent` de la misma traza; un error inesperado se reporta con su `trace_id` y un 409 no; dos llamadas a la vez no se cruzan de padre |
| **2 — Estado**                     | TanStack Query debajo de los hooks (misma API), la fábrica de claves e `invalidate`; las lecturas, escrituras y comandos de entidad como Features del framework; el store por instancia del registro; se retira `cachedTransport`                                                  | Las historias siguen verdes; una nueva: guardar en un modal refresca la lista de la página; dos ventanas que leen lo mismo hacen un pedido                                                                                                     |
| **3 — Dominios y niveles**         | La instancia por dominio (cliente, services, kits, vistas, widgets, fuentes en vivo); `SincproApp` recibe dominios; el nivel Ventana para los componentes; el generador escribe `generated/` por dominio; la aplicación de referencia completa sus dos dominios                    | La referencia corre en CI con dos dominios que se relacionan por referencia, sin importarse                                                                                                                                                    |
| **4 — Extensión**                  | El kit por entidad (N1), los slots con ancla (N2), widgets con hosts tipados y catálogo, el diseño del tenant como dato validado, ids únicos y precedencia                                                                                                                         | Una historia por nivel; un ancla inexistente y un id repetido fallan en los tests                                                                                                                                                              |
| **5 — Orden automático**           | El preset de reglas de import (dependency-cruiser) para el `make doctor` de las aplicaciones; el andamiaje: `sincpro-web new domain`, `new feature`, `new view`                                                                                                                    | Un dominio creado con el andamiaje pasa el doctor; uno que importa otro dominio no                                                                                                                                                             |
| **6 — Tiempo real y medios**       | `LiveSource` (SSE con `Last-Event-ID`) que invalida; `BroadcastChannel` entre pestañas; la pieza de subida con progreso                                                                                                                                                            | Un cambio hecho «por otro» refresca el registro abierto, y uno con cambios sin guardar se marca en vez de pisarse                                                                                                                              |
| **7 — forge adopta**               | Vistas a `entrypoints/views/`, piezas a `components/`, lógica a `services/`, entidades a `generated/`, `record_screen` reemplazado por el framework, telemetría y errores encendidos                                                                                               | forge sin `shared/record_screen.tsx` y con trazas de punta a punta                                                                                                                                                                             |

Los shells de POS (PWA sin conexión: caché persistida, ventas en cola por caja, idempotencia por
UUID v7) y de portal/tienda (SSR) entran cuando un producto los pida; el marco ya los contempla
(ARQUITECTURA §11).

## Lo que se pide a otros repos

| Repo                 | Qué                                                                                                                                             | Para                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| sincpro_framework    | Eventos por SSE (#201) con `Last-Event-ID`                                                                                                      | Fase 6                                    |
| sincpro_framework    | Qué entidades toca un comando, en el contrato o en la respuesta                                                                                 | Invalidar sin adivinar (fase 2)           |
| sincpro_framework    | Documentar el CORS de `traceparent`, `tracestate` y `sincpro-context`; `tracestate` también en el gateway Starlette (hoy sólo FastAPI lo copia) | Fase 1                                    |
| sincpro_web_composer | `onError` en el límite de error de cada vista (`ViewHost` hoy sólo hace `console.error`)                                                        | Fase 1                                    |
| sincpro_mobile       | El span activo por llamada en vez del stack global; nombrar los spans `<dominio>/<Feature>`                                                     | Las mismas trazas en las tres plataformas |
| sincpro_internal_mcp | `sincpro_architecture_guidelines` §3.1 y §6: `common`                                                                                           | Fase 0                                    |

## Decisiones abiertas

1. **TanStack Query debajo de los hooks**, reemplazando `cachedTransport` (recomendado: es lo que
   hacen refine y react-admin, y resuelve el refresco entre ventanas).
2. **Zustand (vanilla) para el store por instancia** — registro en edición, carrito, wizard —
   contra `useState`/`useReducer` (recomendado: 0,5 kB, selectores, aislado por instancia).
3. **Las trazas al Collector que ya usan backend y mobile**: ¿cuál es y quién lo opera?
4. **La aplicación de referencia dentro de este repo** (recomendado: corre en CI sin backend) o
   forge directamente.
5. **Monorepo por producto** (workspaces de pnpm) cuando haya más de una aplicación.

## Riesgos

- **TanStack Query acopla versiones** (react-admin tuvo que corregir una incompatibilidad en una
  menor): va como peerDependency, con la API de los hooks como frontera — las claves no son
  públicas.
- **OpenTelemetry para navegador está en movimiento** (3.0 eliminó `sdk-trace-web`; las
  instrumentaciones nuevas son 0.x): sólo se usa el SDK de trazas y el exporter, con versiones
  fijas, y nada de auto-instrumentación.
- **GlitchTip no lee el span streaming** del SDK 11 de Sentry: se usa sólo para errores; las trazas
  van por OpenTelemetry.
- **Un marco demasiado cerrado**: cada nivel sigue pudiendo saltarse (PURPOSE: «defaults, nunca
  jaulas»); N4 existe a propósito.
