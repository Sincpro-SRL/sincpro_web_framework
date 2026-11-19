import { memoryTransport } from "@sincpro/client-framework";
import { entityView, SincproApp } from "@sincpro/web-framework";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { servidorVentas } from "./support/servidor";
import { clienteMeta, clientes, facturaMeta, facturas } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/66 · Buscar más desde la barra",
  parameters: {
    docs: {
      description: {
        component:
          "Bajo los registros de una relación que la barra despliega, **«Buscar más…»** (web-ui 2.8, `browseRecords`) abre la lista de la entidad en el workspace **para elegir varios** — con su propia barra, sobre lo escrito y sin lo ya elegido —, y lo elegido vuelve como un solo chip con sus nombres: «Cliente: Importadora del Oriente o Globex Bolivia», enviado por sus claves. Cada vista lo recibe de `entityView` (`RecordsBrowserProvider`); la barra lo usa, el constructor no — es un diálogo modal, y lo que se abre fuera de él no se puede usar. El constructor recorre caminos («Cliente › …») con `loadModel`.",
      },
    },
  },
};
export default meta;
type Story = StoryObj;

function App() {
  const transport = useMemo(() => {
    const servidor = servidorVentas();
    return memoryTransport(servidor.tables, { latency: 20, handle: servidor.handle });
  }, []);
  const views = useMemo(
    () => [
      entityView(facturas, { transport, name: "Facturas" }),
      entityView(clientes, { transport, name: "Clientes" }),
    ],
    [transport],
  );
  return (
    <div className="flex h-dvh min-h-0 flex-col bg-ground">
      <SincproApp
        transport={transport}
        views={views}
        entities={[facturas, clientes]}
        start={facturas.ref()}
        metas={{ [facturas.key]: facturaMeta, [clientes.key]: clienteMeta }}
      />
    </div>
  );
}

export const VariosClientesDesdeLaBarra: Story = {
  render: () => <App />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findAllByText("Clínica San Gabriel");
    await userEvent.type(canvas.getByRole("combobox", { name: "Buscar" }), "a");
    const sugerencias = async () =>
      within(await canvas.findByRole("listbox", { name: "Sugerencias" }));
    // The relation unfolds into a few customers, and «Buscar más…» under them.
    await userEvent.click(
      await (await sugerencias()).findByRole("option", { name: /^Cliente/ }),
    );
    await userEvent.click(
      await (await sugerencias()).findByRole("option", { name: /Buscar más…/ }),
    );
    // The customers' own list, opened to choose several in the workspace.
    const elegir = within(await canvas.findByRole("dialog", { name: /Clientes/ }));
    await userEvent.click(await elegir.findByText("Importadora del Oriente"));
    await userEvent.click(elegir.getByText("Globex Bolivia"));
    await userEvent.click(await elegir.findByRole("button", { name: "Agregar (2)" }));
    // One chip, by their names; the list asks for their invoices only.
    await expect(
      await canvas.findByText(/Cliente: .*Importadora del Oriente.*Globex Bolivia/),
    ).toBeVisible();
    await waitFor(() => expect(canvas.queryAllByText("Clínica San Gabriel")).toHaveLength(0));
  },
};
