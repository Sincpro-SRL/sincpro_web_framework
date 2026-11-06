# Adoptar @sincpro/web-framework desde el contrato

Cómo arma una aplicación sus pantallas sobre un servicio de sincpro_framework sin escribir a mano
lo que el servidor ya sabe. Es la guía del refactor: qué se genera y no se toca, qué se escribe y
dónde, y cómo se pasa una pantalla escrita a mano a lo generado. El porqué está en
[`PURPOSE.md`](PURPOSE.md) y el diseño en [`prd/PRD_01_dominio-y-cliente-generados.md`](prd/PRD_01_dominio-y-cliente-generados.md).

## Qué pone cada pieza

| Pieza                                                 | Pone                                                                                                                                                                               |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| sincpro_framework (≥ 3.32)                            | El **contrato del cliente** de cada contexto: modelos, operaciones (qué es cada una para su entidad, qué recibe, qué contesta, en qué campo va su registro) y cómo llega cada port |
| `sincpro-client generate` (@sincpro/client-framework) | Desde ese contrato: `domain.ts` (los DTOs), `client.ts` (cada operación y `clientOf`), `entities.ts` (una `entity<T, C, A>()` por modelo que se lista), `contract.json` (la foto)  |
| @sincpro/web-framework (runtime)                      | El estado y el dibujo: `useListing`, `useRecord`, `useCommand`, `EntityList`, `RecordField`…, sobre el transporte, leyendo la definición VIVA del servidor                         |
| @sincpro/criteria (≥ 1.1)                             | La gramática de lectura y la lectura de las definiciones (un valor que un registro guarda, apuntado por `$ref`, necesita 1.1)                                                      |
| La aplicación                                         | Cómo se ve cada registro (`presented`), sus vistas, lo que el contrato no dice todavía (el historial)                                                                              |

## El flujo, de punta a punta

```text
backend   make contract   →  contracts/<alias>.contract.json   (export-client-contract)
web       make client     →  src/generated/<alias>/             (sincpro-client generate)
CI        make verify-client: regenera y falla si algo cambió sin regenerar
```

Según la convención de Sincpro, toda la lógica va en el `Makefile` y el workflow sólo llama
`make`:

```make
# backend (Python)
contract:
	poetry run python -m sincpro_framework.entrypoints export-client-contract \
		app.entrypoints.http:gateways web/contracts

# web (Node)
CONTEXTS := project auth
client:
	@for one in $(CONTEXTS); do \
		npx sincpro-client generate contracts/$$one.contract.json \
			--out src/generated/$$one --base /v1; \
	done

verify-client: client
	@git diff --exit-code -- src/generated || \
		(echo >&2 "✘ the contract changed: run make client and commit src/generated"; exit 1)
```

`verify-client` entra en el `verify-format` de la app. `--base` saca la versión que el export pone
en cada ruta (`/v1`) y que el transporte ya antepone (`restTransport({ base: "/v1" })`). La clave
corta de las entidades sale del `alias` del contrato (`project` → `project:issue`); `--domain` la
cambia.

## Dónde va cada cosa en la aplicación

```text
src/generated/<alias>/     lo generado — NUNCA se edita; fuera de prettier y eslint
  domain.ts                los DTOs: modelos, valores, entrada y respuesta de cada operación
  client.ts                operations (datos) y clientOf(transport)
  entities.ts              issues, projects, … y `entities` (todas)
  contract.json            la foto: metasOf, versionsOf
src/domains/<alias>/       lo tuyo
  entities.ts              presented(generated.issues, { row, card, option }), lo que se suma
  views/                   las pantallas
```

```text
# .prettierignore y los ignores de eslint
src/generated/
```

## Qué se genera y qué se escribe

| Se genera (no se toca)                                                    | Se escribe (en `src/domains/`)                                                                  |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Los tipos del cable: cada modelo, valor, DTO y respuesta                  | Un tipo con lo que el contrato todavía no dice: `type Issue = dto.Issue & { … }`                |
| Las rutas de cada entidad (lista, registro, edit, preview) y sus comandos | Cómo se ve: `presented(issues, { row, card, option })`                                          |
| En qué campo va el registro de cada comando (`target`)                    | El historial: `{ ...issues, history: { route: "/project-events", type: "Issue" } }`             |
| Los cuerpos y las respuestas tipadas de cada comando                      | Las vistas, los tonos, las palabras vacías de una pantalla                                      |
| El cliente sin pantalla (`clientOf`)                                      | Nada de rutas: una ruta generada que no sirve es un bug del contrato — se arregla en el backend |

Una entidad generada es un objeto plano: lo que el contrato no dice (`history`, `summary`,
`aggregate`) se suma con un spread, y el tipo se mantiene.

