import { memoryTransport } from "@sincpro/client-framework";
import { EntityList, entityView, SincproApp, useListing } from "@sincpro/web-framework";
import type { OpenTarget } from "@sincpro/web-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Escenario } from "./support/escenario";
import { servidorVentas } from "./support/servidor";
import { clienteMeta, clientes, facturaMeta, facturas, VENTAS } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/32 · Abrir un registro donde haga falta",
  parameters: {
    docs: {
      description: {
        component:
          "Un registro se abre **en cualquier lugar que el workspace pueda ponerlo**, desde donde aparezca: una fila de la tabla, una fila de «filas», una tarjeta, una fila de un one2many. Apretar abre la **página**; el 👁 de web-ui da la **vista previa**; y **«Abrir en…»**, visible al lado del nombre y por teclado, ofrece el resto —un **modal**, **al costado**, una **ventana**— con las palabras de web-ui. Desde adentro de un modal no se ofrece otro modal (lo reemplazaría y perdería lo escrito). Una pantalla que quiere menos lo dice: `openTargets`.",
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

/** The first invoice the list shows — the newest. */
const primera = async (canvasElement: HTMLElement) =>
  (await within(canvasElement).findAllByText(/^F-2026-\d{4}$/))[0]!.textContent!;

/** The places «Abrir en…» of a record offers, by name. */
async function lugares(canvasElement: HTMLElement, name: string) {
  const canvas = within(canvasElement);
  const page = within(canvasElement.ownerDocument.body);
  await userEvent.click(await canvas.findByRole("button", { name: `Abrir en… ${name}` }));
  const menu = await page.findByRole("menu");
  return {
    menu,
    names: within(menu)
      .getAllByRole("menuitem")
      .map((item) => item.textContent?.trim()),
  };
}

export const DesdeLaTablaYLasFilas: Story = {
  render: () => <App />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const PRIMERA = await primera(canvasElement);
    // Beside the name, seen and reached by keyboard — not only icons for a hovering pointer.
    const { menu, names } = await lugares(canvasElement, PRIMERA);
    await expect(names).toEqual([
      "Abrir en un modal",
      "Vista previa",
      "Abrir al costado",
      "Abrir en una ventana",
    ]);
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Abrir en un modal" }));
    const modal = await canvas.findByRole("dialog", { name: PRIMERA });
    await expect(within(modal).getByRole("heading", { name: PRIMERA })).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(canvas.queryByRole("dialog", { name: PRIMERA })).toBeNull());

    // The look is web-ui's 👁 on the row; a press still opens the page.
    await expect(
      canvas.getAllByRole("button", { name: "Vista previa" }).length,
    ).toBeGreaterThan(0);

    // The rows face offers the same places.
    await userEvent.click(canvas.getByLabelText("Filas"));
    const filas = await lugares(canvasElement, PRIMERA);
    await expect(filas.names).toContain("Abrir al costado");
    await userEvent.click(
      within(filas.menu).getByRole("menuitem", { name: "Abrir al costado" }),
    );
    await expect(
      await page.findByRole("heading", { name: PRIMERA, level: undefined }),
    ).toBeVisible();
  },
};

export const DesdeUnOne2many: Story = {
  render: () => <App />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // An invoice, its customer in a modal, the customer's invoices — a list inside a record
    // inside a modal: its rows offer every place but another modal.
    await userEvent.click(await canvas.findByText(await primera(canvasElement)));
    await userEvent.click(await canvas.findByRole("button", { name: "Abrir en un modal" }));
    const modal = await canvas.findByRole("dialog");
    await userEvent.click(await within(modal).findByRole("tab", { name: /Facturas/ }));
    const numero = (await within(modal).findAllByText(/^F-2026-\d{4}$/))[0]!.textContent!;
    const { names } = await lugares(canvasElement, numero);
    await expect(names).toContain("Abrir al costado");
    await expect(names).toContain("Abrir en una ventana");
    await expect(names).not.toContain("Abrir en un modal");
  },
};

function Restringida() {
  const listing = useListing(facturas, { pageSize: 5 });
  const [abierto, setAbierto] = useState("");
  return (
    <div className="grid gap-2">
      <EntityList
        listing={listing}
        search={false}
        columns={["number", "customer_name"]}
        openTargets={["side"]}
        onOpenIn={(row, to: OpenTarget) => setAbierto(`${String(row.number)} → ${to}`)}
      />
      <p aria-label="Abierto">{abierto}</p>
    </div>
  );
}

export const SoloDondeLaPantallaDice: Story = {
  render: () => (
    <Escenario tables={VENTAS}>
      <Restringida />
    </Escenario>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const PRIMERA = await primera(canvasElement);
    // A screen that wants fewer places says so: one place, one entry.
    const { menu, names } = await lugares(canvasElement, PRIMERA);
    await expect(names).toEqual(["Abrir al costado"]);
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Abrir al costado" }));
    await expect(canvas.getByLabelText("Abierto")).toHaveTextContent(`${PRIMERA} → side`);
    // No look was allowed: no 👁.
    await expect(canvas.queryByRole("button", { name: "Vista previa" })).toBeNull();
  },
};
