import { EntityList, useListing } from "@sincpro/web-framework";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";

import { Escenario } from "./support/escenario";
import { clientes, facturas, VENTAS } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/02 · Buscar con la plantilla de la entidad",
  parameters: {
    docs: {
      description: {
        component:
          "El buscador aparece **porque la entidad declara cómo se busca** (`meta.search`, el `DEFAULT_LITERAL_SEARCH` del framework): lo tipeado llena esa plantilla y se le pide al servidor, igual que lo haría un many2one. Una factura se busca por número; un cliente por nombre o por NIT. La pantalla no escribe ningún filtro.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const UnaFacturaPorNumero: Story = {
  render: function Render() {
    const listing = useListing(facturas, { paging: "more", pageSize: 20 });
    return (
      <EntityList
        listing={listing}
        search="box"
        columns={["number", "customer", "state", "amount_total"]}
      />
    );
  },
  decorators: [
    (Story) => (
      <Escenario tables={VENTAS}>
        <Story />
      </Escenario>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("20 de 64");
    await userEvent.type(
      await canvas.findByRole("searchbox", { name: "Buscar" }),
      "0007{Enter}",
    );
    await expect(await canvas.findByText("1 de 1")).toBeVisible();
    await expect(await canvas.findByText("F-2026-0007")).toBeVisible();
  },
};

export const UnClientePorNit: Story = {
  render: function Render() {
    const listing = useListing(clientes, { paging: "more" });
    return <EntityList listing={listing} search="box" />;
  },
  decorators: [
    (Story) => (
      <Escenario tables={VENTAS}>
        <Story />
      </Escenario>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("8 de 8");
    await userEvent.type(
      await canvas.findByRole("searchbox", { name: "Buscar" }),
      "Globex{Enter}",
    );
    await expect(await canvas.findByText("1 de 1")).toBeVisible();
  },
};
