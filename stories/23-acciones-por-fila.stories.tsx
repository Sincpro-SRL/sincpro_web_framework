import { EntityList, type RowCommand, useListing } from "@sincpro/web-framework";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Check } from "lucide-react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Escenario } from "./support/escenario";
import { servidorVentas } from "./support/servidor";
import { type Factura, facturas } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/23 · Acciones por fila",
  parameters: {
    docs: {
      description: {
        component:
          "Los Commands de la entidad sobre cada fila, sin abrir el registro: `commands` en `EntityList` (o `useRowCommands` para armarlas a mano). Cada uno viaja con su `Idempotency-Key`, se deshabilita mientras corre y, al terminar, la lista se vuelve a leer: lo que la fila pasó a ser lo dice el servidor. `when` lo ofrece sólo donde aplica — «Confirmar» sólo en borradores —, evaluado como los hints, y el servidor sigue decidiendo: si alguien la confirmó antes, se lee su rechazo.\n\nUn Command que destruye no va en una fila: se confirma con su prueba en seco, en el registro (`CommandButton`).",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

const CONFIRMAR: readonly RowCommand<Factura>[] = [
  {
    command: "confirmar",
    label: "Confirmar",
    icon: Check,
    when: { field: "state", operator: "=", value: "draft" },
  },
];

function Facturas() {
  const listing = useListing(facturas, { pageSize: 20 });
  return (
    <EntityList
      listing={listing}
      columns={["number", "customer", "state", "amount_total"]}
      commands={CONFIRMAR}
    />
  );
}

const filas = (root: HTMLElement) => [...root.querySelectorAll("tbody tr")] as HTMLElement[];
const filaDe = (root: HTMLElement, number: string) =>
  filas(root).find((tr) => tr.textContent?.includes(number));

function conServidor(preparar?: (servidor: ReturnType<typeof servidorVentas>) => void) {
  const servidor = servidorVentas();
  preparar?.(servidor);
  return {
    servidor,
    decorators: [
      (Story: () => React.JSX.Element) => (
        <Escenario tables={servidor.tables} handle={servidor.handle}>
          <Story />
        </Escenario>
      ),
    ],
  };
}

const confirmar = conServidor();

export const ConfirmarUnBorrador: Story = {
  render: () => <Facturas />,
  decorators: confirmar.decorators,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("1–20");
    // Offered on drafts only: a posted invoice has nothing to confirm.
    const borrador = filas(canvasElement).find((tr) => tr.textContent?.includes("Borrador"))!;
    const publicada = filas(canvasElement).find((tr) =>
      tr.textContent?.includes("Publicada"),
    )!;
    await expect(within(publicada).queryByRole("button", { name: "Confirmar" })).toBeNull();
    const number = borrador.textContent!.match(/F-2026-\d{4}/)![0];
    await userEvent.click(within(borrador).getByRole("button", { name: "Confirmar" }));
    // The list was read again: the server says the row is posted now.
    await waitFor(() =>
      expect(filaDe(canvasElement, number)?.textContent).toContain("Publicada"),
    );
    await expect(
      within(filaDe(canvasElement, number)!).queryByRole("button", { name: "Confirmar" }),
    ).toBeNull();
  },
};

/** Someone confirms every draft right after the list was read. */
let antes: (() => void) | undefined;
const alguienConfirma = conServidor((servidor) => {
  antes = () =>
    servidor.tables["/facturas"].rows
      .filter((f) => f.state === "draft")
      .forEach((f) => Object.assign(f, { state: "posted" }));
});

export const ElServidorDiceQueNo: Story = {
  render: () => <Facturas />,
  decorators: alguienConfirma.decorators,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("1–20");
    const borrador = filas(canvasElement).find((tr) => tr.textContent?.includes("Borrador"))!;
    antes?.();
    await userEvent.click(within(borrador).getByRole("button", { name: "Confirmar" }));
    // The row offered it as it was read; the server refuses, in its own words.
    await expect(await canvas.findByText("Ya está confirmada")).toBeVisible();
  },
};
