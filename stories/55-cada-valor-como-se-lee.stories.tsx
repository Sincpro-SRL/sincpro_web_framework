import { EntityList, FrameworkProvider, useListing } from "@sincpro/web-framework";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { expect, waitFor, within } from "storybook/test";

import { cuotaMeta, cuotas, PAGO, pagoMeta, pagos, servidorPagos } from "./support/pagos";

const meta: Meta = {
  title: "Casos de uso/55 · Cada valor como se lee",
  parameters: {
    docs: {
      description: {
        component:
          'Una tabla dibuja cada celda **por su tipo**, desde la metadata y sin código de la aplicación: una opción es una **etiqueta** con el color que la aplicación declaró una vez para ese valor (`presented(pagos, { tones })`), un sí/no es un **check** (y un no, nada), un monto que el modelo dibuja como dinero (`widget: money`) se escribe en la moneda del negocio (`currency`) con su redondeo, y una fecha es **DD/MM/YYYY** (`dateStyle`, numérico por defecto; el mes en letras en un teléfono). Lo que el modelo suma (`total: "sum"`) se suma **al pie**, en el formato de la columna — sobre las filas que la lista tiene: mientras no son todas, lo dice («Totales de esta página»). El total del servidor sobre todo lo filtrado espera una lectura de medidas en sincpro_framework.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

function Pagos() {
  const listing = useListing(pagos, { pageSize: 20 });
  return <EntityList listing={listing} search={false} />;
}

function Cuotas() {
  const listing = useListing(cuotas);
  return <EntityList listing={listing} search={false} />;
}

function Escenario({ children }: { children: React.ReactNode }) {
  const transport = useMemo(servidorPagos, []);
  return (
    <FrameworkProvider
      transport={transport}
      locale="es"
      currency="BOB"
      metas={{ [pagos.key]: pagoMeta, [cuotas.key]: cuotaMeta }}
    >
      {children}
    </FrameworkProvider>
  );
}

/** The row of a payment, by the identity its first cell shows. */
async function fila(canvasElement: HTMLElement, id: string) {
  const cell = await within(canvasElement).findByText(id);
  return within(cell.closest("tr") as HTMLElement);
}

export const CadaTipoComoSeLee: Story = {
  render: () => (
    <Escenario>
      <Pagos />
    </Escenario>
  ),
  play: async ({ canvasElement }) => {
    const pago = await fila(canvasElement, PAGO);
    // A state is a tag in the application's colour; its word is the Meta's.
    await expect(pago.getByText("Validado")).toBeVisible();
    // An amount drawn as money, in the business's currency, rounded as an invoice shows it.
    await expect(pago.getByText("25,00 BOB")).toBeVisible();
    // A day, day first.
    await expect(pago.getByText("30/11/2026")).toBeVisible();
    // A yes is a check; a no is nothing — never «sí» / «no».
    await expect(pago.getByRole("img", { name: "sí" })).toBeVisible();
    const otro = await fila(canvasElement, "P-0028");
    await expect(otro.queryByRole("img", { name: "sí" })).toBeNull();
    await expect(otro.queryByText("no")).toBeNull();
  },
};

export const ElPieSumaLoQueSeVe: Story = {
  render: () => (
    <Escenario>
      <Pagos />
    </Escenario>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText(PAGO);
    // Sixty payments, twenty on screen: the foot adds up this page, and says so.
    await expect(await canvas.findByText("Totales de esta página")).toBeVisible();
    const pie = canvasElement.querySelector("tfoot") as HTMLElement;
    await waitFor(() => expect(within(pie).getByText(/^[\d.]+,\d{2} BOB$/)).toBeVisible());
  },
};

export const TodoEnUnaPaginaSumaTodo: Story = {
  render: () => (
    <Escenario>
      <Cuotas />
    </Escenario>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("Septiembre");
    // Three dues of 25: the whole set is in hand, so the foot is its total — with no caveat.
    const pie = canvasElement.querySelector("tfoot") as HTMLElement;
    await waitFor(() => expect(within(pie).getByText("75,00 BOB")).toBeVisible());
    await expect(canvas.queryByText("Totales de esta página")).toBeNull();
  },
};
