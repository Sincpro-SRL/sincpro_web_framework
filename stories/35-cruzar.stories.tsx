import type { Criteria } from "@sincpro/criteria";
import { EntityList, useListing } from "@sincpro/web-framework";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Escenario } from "./support/escenario";
import { FACTURAS, facturas, VENTAS } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/35 · Cruzar un conjunto por dos campos",
  parameters: {
    docs: {
      description: {
        component:
          'La cara **pivote** cruza el conjunto por dos campos —estado por forma de pago— y en cada cruce dice cuántos y cuánto suman. Lo cuenta y lo suma **el servidor**, sobre todas las filas que coinciden: dos preguntas agrupadas (por los dos campos, y por las columnas solas para su total), ninguna fila traída, ningún total sumado en la pantalla. Sólo pregunta mientras es la cara que se mira. `EntityList pivot={{ rows: "state", columns: "payment" }}`; el pivote de web-ui (`folded`) lo dibuja.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

const pedidos: Criteria[] = [];
const observar = (_route: string, criteria: Criteria) => pedidos.push(criteria);

export const EstadoPorFormaDePago: Story = {
  render: function Render() {
    const listing = useListing(facturas, { pageSize: 10 });
    return (
      <EntityList
        listing={listing}
        columns={["number", "state", "payment", "amount_total"]}
        pivot={{ rows: "state", columns: "payment" }}
      />
    );
  },
  decorators: [
    (Story) => (
      <Escenario tables={VENTAS} observe={observar}>
        <Story />
      </Escenario>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findAllByText(/^F-2026-\d{4}$/);
    // Not on screen, the pivot asks nothing.
    const agrupados = () => pedidos.filter((one) => one.grouping !== undefined);
    await expect(agrupados()).toHaveLength(0);

    await userEvent.click(canvas.getByLabelText("Pivote"));
    // Two questions to the server — by both fields, and by the columns alone — and no rows.
    await waitFor(() => expect(agrupados()).toHaveLength(2));
    const [cruzado, porColumna] = agrupados() as Criteria[];
    await expect(JSON.stringify(cruzado!.grouping)).toContain(
      '"group_by":[{"field":"state"},{"field":"payment"}]',
    );
    await expect(JSON.stringify(porColumna!.grouping)).toContain(
      '"group_by":[{"field":"payment"}]',
    );
    await expect(cruzado!.pagination).toEqual({ limit: 1 });

    // Its words, not the server's values: «Pagada» by «Efectivo».
    const pivote = await canvas.findByRole("table");
    await expect(within(pivote).getByText("Pagada")).toBeVisible();
    await expect(within(pivote).getByText("Efectivo")).toBeVisible();
    // The crossing is the sum of ALL 64, not of the page of ten.
    const suma = FACTURAS.filter((f) => f.state === "paid" && f.payment === "cash").reduce(
      (total, f) => total + Number(f.amount_total),
      0,
    );
    const leida = (n: number) => n.toLocaleString("es-BO", { maximumFractionDigits: 0 });
    const fila = within(pivote).getByText("Pagada").closest("tr")!;
    await expect(
      [leida(Math.round(suma)), leida(Math.trunc(suma))].some((text) =>
        fila.textContent!.includes(text),
      ),
    ).toBe(true);
  },
};
