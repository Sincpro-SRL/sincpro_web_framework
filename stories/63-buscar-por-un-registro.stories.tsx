import { EntityList, useListing } from "@sincpro/web-framework";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Escenario } from "./support/escenario";
import { servidorVentas } from "./support/servidor";
import { clientes, facturas } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/63 · Buscar por un registro",
  parameters: {
    docs: {
      description: {
        component:
          "Al escribir «globex» en la barra de las facturas, **Cliente** se despliega (▸) en los clientes que coinciden — la búsqueda literal de la entidad cliente, la misma que hace un many2one o ⌘K — y elegir uno filtra **por su clave** y se lee **por su nombre**: «Cliente: Globex Bolivia». Un estado se busca por su **palabra**: «pagada» ofrece «Estado: Pagada» y pide `paid`. Nada se conecta por pantalla: la barra recibe la búsqueda de registros del framework (`useSearchRecords`), salvo que la aplicación ponga la suya en un `SearchProvider` de web-ui.",
      },
    },
  },
};
export default meta;
type Story = StoryObj;

function Facturas() {
  const listing = useListing(facturas);
  return <EntityList listing={listing} />;
}

function Ventas() {
  const { tables } = useMemo(servidorVentas, []);
  return (
    <Escenario tables={tables} latency={40} entities={[facturas, clientes]}>
      <Facturas />
    </Escenario>
  );
}

/** The bar's suggestions, once they open for what was typed. */
const sugerencias = async (canvasElement: HTMLElement) =>
  within(await within(canvasElement).findByRole("listbox", { name: "Sugerencias" }));

export const UnClientePorSuNombre: Story = {
  render: () => <Ventas />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findAllByText("Importadora del Oriente");
    await userEvent.type(canvas.getByRole("combobox", { name: "Buscar" }), "globex");
    // The relation unfolds into the customers that match…
    await userEvent.click(
      await (await sugerencias(canvasElement)).findByRole("option", { name: /^Cliente/ }),
    );
    await userEvent.click(
      await (
        await sugerencias(canvasElement)
      ).findByRole("option", { name: /Globex Bolivia/ }),
    );
    // …and the chosen one filters by its key, read by its name.
    await expect(await canvas.findByTitle("Cliente: Globex Bolivia")).toBeVisible();
    await waitFor(() =>
      expect(canvas.queryAllByText("Importadora del Oriente")).toHaveLength(0),
    );
    await expect(canvas.getAllByText("Globex Bolivia").length).toBeGreaterThan(0);
  },
};

export const UnEstadoPorSuPalabra: Story = {
  render: () => <Ventas />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findAllByText("Importadora del Oriente");
    await userEvent.type(canvas.getByRole("combobox", { name: "Buscar" }), "pagada");
    // The word a cell writes, never the value the server keeps.
    await userEvent.click(
      await (
        await sugerencias(canvasElement)
      ).findByRole("option", { name: /Estado.*Pagada/ }),
    );
    await expect(await canvas.findByTitle("Estado: Pagada")).toBeVisible();
    await waitFor(() => expect(canvas.queryAllByText("Borrador")).toHaveLength(0));
    await expect(canvas.queryByRole("option", { name: /paid/ })).toBeNull();
  },
};
