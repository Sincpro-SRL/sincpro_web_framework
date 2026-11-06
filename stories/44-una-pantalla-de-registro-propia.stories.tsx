import { memoryTransport } from "@sincpro/client-framework";
import type { ViewProps } from "@sincpro/web-composer";
import { entityView, RecordField, SincproApp, useRecordScreen } from "@sincpro/web-framework";
import { Record } from "@sincpro/web-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { servidorVentas } from "./support/servidor";
import { clienteMeta, clientes, facturaMeta, facturas } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/44 · Una pantalla de registro propia",
  parameters: {
    docs: {
      description: {
        component:
          "Entre `EntityRecord` (todo hecho) y `useRecord` (sólo el registro) está **`useRecordScreen`**: lo que hace la pantalla del framework, como valores — leer para editar, la miga del workspace, decirle su nombre y si hay algo sin guardar, la historia, anterior y siguiente en la lista de la que vino, y el nombre, estado, sin guardar, rechazo y autoría como los toma `Record` de web-ui. La pantalla escribe su propio árbol (los slots de web-ui se buscan por tipo) y no pierde nada de lo que el framework hace.",
      },
    },
  },
};
export default meta;
type Story = StoryObj;

/** An invoice screen of the application's own: its own paper, every behaviour of the framework's. */
function InvoiceScreen(props: ViewProps) {
  const screen = useRecordScreen(facturas, props);
  if (screen.reading.status !== "ready") return <p className="text-meta text-muted">…</p>;
  return (
    <Record {...screen.record}>
      <Record.Rail>
        {screen.crumbs.length === 0 ? null : <Record.Crumbs crumbs={screen.crumbs} />}
        {screen.pager === undefined ? null : <Record.Pager {...screen.pager} />}
      </Record.Rail>
      <Record.Paper layout="horizontal">
        <p className="text-meta">Pantalla propia</p>
        <RecordField record={screen.reading} name="note" />
        {screen.audit === undefined ? null : <Record.Audit {...screen.audit} />}
      </Record.Paper>
    </Record>
  );
}

function App() {
  const transport = useMemo(() => {
    const servidor = servidorVentas();
    return memoryTransport(servidor.tables, { latency: 40, handle: servidor.handle });
  }, []);
  const views = useMemo(
    () => [
      entityView(facturas, {
        transport,
        name: "Facturas",
        record: (props) => <InvoiceScreen {...props} />,
      }),
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

export const LaPantallaPropiaConservaLoDelFramework: Story = {
  render: () => <App />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The list's first page; its first invoice opens in the screen the application wrote.
    await canvas.findByText("1–50");
    const [first] = canvas.getAllByText(/^F-2026-\d{4}$/);
    const number = first!.textContent ?? "";
    await userEvent.click(first!);
    await expect(await canvas.findByText("Pantalla propia")).toBeVisible();
    // Its name on top, and where it stands in the list it came from — the framework's own.
    await expect(await canvas.findByRole("heading", { name: number })).toBeVisible();
    await expect(await canvas.findByText("1 / 64")).toBeVisible();
    // The neighbour, in place.
    await userEvent.click(canvas.getByRole("button", { name: "Siguiente" }));
    await expect(await canvas.findByText("2 / 64")).toBeVisible();
    await waitFor(() => expect(canvas.queryByRole("heading", { name: number })).toBeNull());
  },
};
