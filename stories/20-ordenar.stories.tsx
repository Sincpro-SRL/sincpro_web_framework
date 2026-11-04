import type { Criteria } from "@sincpro/criteria";
import { EntityList, useListing } from "@sincpro/web-framework";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Escenario } from "./support/escenario";
import { FACTURAS, facturas, VENTAS } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/20 · Ordenar",
  parameters: {
    docs: {
      description: {
        component:
          "Ordenar es una pregunta al **servidor**, nunca a la página: una página ordenada en el navegador miente sobre la página dos. Un clic en el encabezado de una columna que la meta marca `sortable` manda `order` en el criteria y la lista vuelve a la primera página; otro clic invierte el sentido. Sin orden pedido manda el `default_order` de la entidad.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

const pedidos: Criteria[] = [];
const observar = (_route: string, criteria: Criteria) => pedidos.push(criteria);

/** The invoice numbers by total, over ALL 64 — what the first row must be, whichever page. */
const porTotal = [...FACTURAS].sort(
  (a, b) => Number(a.amount_total) - Number(b.amount_total),
);

export const PorUnaColumna: Story = {
  render: function Render() {
    const listing = useListing(facturas, { pageSize: 20 });
    return <EntityList listing={listing} columns={["number", "state", "amount_total"]} />;
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
    await canvas.findByText("1–20");
    const total = () =>
      within(canvas.getByRole("columnheader", { name: /Total/ })).getByRole("button");
    const primera = () =>
      canvasElement.querySelector("tbody tr:not([aria-hidden]) td")?.textContent ?? "";

    await userEvent.click(total());
    // The ORDER travelled, and the smallest of all 64 — not of the page — comes first.
    await waitFor(() =>
      expect(pedidos.at(-1)?.order).toEqual([{ field: "amount_total", descending: false }]),
    );
    await waitFor(() => expect(primera()).toContain(porTotal[0]!.number));
    await expect(canvas.getByRole("columnheader", { name: /Total/ })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );

    await userEvent.click(total());
    await waitFor(() =>
      expect(pedidos.at(-1)?.order).toEqual([{ field: "amount_total", descending: true }]),
    );
    await waitFor(() => expect(primera()).toContain(porTotal.at(-1)!.number));
    // A new order starts on the first page: a cursor belongs to one order.
    await expect(canvas.getByText("1–20")).toBeVisible();
  },
};

/** The paid ones by state, then by total — over ALL 64, as the server filters and sorts. */
const pagadasPorEstadoYTotal = FACTURAS.filter((f) => f.state === "paid").sort(
  (a, b) => a.state.localeCompare(b.state) || Number(a.amount_total) - Number(b.amount_total),
);

export const PorVariosCampos: Story = {
  render: function Render() {
    const listing = useListing(facturas, { pageSize: 20 });
    return <EntityList listing={listing} columns={["number", "state", "amount_total"]} />;
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
    const page = within(canvasElement.ownerDocument.body);
    await canvas.findByText("1–20");
    const builder = async () => {
      await userEvent.click(await canvas.findByRole("button", { name: /Filtrar/ }));
      await userEvent.click(
        await canvas.findByRole("button", { name: /Abrir el constructor/ }),
      );
      const dialog = await page.findByRole("dialog", { name: "Constructor de criteria" });
      await waitFor(() => expect(dialog).toBeVisible());
      return within(dialog);
    };
    // The builder filters (state = paid) and orders by as many fields as asked: state, then
    // total — one gesture, both must stand.
    let dialog = await builder();
    await userEvent.selectOptions(dialog.getByLabelText("Campo"), "state");
    const valor = dialog
      .getByLabelText("Comparación")
      .closest("[role=dialog]")!
      .querySelector<HTMLInputElement>("input")!;
    await userEvent.type(valor, "paid");
    // «ordenar por…» opens the fields that may order, named like it: pick one there.
    const ordenarPor = async (field: string) => {
      await userEvent.click(dialog.getByRole("button", { name: "ordenar por…" }));
      const offered = (await dialog.findAllByLabelText("ordenar por…")).find(
        (one) => one.tagName !== "BUTTON",
      )!;
      await userEvent.click(within(offered).getAllByText(field)[0]!);
    };
    await ordenarPor("state");
    await ordenarPor("amount_total");
    await userEvent.click(dialog.getByRole("button", { name: "Aplicar" }));
    // Both travel to the server, in that order — and the first row is the first of all 64.
    await waitFor(() =>
      expect(pedidos.at(-1)?.order).toEqual([{ field: "state" }, { field: "amount_total" }]),
    );
    await expect(JSON.stringify(pedidos.at(-1)?.where)).toContain("paid");
    const primera = () =>
      canvasElement.querySelector("tbody tr:not([aria-hidden]) td")?.textContent ?? "";
    await waitFor(() => expect(primera()).toContain(pagadasPorEstadoYTotal[0]!.number));
    // The table shows the first; the builder, reopened, keeps both.
    await expect(canvas.getByRole("columnheader", { name: /Estado/ })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    await userEvent.keyboard("{Escape}");
    dialog = await builder();
    await expect(dialog.getByLabelText("quitar el orden por state")).toBeVisible();
    await expect(dialog.getByLabelText("quitar el orden por amount_total")).toBeVisible();
  },
};
