import { EntityList, useListing } from "@sincpro/web-framework";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { Escenario } from "./support/escenario";
import { FORGE, tenants } from "./support/forge";

const meta: Meta = {
  title: "Casos de uso/05 · La meta tal como la manda forge hoy",
  parameters: {
    docs: {
      description: {
        component:
          "La definición de `Tenant` está copiada de un forge corriendo (`GET /v1/tenants`, sincpro_framework 3.27). La lista se arma igual — columnas, orden, buscador por `display_name` — pero **forge no declara labels**, así que cada encabezado es el nombre crudo del campo. No es un error de la pantalla: es lo que falta en el servicio, y se arregla declarando `label` en la entidad. Esta historia lo deja a la vista hasta que eso pase.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const TenantsSinLabels: Story = {
  render: function Render() {
    const listing = useListing(tenants);
    return <EntityList listing={listing} title="Tenants" />;
  },
  decorators: [
    (Story) => (
      <Escenario tables={FORGE}>
        <Story />
      </Escenario>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole("columnheader", { name: /display_name/ }),
    ).toBeVisible();
    await expect(await canvas.findByPlaceholderText(/Buscar, o #/)).toBeVisible();
  },
};
