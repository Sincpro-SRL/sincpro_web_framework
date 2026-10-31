import type { Criteria } from "@sincpro/criteria";
import { EntityList, useListing } from "@sincpro/web-framework";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useCallback, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Escenario } from "./support/escenario";
import { facturas, VENTAS } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/01 · Una lista que se arma con la meta",
  parameters: {
    docs: {
      description: {
        component:
          "La pantalla **nombra los campos** y nada más. El encabezado de cada columna es el label que publica el modelo, cada celda es el texto que el valor representa (un estado se lee «Pagada», una fecha en local, un monto con sus decimales, un many2one como el nombre del registro al que apunta) y si la columna ordena lo dice el servidor. Los campos que no se nombraron siguen existiendo: están en el menú de columnas, apagados.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

function Facturas({ columns }: { columns?: readonly string[] }) {
  const listing = useListing(facturas, { paging: "more", pageSize: 20 });
  return <EntityList listing={listing} {...(columns ? { columns } : {})} />;
}

export const NombrandoLosCampos: Story = {
  render: () => (
    <Escenario tables={VENTAS}>
      <Facturas
        columns={[
          "number",
          "customer",
          "state",
          "invoice_date",
          "due_date",
          "amount_total",
          "tags",
        ]}
      />
    </Escenario>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("columnheader", { name: /Cliente/ })).toBeVisible();
    await expect((await canvas.findAllByText("Pagada")).length).toBeGreaterThan(0);
    await expect(await canvas.findByText("20 de 64")).toBeVisible();

    await userEvent.click(await canvas.findByRole("button", { name: "Cargar más" }));
    await expect(await canvas.findByText("40 de 64")).toBeVisible();
  },
};

export const SinNombrarNada: Story = {
  render: () => (
    <Escenario tables={VENTAS}>
      <Facturas />
    </Escenario>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("columnheader", { name: /Total/ })).toBeVisible();
    await expect(canvas.queryByRole("columnheader", { name: /Versión/ })).toBeNull();
  },
};

/** What the list asked the server to order by, as the server received it. */
function OrdenPedido() {
  const [asked, setAsked] = useState<string>("—");
  const observe = useCallback((_: string, criteria: Criteria) => {
    const order = criteria.order?.[0];
    queueMicrotask(() =>
      setAsked(order === undefined ? "—" : `${order.field} ${order.descending ? "↓" : "↑"}`),
    );
  }, []);
  return (
    <Escenario tables={VENTAS} observe={observe}>
      <p className="px-4 py-2 font-mono text-micro text-muted">orden pedido: {asked}</p>
      <Facturas columns={["number", "customer", "state", "amount_total"]} />
    </Escenario>
  );
}

export const OrdenarLoPideAlServidor: Story = {
  render: () => <OrdenPedido />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("20 de 64");
    await userEvent.click(await canvas.findByRole("button", { name: "Total" }));
    await expect(await canvas.findByText("orden pedido: amount_total ↑")).toBeVisible();
    // The page that came back is the server's first 20 by total, not this page re-sorted.
    await waitFor(() => {
      const totals = canvas
        .getAllByRole("row")
        .slice(1)
        .map((row) =>
          Number(row.lastElementChild?.textContent?.replace(/\./g, "").replace(",", ".")),
        );
      expect(totals.length).toBe(20);
      expect(totals).toEqual([...totals].sort((a, b) => a - b));
    });
  },
};
