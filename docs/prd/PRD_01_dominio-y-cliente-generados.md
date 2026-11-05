# PRD_01: el dominio y el cliente, generados desde el contrato del servicio

- **Estado**: 2026-11-05, en `feat/typed-commands`, sin commitear.
  - **Fase A construida** (`docs/ROADMAP.md`, «Comandos tipados y el núcleo sin React»).
  - **Fase B construida** contra el contrato de sincpro_framework #243 y #244 (`bounded_context`,
    `alias`, valores con nombre; un contrato de 3.32 con `context` también se lee): `domain.ts`,
    `client.ts`, `entities.ts`, `contract.json`, `--domain`, `--base`, `metasOf`, `target` /
    `bodyFor`, y la historia 40 («Generado desde el contrato» en el ROADMAP). Queda fuera
    `onVersionDrift`, que espera un diseño (una `Meta` no lleva su versión).
  - **Fase C, en parte:** README («From the contract»), ROADMAP y `AGENTS.md` al día. Falta
    leer el contrato vivo (`/client-contract/<ctx>.json`) desde el transporte y dibujar las
    claves con `relation` como many2one.
- **Lo encontró**: la consola de forge. Escribe a mano los tipos del cable (225 líneas en
  `web/src/domains/*/domain/*.ts`), cada ruta y cada Command (`adapters/forge_*.tsx`), y se
  desfasan: `revokeShare` sigue armando su ruta a mano aunque `pathFor` ya llena cualquier
  `{clave}` desde el cuerpo.
- **Depende de**: sincpro_framework **PRD_33** (el contrato del cliente: el papel de cada
  operación, su entrada y su salida, exportado en crudo con los bindings de cada port). La fase A
  de este PRD no depende de nada.
- **Habilita**: forge `docs/27-consola-desde-el-contrato.md` (iteración 8).
- **Filosofía**: lo que dice `docs/PURPOSE.md` — _«para que cada app no escriba su propio
  cliente»_. El backend exporta JSON; este paquete lo convierte en código que una persona y una IA
  leen en el repo. El código generado es una **foto** para programar mejor. La verdad sigue
  siendo el contrato vivo, que el transporte ya lee y revalida por `model_version`.

## El mapa: qué va en cada repositorio

| Repositorio                                | Qué pone                                                                                                                                                                         | Documento                              |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `sincpro_framework`                        | El papel, la entrada y la salida de cada operación (derivados de `Get`/`Search`/`Edit`/… y de `@entity_tags`), y el export en crudo con los bindings de cada port. **Solo JSON** | `docs/prd/PRD_33_client-contract.md`   |
| `@sincpro/web-framework` (este)            | Los comandos tipados, el subpath `/core` y **el generador**: dominio (DTOs), cliente y `entity()`                                                                                | este PRD                               |
| `sincpro_forge`                            | El primer consumidor: `make contract` en el backend, `make client` / `make verify-client` en la consola, y borrar lo escrito a mano                                              | `docs/27-consola-desde-el-contrato.md` |
| `@sincpro/criteria`                        | **Nada.** Ya lee los modelos (`metaFromContract`) y `criteria<T>()` ya chequea campos con el `T` generado. No conoce rutas ni comandos, y no tiene que conocerlos                | —                                      |
| `@sincpro/web-ui`, `@sincpro/web-composer` | Nada                                                                                                                                                                             | —                                      |

**Sin paquete nuevo por ahora.** `src/core/` ya tiene la forma de uno compartido (sólo importa
`@sincpro/criteria`, sin React ni DOM, y `make doctor` lo garantiza). Cuando haya un consumidor
fuera de la web — la app Expo, un script de Node, Python —, `core/` y `codegen/` se mueven a un
paquete propio. Moverlos es mover carpetas, no rediseñar. Antes de eso, un paquete más son dos
releases para un solo consumidor.

## Problema

1. **Los tipos se escriben a mano** y `criteria<T>()` chequea campos sólo tan bien como ese `T`.
2. **Las rutas y los comandos se declaran a mano** en cada `entity()`, aunque el backend ya sabe
   qué operación lista, lee, edita o actúa sobre cada entidad.
3. **Los comandos no tienen tipos.** `useCommand(issues, "send").run(id, body)` toma el nombre
   como texto y el cuerpo como `AnyRecord` (`src/react/useCommand.ts:25`). `Entity<T>` sólo lleva
   el tipo del registro (`src/core/entity.ts:25`). Un nombre o un cuerpo mal escrito lo descubre
   el servidor, en runtime.
4. **El paquete sólo exporta `.`.** Un script o un test de Node que quiera el transporte arrastra
   React.

## Lo que ya existe y se reusa

