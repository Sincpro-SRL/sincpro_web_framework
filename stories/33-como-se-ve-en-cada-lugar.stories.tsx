import {
  EntityList,
  entityView,
  memoryTransport,
  SincproApp,
  useListing,
} from "@sincpro/web-framework";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Escenario } from "./support/escenario";
import { servidorVentas } from "./support/servidor";
import { clienteMeta, clientes, facturaMeta, facturas, VENTAS } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/33 · Un registro se ve bien donde se abra",
  parameters: {
    docs: {
      description: {
        component:
          "El mismo registro, sin escribir pantallas, en cada lugar del workspace. Los campos van en la grilla de formulario de web-ui (`FormSection`): **dos columnas** en una página y en un modal, **una** en un panel al costado, una ventana o un vistazo. Sin migas, pager ni acciones, el registro no dibuja un riel vacío. Una lista **dentro** de un registro que no está en una página empieza en **«filas»** (la tabla queda a un clic): siete columnas en 760 px partían cada número y cada fecha en tres renglones. Y un código, una fecha o un monto se leen enteros: nunca se parten.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

function App() {
  const transport = useMemo(() => {
    const servidor = servidorVentas();
    return memoryTransport(servidor.tables, { latency: 40, handle: servidor.handle });
  }, []);
  const views = useMemo(
    () => [
      entityView(facturas, { transport, name: "Facturas" }),
      entityView(clientes, { transport, name: "Clientes" }),
    ],
    [transport],
  );
  return (
    <div className="flex h-dvh min-h-0 flex-col bg-ground">
      <SincproApp
        transport={transport}
        views={views}
        entities={[facturas, clientes]}
        start={facturas.ref()}
        metas={{ [facturas.key]: facturaMeta, [clientes.key]: clienteMeta }}
      />
    </div>
  );
}

const primera = async (canvasElement: HTMLElement) =>
  (await within(canvasElement).findAllByText(/^F-2026-\d{4}$/))[0]!.textContent!;

/** Two fields of a form side by side: their labels start on the same line. */
function enLaMismaFila(scope: HTMLElement, a: string, b: string) {
  const top = (label: string) =>
    Math.round(
      within(scope).getByText(label, { selector: "label" }).getBoundingClientRect().top,
    );
  return top(a) === top(b);
}

export const EnLaPaginaDosColumnasAlCostadoUna: Story = {
  render: () => <App />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const numero = await primera(canvasElement);
    // Beside, from the list: a narrow panel, one column.
    await userEvent.click(await canvas.findByRole("button", { name: `Abrir en… ${numero}` }));
    await userEvent.click(await page.findByRole("menuitem", { name: "Abrir al costado" }));
    const enPanel = await page.findByRole("heading", { name: numero });
    const panel = enPanel.closest("article")!;
    await within(panel).findByText("Estado", { selector: "label" });
    await expect(enLaMismaFila(panel, "Estado", "Fecha")).toBe(false);
    // As a page: two columns.
    await userEvent.click(await canvas.findByText(numero, { selector: "td *, td" }));
    await waitFor(() =>
      expect(canvas.getAllByRole("heading", { name: numero }).length).toBeGreaterThan(0),
    );
    const enPagina = canvas
      .getAllByRole("heading", { name: numero })
      .map((one) => one.closest("article")!)
      .find(
        (one) => one !== panel && within(one).queryByText("Estado", { selector: "label" }),
      )!;
    await expect(enLaMismaFila(enPagina, "Estado", "Fecha")).toBe(true);
  },
};

/**
 * A modal is already a card: the record inside is one surface, never a sheet on the ground —
 * though opened from the list its rail carries «1 / 64». With web-ui guessing the paper from the
 * rail, the pager put a sheet inside the modal, and a rail that came or went while it was on
 * screen swapped the whole form under the field being typed in (`Record placement`, web-ui 1.8).
 */
export const EnUnModalEsUnaTarjeta: Story = {
  render: () => <App />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const numero = await primera(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: `Abrir en… ${numero}` }));
    await userEvent.click(await page.findByRole("menuitem", { name: "Abrir en un modal" }));
    const modal = await page.findByRole("dialog");
    // The modal titles itself too (web-ui repeats it): the record's title is the one in an article.
    let titulo: HTMLElement | undefined;
    await waitFor(() => {
      titulo = within(modal)
        .getAllByRole("heading", { name: numero })
        .find((one) => one.closest("article") !== null);
      expect(titulo).toBeDefined();
    });
    const registro = titulo!.closest("article")!;
    await within(registro).findByText(/^1 \/ 64$/);
    // web-ui draws a sheet on its ground (`bg-ground`) INSIDE the record, the title on the
    // sheet; a card has no ground of its own (the app's, around the modal, is not the record's).
    const suelo = titulo!.closest(".bg-ground");
    await expect(suelo !== null && registro.contains(suelo)).toBe(false);
  },
};

export const UnaListaDentroDeUnModalEmpiezaEnFilas: Story = {
  render: () => <App />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText(await primera(canvasElement)));
    await userEvent.click(await canvas.findByRole("button", { name: "Abrir en un modal" }));
    const modal = await canvas.findByRole("dialog");
    // The form in a modal: two columns, and no empty rail under its title.
    await within(modal).findByText("Nombre", { selector: "label" });
    await expect(enLaMismaFila(modal, "Nombre", "NIT")).toBe(true);
    // Its invoices start as rows — no seven-column table squeezed into 760 px.
    await userEvent.click(await within(modal).findByRole("tab", { name: /Facturas/ }));
    await within(modal).findAllByText(/^F-2026-\d{4}$/);
    await expect(within(modal).queryByRole("columnheader", { name: /Número/ })).toBeNull();
    // The table is a click away.
    await userEvent.click(within(modal).getByLabelText("Tabla"));
    await expect(
      await within(modal).findByRole("columnheader", { name: /Número/ }),
    ).toBeVisible();
  },
};

function Angosta() {
  const listing = useListing(facturas, { pageSize: 5 });
  return (
    <div className="max-w-2xl">
      <EntityList
        listing={listing}
        search={false}
        columns={[
          "number",
          "customer_name",
          "state",
          "invoice_date",
          "due_date",
          "amount_total",
          "tags",
          "payment",
        ]}
      />
    </div>
  );
}

export const UnCodigoUnaFechaUnMontoNoSeParten: Story = {
  render: () => (
    <Escenario tables={VENTAS}>
      <Angosta />
    </Escenario>
  ),
  play: async ({ canvasElement }) => {
    const numero = await primera(canvasElement);
    // The lines its text takes — a box is one rect however many lines it holds; its text's
    // range has one rect per line.
    const lines = (el: Element) => {
      const range = el.ownerDocument.createRange();
      range.selectNodeContents(el);
      return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
    };
    const cell = within(canvasElement).getByText(numero);
    // One line: a code read whole, however narrow the table.
    await expect(lines(cell)).toBe(1);
    await expect(within(canvasElement).getByRole("table")).toBeVisible();
    const fecha = within(canvasElement).getAllByText(/^\d{1,2}\s\S+\s\d{4}$/u, {
      selector: "td, td *",
    })[0]!;
    await expect(lines(fecha)).toBe(1);
  },
};
