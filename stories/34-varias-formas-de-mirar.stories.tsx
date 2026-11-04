import { EntityList, useListing } from "@sincpro/web-framework";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Escenario } from "./support/escenario";
import { facturas, VENTAS } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/34 · Un conjunto, varias formas de mirarlo",
  parameters: {
    docs: {
      description: {
        component:
          "Una lista que no dice cómo mirarla ofrece **todas las caras que no piden configuración**: **tabla**, **filas**, **tablero** y **planilla** (la de web-ui, estilo Excel, virtualizada: cada celda un valor). Es el mismo conjunto en cada una —la misma búsqueda, el mismo orden, la misma página del servidor—; cambiar de cara no vuelve a preguntar. Una pantalla que quiere menos lo dice (`views`), y una lista adentro de un registro empieza con la tabla (o en filas, si no está en una página). El calendario y el pivote necesitan preguntarle al servidor por un rango o por dos niveles: están en el ROADMAP.",
      },
    },
  },
  decorators: [
    (Story) => (
      <Escenario tables={VENTAS}>
        <Story />
      </Escenario>
    ),
  ],
};

export default meta;
type Story = StoryObj;

const COLUMNAS = ["number", "customer_name", "state", "amount_total"] as const;

export const TodasLasCaras: Story = {
  render: function Render() {
    const listing = useListing(facturas, { pageSize: 10 });
    return <EntityList listing={listing} columns={COLUMNAS} />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const primera = (await canvas.findAllByText(/^F-2026-\d{4}$/))[0]!.textContent!;
    for (const cara of ["Tabla", "Filas", "Tablero", "Planilla"])
      await expect(canvas.getByLabelText(cara)).toBeVisible();

    // The spreadsheet: the table's columns, every cell a value — the same page.
    await userEvent.click(canvas.getByLabelText("Planilla"));
    const planilla = await canvas.findByRole("grid");
    await expect(planilla).toHaveAttribute("aria-colcount", String(COLUMNAS.length + 1));
    await waitFor(() => expect(within(planilla).getByText(primera)).toBeVisible());

    // The same set in each: the board shows the same first record.
    await userEvent.click(canvas.getByLabelText("Tablero"));
    await expect((await canvas.findAllByText(primera)).length).toBeGreaterThan(0);
  },
};

export const SoloLasQueLaPantallaDice: Story = {
  render: function Render() {
    const listing = useListing(facturas, { pageSize: 10 });
    return <EntityList listing={listing} columns={COLUMNAS} views={["sheet", "table"]} />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The first one asked is the one shown.
    await expect(await canvas.findByRole("grid")).toBeVisible();
    await expect(canvas.queryByLabelText("Tablero")).toBeNull();
  },
};
