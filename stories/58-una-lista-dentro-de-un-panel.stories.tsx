import { EntityList, FrameworkProvider, useListing } from "@sincpro/web-framework";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { expect, waitFor, within } from "storybook/test";

import { cuotaMeta, cuotas, PAGO, pagoMeta, pagos, servidorPagos } from "./support/pagos";

const meta: Meta = {
  title: "Casos de uso/58 · Una lista dentro de un panel",
  parameters: {
    docs: {
      description: {
        component:
          "Una lista **embebida** — en un tablero, en un registro — es sus filas. No ofrece «Ordenar» (los encabezados de la tabla siguen ordenando), no pone paginador cuando todas las filas entran, y no suma una página: la suma de cinco filas de sesenta, en una caja chica, se lee como **el** total. Cuando están todas, el pie suma todo. El paginador aparece sólo cuando hay más.",
      },
    },
  },
};
export default meta;
type Story = StoryObj;

/** A dashboard's box: the latest five payments of sixty. */
function UltimosPagos() {
  const listing = useListing(pagos, { pageSize: 5 });
  return (
    <EntityList
      listing={listing}
      embedded
      search={false}
      columns={["id", "concepto", "monto"]}
    />
  );
}

/** A payment's three dues: every one of them fits. */
function CuotasDelPago() {
  const listing = useListing(cuotas);
  return <EntityList listing={listing} embedded search={false} />;
}

function Tablero({ children }: { children: React.ReactNode }) {
  const transport = useMemo(servidorPagos, []);
  return (
    <FrameworkProvider
      transport={transport}
      locale="es"
      currency="BOB"
      metas={{ [pagos.key]: pagoMeta, [cuotas.key]: cuotaMeta }}
    >
      <div className="p-6">{children}</div>
    </FrameworkProvider>
  );
}

export const SusFilasYElPaginadorSiHayMas: Story = {
  render: () => (
    <Tablero>
      <UltimosPagos />
    </Tablero>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText(PAGO);
    // There are more than five: the way to them is there.
    await expect(canvas.getByRole("button", { name: "Página siguiente" })).toBeVisible();
    // Nothing a handful of rows does not need: no sort menu, no sum of a page.
    await expect(canvas.queryByRole("button", { name: /^Ordenar/ })).toBeNull();
    await expect(canvas.queryByText("Totales de esta página")).toBeNull();
    await expect(canvasElement.querySelector("tfoot")).toBeNull();
  },
};

export const TodoEntraSinPaginador: Story = {
  render: () => (
    <Tablero>
      <CuotasDelPago />
    </Tablero>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("Septiembre");
    // Three dues of 25, all in hand: the foot is their total.
    const pie = canvasElement.querySelector("tfoot") as HTMLElement;
    await waitFor(() => expect(within(pie).getByText("75,00 BOB")).toBeVisible());
    // «1–3 / 3» would repeat the rows: no pager, no sort menu.
    await expect(canvas.queryByRole("button", { name: "Página siguiente" })).toBeNull();
    await expect(canvas.queryByText(/1\s*[–-]\s*3/)).toBeNull();
    await expect(canvas.queryByRole("button", { name: /^Ordenar/ })).toBeNull();
  },
};