## Cómo se usa lo generado

**Precarga y entidades**, una vez, en la raíz de la aplicación:

```tsx
import project from "@app/generated/project/contract.json";
import * as projectEntities from "@app/generated/project/entities";

const transport = restTransport({
  base: "/v1",
  snapshot: versionsOf(project),
  onVersionDrift: ({ model, snapshot, live }) => report(model, snapshot, live),
});

<SincproApp
  transport={transport}
  metas={metasOf(project, "project")}
  entities={[...projectEntities.entities]}
>
```

`onVersionDrift` avisa una vez por modelo cuando el servidor contesta otra versión que la foto:
alguien cambió el backend y nadie regeneró. Nunca es un error; la pantalla sigue con la
definición viva.

**Comandos**, sin argumentos de tipo — el nombre, el cuerpo y la respuesta los chequea el
compilador:

```tsx
const send = useCommand(issues, "sendIssue");
const answer = await send.run(issue.id, { message }); // answer: CommandSendIssueAnswer | undefined

<CommandButton
  entity={issues}
  id={issue.id}
  command="sendIssue"
  body={{ message }}
  label="Enviar"
/>;
```

El id del registro va en `run(id, …)`; el comando sabe en qué campo del cuerpo va (`issue_id`).
Nunca se escribe la clave dos veces. Escribir `useCommand<Issue, Answer>(…)` apaga el chequeo:
TypeScript no infiere una parte de una lista.

**Acciones por fila**, con los comandos de la entidad de la lista:

```tsx
const listing = useListing(issues);
<EntityList
  listing={listing}
  commands={[{ command: "stopIssue", label: "Detener", icon: Square }]}
/>;
```

**Listas bajo un registro** (`/tenants/{tenant_id}/members`): la clave va en los parámetros.

```tsx
const members = useListing(memberships, { params: { tenant_id: tenant.id } });
```

**Una clave que dice de quién es** (`tenant_id: EntityID[Tenant]` en el backend) es un many2one
sin escribir nada: `<RecordField record={issue} name="tenant_id" />` dibuja el picker de tenants al
escribir y el nombre del tenant al leer. La entidad tiene que estar entre las `entities` de la
aplicación.

**Sin pantalla** (un script, un test, un hook propio):

```ts
const project = clientOf(transport);
await project.sendIssue({ issue_id: "i1", message: "y el reporte" });
const caller = await auth.getCaller(); // un GET propio: el transporte necesita `read`
```

## Pasar una pantalla escrita a mano a lo generado

1. El backend exporta (`make contract`) y la web genera (`make client`).
2. Los tipos del cable escritos a mano se borran: se importan de `generated/<alias>/domain`.
3. Cada `entity()` escrita a mano se reemplaza por la generada, envuelta en `presented()` si
   tenía cara propia. Lo que la generada no tiene (`history`) se suma con un spread.
4. Los comandos cambian de nombre: salen del DTO (`CommandSendIssue` → `sendIssue`). Se renombran
   en cada `useCommand`, `CommandButton` y acción por fila.
5. Los cuerpos pierden la clave del registro (`{ issue_id, message }` → `{ message }`): la pone
   `run(id, …)`.
6. Lo que se escribía con `transport.send` a mano (una ruta con dos claves, `revokeShare`) pasa a
   ser un comando de la entidad.
7. `make verify-client` entra en CI.

Lo que el generador no hace por vos, y te dice en el propio archivo (`Not declared` / `Without an
entity here`): una entidad con dos lecturas del mismo papel, si el backend no marca cuál es la
suya, y un modelo sin lista.

## Decisiones por defecto

Las tomó el generador; el equipo puede cambiarlas antes del refactor:

- **Los métodos y comandos se nombran desde el DTO** (`sendIssue`, `setProjectTenant`): largos,
  estables y fáciles de buscar.
- **Las claves son `string`** en TypeScript, con una nota de a quién apuntan. Un tipo marcado
  (`IssueId`) evitaría mezclar ids, a costa de `"i1" as IssueId` en los tests.
- **Lo generado vive en `src/generated/<alias>/`**, fuera de los formateadores.

## Trampas

- Lo generado no se formatea ni se edita: un formateador que lo toca hace fallar `verify-client`.
- `--base` tiene que ser lo que antepone el transporte; una ruta fuera de esa base se rechaza al
  generar.
- `@sincpro/criteria` 1.1 o más: con 1.0 un valor apuntado por `$ref` pierde su definición.
- El generador corre en Node 26 (`nvm use`), como el resto del paquete.
- Un registro nuevo de una entidad listada bajo otro registro necesita su definición precargada
  (`metasOf`): no hay lista que preguntar sin la clave.