`entity()` y `EntityRoutes`, `pathFor` (las claves de la ruta salen del cuerpo), `restTransport`
(lee el documento y lo vuelve a pedir cuando una respuesta trae otro `model_version`),
`FrameworkProvider metas` (precarga de metas), `presented()` (cómo se ve un registro), `newEntityId`
(UUID v7 para `edit`) y `make doctor` (los niveles no suben).

## La especificación

**DEBE**, **NO DEBE**, **DEBERÍA**, **PUEDE**, como MUST / MUST NOT / SHOULD / MAY del RFC 2119.

### 1. Comandos tipados — `Entity<T, C>` (fase A)

- `entity<T, C>(key, routes)`. `C` es un mapa de nombre de comando a cuerpo:
  `{ send: { message: string }; stop: Record<string, never> }`.
- `useCommand(e, name)` **DEBE** aceptar sólo `keyof C`, y `run(id, body)` y la prueba en seco
  **DEBEN** tomar `C[name]`. `CommandButton` lo mismo.
- `C` **DEBE** tener por defecto la forma suelta de hoy, así ninguna pantalla se rompe. Un tipo
  escrito a mano sirve igual que uno generado.
- Un test de tipos (`@ts-expect-error`) por un nombre que no existe y un cuerpo equivocado.

### 2. El subpath `@sincpro/web-framework/core` (fase A)

- `package.json` **DEBE** exportar `./core` → `src/core/index`. Es lo que importa el `client.ts`
  generado. `make doctor` ya asegura que no trae React.

### 3. El generador (fase B)

- Un `bin`: `sincpro-web generate <contrato.json | url> --out src/generated/<contexto>` (el nombre
  está abierto).
- Vive en **`codegen/`**, fuera de los niveles de `src/`: es Node y lee archivos. **PUEDE**
  importar `src/core/` y Node; **nada** de `src/` lo importa. `AGENTS.md` suma esa fila a «Where
  things go» y `make doctor` la regla.
- Lee el **metamodelo** de PRD_33 (`export_metamodel`, con los bindings de su fase 2) y escribe,
  **por contexto**:

| Archivo                      | Qué tiene                                                                                                                                                                                                                                        | Depende de                    | Nivel             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- | ----------------- |
| `domain.ts` — **los DTOs**   | un tipo por modelo (un enum es una unión de literales, un nullable `\| null`) y uno por entrada y salida de cada operación; la `description` del backend como JSDoc; la versión y «no editar» en el encabezado. **Sólo tipos**                   | nada                          | todos             |
| `client.ts` — **el cliente** | `operations` como datos (papel, `query`, entidades, `targets`, bindings por port) y `<contexto>Client(transport)` con métodos tipados por entidad: lecturas por su papel (`search(criteria)`, `get(id)`, `getMany(ids)`), comandos por su nombre | `@sincpro/web-framework/core` | 3, piezas sueltas |
| `entities.ts`                | un `entity<T, C>(key, routes)` por entidad: `list` ← su `search`, `one` ← su `get`, `edit`, `preview`, `commands` ← los comandos que la conciernen, `aggregate` ← su modelo                                                                      | `@sincpro/web-framework`      | 1 y 2             |
| `contract.json`              | la foto: `metasOf(contract)` la da a `FrameworkProvider metas`, y el transporte revalida                                                                                                                                                         | —                             | —                 |

- La clave de una entidad es `<contexto>:<entidad en snake_case>` (`project:issue`), la misma que
  forge usa hoy.
- **DEBE** escribir los mismos bytes para el mismo contrato: el diff se lee y CI lo compara.
- **NO DEBE** adivinar. Una operación sin un papel que `entity()` use queda en el cliente, pero no
  en `entities.ts`. Una entidad con dos operaciones del mismo papel no elige ninguna, y lo dice
  (PRD_33, preguntas abiertas).
- **NO DEBE** escribir fuera de `--out`, y reemplaza esa carpeta entera.

#### 3.1 Cómo lee el contrato

Según el brief de la fase 1 de PRD_33 (2026-11-05), que corrigió la primera forma:

- **La fuente es el metamodelo, no el OpenAPI.** El OpenAPI sigue publicando `Get`, `GetMany`,
  `LiteralSearch` y `PreviewEntity` como POST no idempotentes, para no mover rutas existentes.
  `query`, `targets` y `values` sólo están en el metamodelo.
- **Identidad.** Las operaciones están indexadas por `"<context>.<Clase>"`, y el campo raíz es
  `context`. El nombre local (de donde sale el del método) es la clave sin `context + "."`.
- **`$defs`.** Cada nombre sale de su clase. Si dos clases distintas comparten nombre, ambas se
  califican por módulo (`shop__orders__Line`). Hay que sanearlos a identificadores válidos de
  TypeScript (`-` → `_`). Que un tipo cambie de nombre porque apareció otra clase homónima es
  un error de compilación esperado; una forma distinta bajo el mismo nombre no pasa nunca.
