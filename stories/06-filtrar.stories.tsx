import { EntityList, type NamedFilter, useListing } from "@sincpro/web-framework";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Escenario } from "./support/escenario";
import {
  type Cliente,
  clientes,
  type Factura,
  FACTURAS,
  facturas,
  VENTAS,
} from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/06 · Buscar y filtrar con la barra",
  parameters: {
    docs: {
      description: {
        component:
          "La barra de web-ui, alimentada por la meta. **Buscar por nombre** es una faceta: los campos que la plantilla de búsqueda de la entidad nombra, y después los demás campos de texto. **Una pregunta escrita** («total > 5000») se arma con los operadores que cada campo acepta. **Un filtro con nombre** («sólo pagadas») es un clic. Y lo que nadie previó — un grupo O dentro de un Y, una negación — se escribe en el **constructor de criteria**. Todo termina en UN `where` que contesta el servidor: nada se filtra en la página.\n\nBuscar una factura por el **nombre del cliente** funciona porque la entidad publica `customer_name`: criteria compara los campos propios de un agregado, así que el nombre de otro tiene que estar en la factura (o en su plantilla de búsqueda). No se resuelve en el cliente.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

const FILTROS: NamedFilter<Factura>[] = [
  {
    id: "pagadas",
    label: "Sólo pagadas",
    where: { field: "state", operator: "=", value: "paid" },
  },
  {
    id: "grandes",
    label: "Más de Bs. 5.000",
    where: { field: "amount_total", operator: ">", value: 5000 },
  },
  {
    id: "abiertas",
    label: "Por cobrar",
    where: {
      any: [
        { field: "state", operator: "=", value: "posted" },
        { field: "state", operator: "=", value: "draft" },
      ],
    },
  },
];

/** The search bar's text input. */
function barInput(root: HTMLElement): HTMLInputElement {
  const input = root.querySelector<HTMLInputElement>("input[type=text], input:not([type])");
  if (input === null) throw new Error("the search bar has no text input");
  return input;
}

const POR_COBRAR = FACTURAS.filter((f) => f.state === "posted" || f.state === "draft");
const PAGADAS = FACTURAS.filter((f) => f.state === "paid");
const PAGADAS_GLOBEX = PAGADAS.filter((f) => f.customer_name.includes("Globex"));

function Facturas() {
  const listing = useListing(facturas, { paging: "more", pageSize: 20 });
  return (
    <EntityList
      listing={listing}
      filters={FILTROS}
      columns={["number", "customer", "state", "invoice_date", "amount_total"]}
    />
  );
}

export const UnFiltroConNombreYElNombreDelCliente: Story = {
  render: () => (
    <Escenario tables={VENTAS}>
      <Facturas />
    </Escenario>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("20 de 64");

    await userEvent.click(await canvas.findByRole("button", { name: /Filtrar/ }));
    await userEvent.click(await canvas.findByRole("button", { name: "Sólo pagadas" }));
    const shown = Math.min(20, PAGADAS.length);
    await expect(await canvas.findByText(`${shown} de ${PAGADAS.length}`)).toBeVisible();

    // With a chip put, the bar's input loses its placeholder — and with it its only name
    // (web-ui gap, see docs/ROADMAP.md): it is found as the bar's one text input.
    await userEvent.type(barInput(canvasElement), "Globex");
    await userEvent.click(
      await canvas.findByRole("button", { name: /Nombre del cliente\s*:\s*contiene Globex/ }),
    );
    const total = PAGADAS_GLOBEX.length;
    await expect(await canvas.findByText(`${total} de ${total}`)).toBeVisible();
  },
};

export const UnaPreguntaEnElConstructor: Story = {
  render: () => (
    <Escenario tables={VENTAS}>
      <Facturas />
    </Escenario>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await canvas.findByText("20 de 64");
    await userEvent.click(await canvas.findByRole("button", { name: /Filtrar/ }));
    await userEvent.click(await canvas.findByRole("button", { name: "Por cobrar" }));
    // The panel stays open after a pick: the builder is opened from it, with what was put.
    await userEvent.click(
      await canvas.findByRole("button", { name: /Abrir el constructor/ }),
    );
    // The window fades in: it is in the document before it is visible.
    const dialog = await page.findByRole("dialog", { name: "Constructor de criteria" });
    await waitFor(() => expect(dialog).toBeVisible());
    // Applying what it opened with keeps the same question: the list stays on «por cobrar».
    await userEvent.click(within(dialog).getByRole("button", { name: "Aplicar" }));
    await expect(await canvas.findByText(`20 de ${POR_COBRAR.length}`)).toBeVisible();
  },
};

const CLIENTES_FILTROS: NamedFilter<Cliente>[] = [
  {
    id: "activos",
    label: "Sólo activos",
    where: { field: "active", operator: "=", value: true },
  },
];

export const ClientesPorNombreONit: Story = {
  render: function Render() {
    const listing = useListing(clientes, { paging: "more" });
    return <EntityList listing={listing} filters={CLIENTES_FILTROS} />;
  },
  decorators: [
    (Story) => (
      <Escenario tables={VENTAS}>
        <Story />
      </Escenario>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("8 de 8");
    await userEvent.type(await canvas.findByPlaceholderText(/Buscar, o #/), "Glob");
    await userEvent.click(
      await canvas.findByRole("button", { name: /^Nombre\s*:\s*contiene Glob/ }),
    );
    await expect(await canvas.findByText("1 de 1")).toBeVisible();
  },
};
