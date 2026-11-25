import { EntityList, useListing } from "@sincpro/web-framework";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Escenario } from "./support/escenario";
import { servidorVentas } from "./support/servidor";
import { clientes, facturas } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/71 · Lo que se buscó antes",
  parameters: {
    docs: {
      description: {
        component:
          "Con `recent`, la barra de una lista **recuerda en este navegador** las últimas búsquedas (web-ui 2.14, `recentKey`) y las ofrece como «Recientes» cuando toma el foco vacía: quien busca todos los días «Estado: Pagada» la vuelve a poner con un clic. `recent` (o `recent={true}`) las guarda bajo la clave de la lista —la de una lista con nombre, si no la de su entidad—; un texto, bajo ese nombre (uno por empresa, por ejemplo). **Apagado por defecto**: lo buscado puede nombrar a un cliente, y si un navegador puede guardarlo lo decide la aplicación.",
      },
    },
  },
};
export default meta;
type Story = StoryObj;

/** Where web-ui keeps a bar's recent searches, by the list's key — the entity's here. */
const GUARDADAS = `sincpro-web-ui:search-recent:${facturas.kind}`;

function olvidar() {
  try {
    window.localStorage.removeItem(GUARDADAS);
  } catch {
    /* No storage: nothing to forget. */
  }
}

function Facturas({ recent }: { recent?: boolean }) {
  const listing = useListing(facturas);
  return <EntityList listing={listing} {...(recent === undefined ? {} : { recent })} />;
}

function Ventas({ recent }: { recent?: boolean }) {
  const { tables } = useMemo(servidorVentas, []);
  return (
    <Escenario tables={tables} latency={40} entities={[facturas, clientes]}>
      <Facturas {...(recent === undefined ? {} : { recent })} />
    </Escenario>
  );
}

/** Search «Estado: Pagada», then take it off: the list is whole again. */
async function buscarYQuitar(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await canvas.findAllByText("Importadora del Oriente");
  const barra = canvas.getByRole("combobox", { name: "Buscar" });
  await userEvent.type(barra, "pagada");
  const sugerencias = within(await canvas.findByRole("listbox", { name: "Sugerencias" }));
  await userEvent.click(await sugerencias.findByRole("option", { name: /Estado.*Pagada/ }));
  const chip = await canvas.findByTitle("Estado: Pagada");
  await waitFor(() => expect(canvas.queryAllByText("Borrador")).toHaveLength(0));
  // Backspace on the empty bar marks the last chip, and a second one removes it (web-ui 2.14).
  await userEvent.click(barra);
  await userEvent.keyboard("{Backspace}{Backspace}");
  await waitFor(() => expect(chip).not.toBeInTheDocument());
  await waitFor(() => expect(canvas.queryAllByText("Borrador").length).toBeGreaterThan(0));
  // The focus leaves the bar, so the next one is a fresh start.
  await userEvent.click(canvas.getAllByRole("heading")[0]!);
  return barra;
}

export const LaVuelveAPonerConUnClic: Story = {
  beforeEach: olvidar,
  render: () => <Ventas recent />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const barra = await buscarYQuitar(canvasElement);
    // The empty bar, focused, offers what was searched — kept under the entity's key.
    await userEvent.click(barra);
    await expect(await canvas.findByText("Recientes")).toBeVisible();
    await expect(window.localStorage.getItem(GUARDADAS)).toContain("Estado: Pagada");
    await userEvent.click(
      within(await canvas.findByRole("listbox", { name: "Sugerencias" })).getByRole(
        "option",
        {
          name: /Estado.*Pagada/,
        },
      ),
    );
    // Put again, it filters again.
    await expect(await canvas.findByTitle("Estado: Pagada")).toBeVisible();
    await waitFor(() => expect(canvas.queryAllByText("Borrador")).toHaveLength(0));
  },
};

export const SinRecentNoSeGuardaNada: Story = {
  beforeEach: olvidar,
  render: () => <Ventas />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const barra = await buscarYQuitar(canvasElement);
    await userEvent.click(barra);
    // It offers the fields to search by, never what was searched.
    await expect(await canvas.findByText("Buscar por")).toBeVisible();
    await expect(canvas.queryByText("Recientes")).toBeNull();
    await expect(window.localStorage.getItem(GUARDADAS)).toBeNull();
  },
};
