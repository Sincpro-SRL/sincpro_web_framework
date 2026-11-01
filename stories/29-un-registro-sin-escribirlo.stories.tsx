import { entityView, memoryTransport, SincproApp } from "@sincpro/web-framework";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { servidorVentas } from "./support/servidor";
import { clienteMeta, clientes, facturaMeta, facturas } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/29 · Una aplicación sin escribir pantallas",
  parameters: {
    docs: {
      description: {
        component:
          "Una aplicación que **declara sus entidades y nada más**: `entityView(facturas, { transport, name })`, sin lista ni registro escritos. Lo que se dibuja sale de la metadata y es útil desde el primer día:\n\n- **la lista** — `EntityList`: barra de búsqueda literal, páginas, «Nuevo»;\n- **el registro** — `EntityRecord`: arriba su nombre, su tipo y su estado (el resumen); los campos en el orden del modelo, un many2one como selector de su entidad, la contabilidad y la autoría al pie (`Record.Audit`), cada one2many en su pestaña (las líneas que trajo, o la lista de otra entidad que el servidor busca y pagina), «Guardar / Descartar», el conflicto, el borrador recuperado y la historia si la entidad la declara;\n- **dónde abre** — un relacionado en un modal; desde el modal, al costado.\n\nNada de esto es una jaula: `fields`, `pages` y `actions` eligen y suman, y cualquier pantalla puede dejar `EntityRecord` y quedarse con `useRecord` + `RecordField`.",
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

const GLOBEX_INVOICE = "F-2026-0004";

export const DeLaListaAlRegistroYSusRelaciones: Story = {
  render: () => <App />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    // The list nobody wrote: searched literally, on Enter — and a row to the record.
    await userEvent.type(await canvas.findByRole("textbox"), `${GLOBEX_INVOICE}{Enter}`);
    await userEvent.click(await canvas.findByText(GLOBEX_INVOICE));
    await canvas.findByRole("heading", { name: GLOBEX_INVOICE });
    // Its state on top (and in its field), in the model's words.
    await waitFor(() => expect(canvas.getAllByText("Pagada").length).toBeGreaterThan(1));
    // A many2one, as a picker of its entity — by name, not «C-004».
    const cliente = await canvas.findByRole("combobox", { name: /Cliente \(código\)/ });
    await waitFor(() => expect(cliente).toHaveValue("Globex Bolivia"));
    // Its lines in a page of their own, as the table the record brought.
    await userEvent.click(await canvas.findByRole("tab", { name: /Líneas/ }));
    await expect(await canvas.findByRole("columnheader", { name: /Producto/ })).toBeVisible();
    // A list of words is chips, and a new one is typed in.
    const etiquetas = await canvas.findByRole("combobox", { name: "Etiquetas" });
    await expect(canvas.getByText("exportación")).toBeVisible();
    await userEvent.type(etiquetas, "mayorista{Enter}");
    await expect(await canvas.findByText("mayorista")).toBeVisible();
    // Editing shows «save / discard»; saving keeps the record.
    const nota = await canvas.findByRole("textbox", { name: "Nota" });
    await userEvent.type(nota, "Entregar el lunes");
    // Read again after saving, the record STAYS on screen: the field is never taken out for a
    // skeleton in between (a click landing then was lost — the full run found it).
    let remounted = false;
    const watch = new MutationObserver(() => {
      if (!canvasElement.contains(nota)) remounted = true;
    });
    watch.observe(canvasElement, { subtree: true, childList: true });
    await userEvent.click(await canvas.findByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(canvas.queryByRole("button", { name: "Guardar" })).toBeNull());
    await waitFor(() =>
      expect(canvas.getByRole("textbox", { name: "Nota" })).toHaveValue("Entregar el lunes"),
    );
    await new Promise((resolve) => setTimeout(resolve, 300)); // past the re-read (40 ms)
    watch.disconnect();
    await expect(remounted).toBe(false);
    // The customer opens in a modal — its own record nobody wrote, with its invoices.
    await userEvent.click(canvas.getByRole("button", { name: "Abrir en un modal" }));
    const modal = await canvas.findByRole("dialog", { name: "Globex Bolivia" });
    await userEvent.click(await within(modal).findByRole("tab", { name: /Facturas/ }));
    // Its invoices, without the column that points back to it: every row is this customer's.
    await within(modal).findByRole("columnheader", { name: /Número/ });
    await expect(
      within(modal).queryByRole("columnheader", { name: /Cliente \(código\)/ }),
    ).toBeNull();
    const otras = await within(modal).findAllByText(/^F-2026-\d{4}$/);
    const otra = otras.find((one) => one.textContent !== GLOBEX_INVOICE)!;
    const number = otra.textContent ?? "";
    await userEvent.click(otra);
    // From inside the modal, the invoice opens BESIDE it — never a modal over a modal.
    await waitFor(() =>
      expect(page.getAllByRole("heading", { name: number }).length).toBeGreaterThan(0),
    );
    await expect(canvas.getAllByRole("dialog")).toHaveLength(1);
  },
};

export const AnteriorYSiguiente: Story = {
  render: () => <App />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The list's first page, in its order: the last row of it is the 50th of 64.
    await canvas.findByText("1–50");
    const numbers = canvas.getAllByText(/^F-2026-\d{4}$/).map((one) => one.textContent ?? "");
    const fiftieth = numbers[49]!;
    await userEvent.click(canvas.getAllByText(fiftieth)[0]!);
    await canvas.findByRole("heading", { name: fiftieth });
    await expect(await canvas.findByText("50 / 64")).toBeVisible();
    // Past the edge of the page: the server answers the next one — no list on screen holds it.
    await userEvent.click(canvas.getByRole("button", { name: "Siguiente" }));
    await expect(await canvas.findByText("51 / 64")).toBeVisible();
    await waitFor(() => expect(canvas.queryByRole("heading", { name: fiftieth })).toBeNull());
    // In place: the neighbour is no step deeper — the crumb still leads to the list only.
    await expect(canvas.getAllByRole("link", { name: "Facturas" })).toHaveLength(1);
    await userEvent.click(canvas.getByRole("button", { name: "Anterior" }));
    await expect(await canvas.findByRole("heading", { name: fiftieth })).toBeVisible();
    await expect(canvas.getByText("50 / 64")).toBeVisible();
  },
};
