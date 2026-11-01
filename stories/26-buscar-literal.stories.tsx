import type { Criteria } from "@sincpro/criteria";
import { EntityList, EntityPicker, useListing } from "@sincpro/web-framework";
import { Field } from "@sincpro/web-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Escenario } from "./support/escenario";
import { movimientos, TABLAS } from "./support/movimientos";
import { facturas, VENTAS } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/26 · Buscar como se espera",
  parameters: {
    docs: {
      description: {
        component:
          "Un texto tipeado es **siempre la búsqueda literal de la entidad**, contestada por el **servidor** (la plantilla `meta.search`, el `LiteralSearch` de sincpro_framework). Cambia sólo *cuándo* se pregunta:\n\n- **El selector** (many2one) abre con los **primeros 10 en el orden de la entidad**, y mientras se escribe busca en el servidor — encuentra el registro 123 455 de 200 000 aunque nunca estuvo entre los diez. El nombre del elegido se sigue leyendo cuando la lista vuelve a los primeros diez.\n- **La barra de una tabla** ofrece primero «Buscar «Globex»» — la plantilla entera, todos sus campos a la vez — y la pone con **Enter**. Si el modelo lee lo escrito como pregunta suya («total <= 1000», «pagada», el nombre de un campo), eso va primero.\n- **La caja simple** busca con **Enter**: escribir no pregunta nada.",
      },
    },
  },
};
export default meta;
type Story = StoryObj;

/** What the server was asked, in order: the plays read it to know a search went out. */
function observed() {
  const asked: Criteria[] = [];
  return {
    asked,
    observe: (_route: string, criteria: Criteria) => void asked.push(criteria),
  };
}

const delSelector = observed();
const recordOptions = (options: HTMLElement[]) =>
  options.filter((one) => !(one.textContent ?? "").startsWith("Buscar más…"));

export const ElSelectorBuscaEnElServidor: Story = {
  render: function Render() {
    const [movimiento, setMovimiento] = useState("");
    return (
      <div className="max-w-md p-6">
        <Field label="Movimiento">
          <EntityPicker
            entity={movimientos}
            value={movimiento}
            onChange={setMovimiento}
            browse={false}
          />
        </Field>
        <p className="mt-2 font-mono text-micro text-muted">elegido: {movimiento || "—"}</p>
      </div>
    );
  },
  decorators: [
    (Story) => (
      <Escenario tables={TABLAS} latency={60} observe={delSelector.observe}>
        <Story />
      </Escenario>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const campo = await canvas.findByRole("combobox", { name: /Movimiento/ });
    await userEvent.click(campo);
    // The first ten, in the entity's order (newest first), and «Buscar más…» after them.
    await waitFor(() => expect(recordOptions(page.getAllByRole("option"))).toHaveLength(10));
    await expect(recordOptions(page.getAllByRole("option"))[0]).toHaveTextContent(
      "Ajuste 200000",
    );
    // Typed: the SERVER's literal search — the record is the 76 546th from the top.
    await userEvent.type(campo, "Ajuste 123455");
    await userEvent.click(await page.findByRole("option", { name: /^Ajuste 123455/ }));
    await expect(await canvas.findByText("elegido: M-0123455")).toBeVisible();
    await expect(
      delSelector.asked.some((one) =>
        JSON.stringify(one.where ?? {}).includes("Ajuste 123455"),
      ),
    ).toBe(true);
    // Back to the first ten, and the field still says which one was chosen.
    await expect(campo).toHaveValue("Ajuste 123455");
  },
};

const deLaBarra = observed();

export const LaBarraBuscaLiteral: Story = {
  render: function Render() {
    const listing = useListing(facturas, { pageSize: 20 });
    return <EntityList listing={listing} columns={["number", "customer", "state"]} />;
  },
  decorators: [
    (Story) => (
      <Escenario tables={VENTAS} latency={60} observe={deLaBarra.observe}>
        <Story />
      </Escenario>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("1–20");
    const box = await canvas.findByRole("textbox");
    await userEvent.type(box, "Globex");
    await userEvent.keyboard("{Enter}");
    // One chip: the entity's whole template, every field it searches at once.
    await expect(await canvas.findByText(/Buscar «Globex»/)).toBeVisible();
    await waitFor(() => expect(canvas.queryByText("Clínica San Gabriel")).toBeNull());
    await expect(canvas.getAllByText("Globex Bolivia").length).toBeGreaterThan(0);
    const last = JSON.stringify(deLaBarra.asked.at(-1)?.where ?? {});
    await expect(last).toContain("customer_name");
    await expect(last).toContain("number");
  },
};

const deLaCaja = observed();

export const LaCajaBuscaConEnter: Story = {
  render: function Render() {
    const listing = useListing(facturas, { pageSize: 20 });
    return (
      <EntityList listing={listing} search="box" columns={["number", "customer", "state"]} />
    );
  },
  decorators: [
    (Story) => (
      <Escenario tables={VENTAS} latency={60} observe={deLaCaja.observe}>
        <Story />
      </Escenario>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("1–20");
    const before = deLaCaja.asked.length;
    await userEvent.type(await canvas.findByRole("searchbox", { name: "Buscar" }), "Globex");
    // Typing asks nothing: past the typing pause, the server has not heard of it.
    await new Promise((resolve) => setTimeout(resolve, 500));
    await expect(deLaCaja.asked.length).toBe(before);
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(canvas.queryByText("Clínica San Gabriel")).toBeNull());
    await expect(JSON.stringify(deLaCaja.asked.at(-1)?.where ?? {}).includes("Globex")).toBe(
      true,
    );
  },
};
