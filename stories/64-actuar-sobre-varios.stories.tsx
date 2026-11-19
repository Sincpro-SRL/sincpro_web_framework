import {
  BatchProgress,
  EntityList,
  useBatchCommand,
  useListing,
  useSelection,
} from "@sincpro/web-framework";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Escenario } from "./support/escenario";
import { servidorVentas } from "./support/servidor";
import { facturas } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/64 · Actuar sobre varios",
  parameters: {
    docs: {
      description: {
        component:
          'Lo **elegido** en una lista es un valor que la pantalla sostiene (`useSelection(listing)`, la `Selection` de client-framework): las facturas marcadas, o **todas las que coinciden** con lo que la lista pregunta («Elegir los 64 que coinciden»). Un **comando corre una vez por registro elegido** (`useBatchCommand(facturas, "confirmar")`, el `for rec in self`): cada uno es su propio caso de uso, con su clave de idempotencia, y un fallo es **de ese registro**, nunca del lote. `BatchProgress` dibuja cuánto va y después qué pasó con cada una — las que fallaron, por su número y con el motivo del servidor —, con «Reintentar los que fallaron». Más elegidos de los que un comando toma a la vez no ejecuta nada y lo dice.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

/** The screen holds what is chosen and the Command over it: reachable outside the list. */
function Facturas({ limit }: { limit?: number }) {
  const listing = useListing(facturas);
  const elegidas = useSelection(listing);
  const confirmar = useBatchCommand(
    facturas,
    "confirmar",
    limit === undefined ? {} : { limit },
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="px-5 pt-3">
        <BatchProgress batch={confirmar} />
      </div>
      <EntityList
        listing={listing}
        // No `selectable`: actions for the chosen rows make the rows choosable.
        selection={elegidas}
        // As data: the view style draws it — in the bar here, floating in the modern style.
        selectionActions={(elegidas) => [
          {
            id: "confirmar",
            label: `Confirmar (${elegidas.size ?? "todas"})`,
            primary: true,
            onSelect: () => void confirmar.run(elegidas.selection),
          },
        ]}
      />
    </div>
  );
}

function Ventas({ limit }: { limit?: number }) {
  const { tables, handle } = useMemo(servidorVentas, []);
  return (
    <Escenario tables={tables} handle={handle} latency={20}>
      <Facturas {...(limit === undefined ? {} : { limit })} />
    </Escenario>
  );
}

export const ConfirmarLasMarcadas: Story = {
  render: () => <Ventas />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("F-2026-0064");
    // The four newest: two paid, one posted, one draft — only a draft can be confirmed.
    const boxes = await canvas.findAllByRole("checkbox");
    for (const box of boxes.slice(1, 5)) await userEvent.click(box);
    await userEvent.click(await canvas.findByRole("button", { name: "Confirmar (4)" }));
    // One outcome per record: the draft confirmed, each other one named with its reason.
    await expect(await canvas.findByText("1 hecho · 3 fallaron")).toBeVisible();
    await expect(
      canvas.getByText(/Ya está confirmada: F-2026-0064 está pagada/),
    ).toBeVisible();
    await expect(
      canvas.getByText(/Ya está confirmada: F-2026-0062 está publicada/),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Reintentar los que fallaron" }),
    ).toBeVisible();
    // The list follows the write: the draft reads as posted now.
    await waitFor(() =>
      expect(
        within(canvas.getByText("F-2026-0061").closest("tr")!).getByText("Publicada"),
      ).toBeVisible(),
    );
  },
};

export const TodasLasQueCoinciden: Story = {
  render: () => <Ventas />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("F-2026-0064");
    const boxes = await canvas.findAllByRole("checkbox");
    // The page ticked whole offers the whole question, as the server counted it.
    await userEvent.click(boxes[0]!);
    await userEvent.click(
      await canvas.findByRole("button", { name: /Elegir los 64 que coinciden/ }),
    );
    await expect(await canvas.findByRole("button", { name: "Confirmar (64)" })).toBeVisible();
  },
};

export const MasDeLosQueSePuede: Story = {
  render: () => <Ventas limit={50} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("F-2026-0064");
    const boxes = await canvas.findAllByRole("checkbox");
    await userEvent.click(boxes[0]!);
    await userEvent.click(
      await canvas.findByRole("button", { name: /Elegir los 64 que coinciden/ }),
    );
    await userEvent.click(await canvas.findByRole("button", { name: "Confirmar (64)" }));
    // Nothing runs on a part chosen at random: it says why, and how to go on.
    await expect(
      await canvas.findByText(/Son 64 registros elegidos; a la vez, como mucho 50/),
    ).toBeVisible();
    await expect(canvas.queryByText(/hechos?/)).toBeNull();
  },
};
