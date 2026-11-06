import {
  type CallOptions,
  configureProcess,
  memoryTransport,
  processContext,
  type Transport,
} from "@sincpro/client-framework";
import { EntityList, FrameworkProvider, useListing } from "@sincpro/web-framework";
import { Button } from "@sincpro/web-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { FACTURAS, facturas, VENTAS } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/43 · La empresa viaja en cada pedido",
  parameters: {
    docs: {
      description: {
        component:
          "La empresa activa es **contexto del proceso** (`processContext.set({ company_id })`, @sincpro/client-framework) y viaja en `sincpro-context` en **cada** pedido que hacen las pantallas — no sólo en los de un caso de uso. Cuando cambia, cada lista y cada registro en pantalla se vuelve a leer en la empresa nueva, y lo que el cache guardó de la otra se olvida. Una pantalla no escribe nada de esto.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

/** A server that answers by the company each request says it is in — what the backend does. */
function serverByCompany() {
  const companies: Record<string, Transport> = {
    "1": memoryTransport(
      { ...VENTAS, "/facturas": { ...VENTAS["/facturas"], rows: FACTURAS.slice(0, 10) } },
      { latency: 60 },
    ),
    "2": memoryTransport(
      { ...VENTAS, "/facturas": { ...VENTAS["/facturas"], rows: FACTURAS.slice(10, 15) } },
      { latency: 60 },
    ),
  };
  const said: string[] = [];
  const companyOf = (options?: CallOptions): Transport => {
    const header = options?.headers?.["sincpro-context"];
    said.push(header ?? "");
    const company = header === undefined ? "1" : String(JSON.parse(header).company_id ?? "1");
    return companies[company] ?? companies["1"]!;
  };
  const transport: Transport = {
    list: (route, criteria, signal, options) =>
      companyOf(options).list(route, criteria, signal, options),
    one: (route, signal, options) => companyOf(options).one(route, signal, options),
    send: (method, route, body, signal, options) =>
      companyOf(options).send(method, route, body, signal, options),
  };
  return { transport, said };
}

const server = serverByCompany();

function Invoices() {
  const listing = useListing(facturas, { pageSize: 20 });
  return <EntityList listing={listing} columns={["number", "state"]} />;
}

function Screen() {
  const transport = useMemo(() => server.transport, []);
  return (
    <FrameworkProvider transport={transport}>
      <div className="flex flex-col gap-3 p-4">
        <Button onClick={() => processContext.set({ company_id: 2 })}>
          Pasar a la empresa 2
        </Button>
        <Invoices />
      </div>
    </FrameworkProvider>
  );
}

export const LaListaSeReleeEnLaEmpresaNueva: Story = {
  render: () => <Screen />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    configureProcess();
    processContext.set({ company_id: 1 });
    await expect(await canvas.findByText(FACTURAS[0]!.number)).toBeVisible();
    await waitFor(() => expect(server.said.at(-1)).toBe('{"company_id":1}'));
    // Another company: the list reads again, in it — nothing on the screen asked for it.
    await userEvent.click(canvas.getByRole("button", { name: "Pasar a la empresa 2" }));
    await expect(await canvas.findByText(FACTURAS[10]!.number)).toBeVisible();
    await waitFor(() => expect(canvas.queryByText(FACTURAS[0]!.number)).toBeNull());
    await expect(server.said.at(-1)).toBe('{"company_id":2}');
  },
};
