import type { Criteria } from "@sincpro/criteria";
import { defineList, EntityList, textOf, useListing } from "@sincpro/web-framework";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Escenario } from "./support/escenario";
import { facturaMeta, FACTURAS, facturas, VENTAS } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/19 · Agrupar",
  parameters: {
    docs: {
      description: {
        component:
          "«Agrupar por», en el mismo panel que los filtros, ofrece los campos que la meta marca `groupable` — una fecha, con sus cortes (año, trimestre, mes, semana, día). Los grupos los **cuenta el servidor** sobre todo el conjunto, no sobre la página: «Pagada · 22» es el total real aunque la página tenga veinte filas. Un grupo empieza cerrado y **sus filas se piden al abrirlo**, con el criteria que el propio grupo trae. Lo que se busca o filtra acota los grupos igual que acota la lista.\n\nAgrupada, la lista se ve en filas: la tabla de web-ui agrupa las filas que tiene en la mano — la página — y eso no es un conteo (`docs/ROADMAP.md`).",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

/** Every list request that reached the server, as it arrived. */
const pedidos: { route: string; criteria: Criteria }[] = [];
const observar = (route: string, criteria: Criteria) => pedidos.push({ route, criteria });

function Facturas() {
  const listing = useListing(facturas, { pageSize: 20 });
  return (
    <EntityList listing={listing} columns={["number", "customer", "state", "amount_total"]} />
  );
}

const escenario = [
  (Story: () => React.JSX.Element) => (
    <Escenario tables={VENTAS} observe={observar}>
      <Story />
    </Escenario>
  ),
];

async function agruparPor(canvasElement: HTMLElement, ...campos: string[]) {
  const canvas = within(canvasElement);
  const page = within(canvasElement.ownerDocument.body);
  await canvas.findByText("1–20");
  await userEvent.click(canvas.getByRole("button", { name: /agrupar/i }));
  // A field of «Group by» is a toggle (`aria-pressed`); a column header has the same name.
  for (const campo of campos)
    await userEvent.click(await page.findByRole("button", { name: campo, pressed: false }));
  await userEvent.keyboard("{Escape}");
}

/** The last grouped question the server got. */
const agrupado = () =>
  [...pedidos].reverse().find((one) => one.criteria.grouping?.group_by?.length)?.criteria
    .grouping?.group_by;

export const PorEstado: Story = {
  render: () => <Facturas />,
  decorators: escenario,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await agruparPor(canvasElement, "Estado");
    // Counted by the server over all 64 invoices: 22 paid, though the page held 20 rows.
    const pagadas = await canvas.findByRole("button", { name: /Pagada.*22/ });
    await expect(canvas.getByRole("button", { name: /Borrador.*11/ })).toBeVisible();
    await expect(canvas.getByText(/4 grupos · 64 registros/)).toBeVisible();
    await expect(agrupado()).toEqual([{ field: "state" }]);
    // A group starts closed: its rows are read when it is opened, with its own criteria.
    await expect(canvas.queryByText("F-2026-0003")).toBeNull();
    await userEvent.click(pagadas);
    await expect(await canvas.findByText("F-2026-0003")).toBeVisible();
    const leido = pedidos.at(-1)!.criteria;
    await expect(JSON.stringify(leido.where)).toContain('"paid"');
    await expect(leido.grouping).toBeUndefined();
  },
};

export const PorEstadoYMes: Story = {
  render: () => <Facturas />,
  decorators: escenario,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await canvas.findByText("1–20");
    await userEvent.click(canvas.getByRole("button", { name: /agrupar/i }));
    await userEvent.click(
      await page.findByRole("button", { name: "Estado", pressed: false }),
    );
    // A date unfolds into its cuts.
    await userEvent.click(await page.findByRole("button", { name: "Fecha" }));
    await userEvent.click(await page.findByRole("button", { name: /^Mes$/, pressed: false }));
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(agrupado()).toEqual([
        { field: "state" },
        { field: "invoice_date", grain: "month" },
      ]),
    );
    // Opening a state shows its months, each with its own count.
    await userEvent.click(await canvas.findByRole("button", { name: /Pagada.*22/ }));
    const meses = await canvas.findAllByRole("button", { name: /2026/ });
    await expect(meses.length).toBeGreaterThan(0);
  },
};

const pagadas = FACTURAS.filter((one) => one.state === "paid");
const totalPagadas = pagadas.reduce((sum, one) => sum + Number(one.amount_total), 0);

function FacturasPorEstado() {
  return (
    <EntityList
      listing={useListing(porEstado, { pageSize: 20 })}
      columns={["number", "customer", "state", "amount_total"]}
    />
  );
}

const porEstado = defineList(facturas, {
  id: "por-estado",
  title: "Facturas por estado",
  groupBy: [{ field: "state" }],
});

/** A group says how MUCH, not only how many: «Pagada · 22 · Total …», summed by the server over
 *  every invoice of the state — the figure the model computes (`amount_total`, read-only). */
export const CadaGrupoConSuTotal: Story = {
  render: () => <FacturasPorEstado />,
  decorators: [
    (Story) => (
      <Escenario tables={VENTAS}>
        <Story />
      </Escenario>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const total = `Total ${textOf(facturaMeta, "amount_total", totalPagadas, "es")}`;
    await expect(await canvas.findByText(total)).toBeVisible();
    // The count beside it is every paid invoice too, not the page.
    await expect(canvas.getByText(String(pagadas.length))).toBeVisible();
  },
};