- **`targets`** (`{"Issue": "issue_id"}`). `run(id, body)` pone `body[targets[Entidad]] = id`.
  En REST, el generador escribe ese segmento como `{id}` en la ruta que le da a `entity()`: el
  servidor lee el segmento como ese campo, así que `pathFor` no cambia. Una entidad que no está
  en `targets` no tiene registro destino: es un `search`, un `get_many` o un comando que la crea.
  **NO DEBE** adivinarse.
- **`values`** de `edit` y `preview` es `#/models/<Entidad>`: el registro entero, tipado.
- **`query: true`**: reintentar o cachear es seguro. Con `false`, la operación va con su
  `Idempotency-Key`, como hoy.
- **`one`** se genera sólo si el `get` está ligado como `GET` con su clave en la ruta, porque
  `Transport.one` lee con GET. Un `get` ligado como POST queda en el cliente, pero no en
  `entities.ts`. Es un hueco del framework: `rest.get` exige `Query` (forge `docs/26` §5).
- **`x-sincpro.detail` / `search` sin sus valores por defecto.** Una clave ausente vale su
  default. `readCriteria` y `searchedFields` (`src/web/list/search.ts`) ya lo toleran.
- Los suscriptores de eventos ya no están en `operations`. El historial es el papel `events`.

### 4. Permisivo en runtime (fase B)

- Lo generado es una foto. Si una respuesta trae un `model_version` distinto del de la foto, el
  transporte **DEBE** avisarle una vez a quien programa (`onVersionDrift`, por defecto un aviso
  en la consola en desarrollo), y **NUNCA** dar error.
- Un campo que la foto no conoce llega igual, y la meta viva lo dibuja.
- Una operación que la foto no tiene se consigue regenerando.

### 5. Extender sin editar lo generado

Lo generado no se edita nunca. Se extiende por composición, en un archivo propio:

```ts
import { issues as generated } from "@app/generated/project/entities";
import type { Issue as Wire } from "@app/generated/project/domain";

export type Issue = Wire & {/* lo que el contrato todavía no dice */};
export const issues = presented(generated, { row: (i) => ({ meta: i.status }) });
```

Una ruta se reemplaza con un spread (`entity(key, { ...routesOf.issue, history: … })`). Cada
nivel conserva su salida, como pide «Defaults, never cages».

### 6. Historias y tests

- `stories/support/forge.client-contract.json`, **copiado del export de un forge corriendo**
  (como `forge-openapi.json`), y `stories/support/generated/forge/`, generado desde él.
- El servidor en memoria (`stories/support/servidor.ts`) **DEBE** hablar las rutas del contrato.
- Una historia con `play` que abre la lista de issues, abre uno y corre `send`, todo con lo
  generado, sin una ruta escrita a mano. Hay que probar que el `play` falla sin las rutas
  generadas.
- Tests en `tests/`: regenerar a una carpeta temporal da los mismos bytes que lo guardado; tipos
  (`criteria<Project>()` rechaza un campo que no existe, un comando rechaza un cuerpo equivocado).

### 7. Fases

| Fase  | Qué                                                                                                   | Depende de              |
| ----- | ----------------------------------------------------------------------------------------------------- | ----------------------- |
| **A** | §1 comandos tipados, §2 subpath `/core`                                                               | nada — puede empezar ya |
| **B** | §3 generador, §4 aviso de versión, §6 historia y tests                                                | PRD_33, fases 1 y 2     |
| **C** | README (un nivel más: «desde el contrato»), `docs/ROADMAP.md`, `AGENTS.md` (`codegen/` y sus trampas) | B                       |

## Fuera de alcance

- Python y la app Expo: son el disparador para mover `core/` y `codegen/` a un paquete propio,
  no trabajo de este PRD.
- Quién puede qué (permisos): es negocio, `docs/PURPOSE.md`.
- El layout de una pantalla: es de la pantalla.

## Decisiones

- **El generador vive acá** porque escribe la API de este paquete (`entity()`, `Transport`) y
  porque `PURPOSE.md` lo pide. El backend sólo exporta JSON (PRD_33 D3).
- **Tipos más un cliente delgado sobre `core/`**, nunca un cliente que implemente HTTP por su
  cuenta en cada entidad: el transporte, `Problem`, la idempotencia y `model_version` siguen
  siendo uno solo.
- **REST o gRPC no se elige al generar.** El cliente lleva los bindings de todos los ports; cada
  app elige su transporte. Web usa REST. El `.proto` de hoy es `Struct`, así que los tipos de un
  cliente gRPC también salen de acá.

## Preguntas abiertas

- Los nombres de los métodos: `CommandSetProjectTenant` → `setProjectTenant`, o uno más corto
  bajo su entidad (`projects.setTenant`).
- De dónde sale `history` (PRD_33, preguntas abiertas).
- El nombre del `bin` y si `generate` también acepta una URL con su `ETag`.
