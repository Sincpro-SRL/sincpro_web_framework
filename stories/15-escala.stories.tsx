import { EntityList, useListing } from "@sincpro/web-framework";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Escenario } from "./support/escenario";
import { movimientos, TABLAS } from "./support/movimientos";

const meta: Meta = {
  title: "Casos de uso/15 · Un conjunto grande sin congelar",
  parameters: {
    docs: {
      description: {
        component:
          "Doscientos mil movimientos. Por **páginas** (el modo por defecto) la pantalla tiene UNA página y camina el cursor del servidor — keyset, sin `offset`: la página mil cuesta lo que la primera —, y el total lo cuenta el servidor con techo (`10000+`) en vez de contar todo. Con **«cargar más»** la lista deja de crecer en su techo y pide refinar la búsqueda: una tabla que no virtualiza y no para de crecer es una pantalla que se congela. Buscar, filtrar y ordenar son siempre preguntas al servidor. Y el mismo conjunto se mira como **tabla, filas o tablero**.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

/** The rows of the table on screen, header excluded. */
const bodyRows = (root: HTMLElement) => within(root).getAllByRole("row").length - 1;

export const PorPaginas: Story = {
  render: function Render() {
    const listing = useListing(movimientos, { pageSize: 50 });
    return (
      <EntityList
        listing={listing}
        search="box"
        columns={["id", "concept", "account", "amount", "posted_on"]}
      />
    );
  },
  decorators: [
    (Story) => (
      <Escenario tables={TABLAS} latency={50}>
        <Story />
      </Escenario>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("M-0200000");
    await expect(bodyRows(canvasElement)).toBe(50);
    await expect(canvas.getByRole("button", { name: "Página anterior" })).toBeDisabled();

    await userEvent.click(canvas.getByRole("button", { name: "Página siguiente" }));
    await expect(await canvas.findByText("M-0199950")).toBeVisible();
    await expect(canvas.getByText("51–100")).toBeVisible();
    await expect(bodyRows(canvasElement)).toBe(50);

    await userEvent.click(canvas.getByRole("button", { name: "Página anterior" }));
    await expect(await canvas.findByText("M-0200000")).toBeVisible();

    // A search is a question to the server, and starts on its first page.
    await userEvent.type(canvas.getByRole("searchbox", { name: "Buscar" }), "Ajuste 199995");
    await expect(await canvas.findByText("M-0199995")).toBeVisible();
    await waitFor(() => expect(bodyRows(canvasElement)).toBe(1));
  },
};

export const CargarMasTieneTecho: Story = {
  render: function Render() {
    const listing = useListing(movimientos, { paging: "more", pageSize: 100, maxRows: 300 });
    return (
      <EntityList listing={listing} search={false} columns={["id", "concept", "amount"]} />
    );
  },
  decorators: [
    (Story) => (
      <Escenario tables={TABLAS} latency={50}>
        <Story />
      </Escenario>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("M-0200000");
    await userEvent.click(canvas.getByRole("button", { name: "Cargar más" }));
    await waitFor(() => expect(bodyRows(canvasElement)).toBe(200));
    await userEvent.click(canvas.getByRole("button", { name: "Cargar más" }));
    await expect(await canvas.findByText(/Se muestran los primeros 300/)).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Cargar más" })).toBeNull();
    await expect(bodyRows(canvasElement)).toBe(300);
  },
};

export const ElMismoConjuntoEnVariasVistas: Story = {
  render: function Render() {
    const listing = useListing(movimientos, { pageSize: 12 });
    return (
      <EntityList
        listing={listing}
        views={["rows", "table", "board"]}
        columns={["id", "concept", "account", "amount"]}
      />
    );
  },
  decorators: [
    (Story) => (
      <Escenario tables={TABLAS} latency={50}>
        <Story />
      </Escenario>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Rows first: the record by its display, its key and facts beside it.
    await expect(await canvas.findByText("Ajuste 200000")).toBeVisible();
    await expect(canvas.queryByRole("columnheader", { name: /Concepto/ })).toBeNull();
    await userEvent.click(canvas.getByLabelText("Tabla"));
    await expect(await canvas.findByRole("columnheader", { name: /Concepto/ })).toBeVisible();
  },
};
