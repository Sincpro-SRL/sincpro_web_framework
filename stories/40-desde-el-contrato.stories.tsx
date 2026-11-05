import type { AnyRecord } from "@sincpro/criteria";
import {
  type ClientContract,
  CommandButton,
  EntityList,
  metasOf,
  type Method,
  useListing,
} from "@sincpro/web-framework";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Escenario } from "./support/escenario";
import contract from "./support/forge-contract/project.contract.json";
import { entities, issues } from "./support/forge-contract/project/entities";

const meta: Meta = {
  title: "Casos de uso/40 · Desde el contrato",
  parameters: {
    docs: {
      description: {
        component:
          'Una pantalla de forge armada **sólo con lo generado** desde su contrato (`sincpro-web generate`, PRD_01): `issues` sale de `stories/support/forge-contract/project/entities.ts`, que se escribió del contrato que exporta un forge real (`export-client-contract`). Nadie escribió una ruta: la lista es el `search` de `Issue` y «Enviar» es su comando `sendIssue`, `POST /issues/{issue_id}/messages`. La pantalla da el id del registro y el mensaje; el comando sabe en qué campo va el id (`target: "issue_id"`), y la ruta lo toma de ahí. Las definiciones se precargan desde la misma foto (`metasOf`): las palabras de la lista están antes de la primera respuesta.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

const definitions = metasOf(contract as unknown as ClientContract, "project");

const ISSUES: AnyRecord[] = [
  {
    id: "odoo-acme-1",
    title: "El login falla con SSO",
    request: "El login falla con SSO desde ayer.",
    status: "idle",
    project_id: "odoo-acme",
    tenant_id: "acme",
    created_at: "2026-11-04T12:00:00Z",
  },
  {
    id: "odoo-acme-2",
    title: "Reporte de ventas lento",
    request: "El reporte de ventas tarda dos minutos.",
    status: "running",
    project_id: "odoo-acme",
    tenant_id: "acme",
    created_at: "2026-11-05T09:30:00Z",
  },
];

/** What the server received, as it arrived: a story checks the route and the body. */
const recibidos: { method: Method; route: string; body: unknown }[] = [];
const atender = (method: Method, route: string, body: unknown) => {
  recibidos.push({ method, route, body });
  return { issue_id: "odoo-acme-1", run_id: "odoo-acme-1.1", status: "running" };
};

export const ListarYEnviarSinEscribirUnaRuta: Story = {
  render: function Render() {
    const listing = useListing(issues);
    return (
      <div className="flex flex-col gap-3 p-6">
        <EntityList listing={listing} title="Issues" columns={["title", "status"]} />
        <div>
          <CommandButton
            entity={issues}
            id="odoo-acme-1"
            command="sendIssue"
            body={{ message: "y el reporte también" }}
            label="Enviar"
          />
        </div>
      </div>
    );
  },
  decorators: [
    (Story) => (
      <Escenario
        tables={{ [issues.list]: { meta: definitions[issues.key]!, rows: ISSUES } }}
        metas={definitions}
        entities={entities}
        handle={atender}
      >
        <Story />
      </Escenario>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    recibidos.length = 0;
    // The list is the generated `search` of Issue, its words from the preloaded definition.
    await expect(await canvas.findByText("El login falla con SSO")).toBeVisible();
    await expect(canvas.getByText("Reporte de ventas lento")).toBeVisible();

    await userEvent.click(canvas.getByRole("button", { name: "Enviar" }));
    // The Command went to its generated route, with the record's id where its body names it.
    await waitFor(() => expect(recibidos).toHaveLength(1));
    await expect(recibidos[0]).toEqual({
      method: "POST",
      route: "/issues/odoo-acme-1/messages",
      body: { message: "y el reporte también", issue_id: "odoo-acme-1" },
    });
  },
};
