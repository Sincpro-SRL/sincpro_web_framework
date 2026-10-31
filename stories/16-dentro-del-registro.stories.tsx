import { EntityPicker, Refused, RelatedList, useRecord } from "@sincpro/web-framework";
import { Field, Record, Skeleton } from "@sincpro/web-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Escenario, EscenarioRest } from "./support/escenario";
import { movimientos, TABLAS } from "./support/movimientos";
import { clientes, FACTURAS, facturas } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/16 · Buscar dentro de un registro y elegir entre muchos",
  parameters: {
    docs: {
      description: {
        component:
          "**Dentro de un registro**: las facturas de un cliente son una lista viva de la entidad relacionada (`RelatedList`), buscada, ordenada y paginada por el servidor — la meta dice cómo preguntar (la clave del otro lado, `identified_by`), y esa condición se suma a todo: ninguna búsqueda puede salirse del cliente. **Entre muchos**: un many2one sobre doscientos mil movimientos. El picker tiene la primera página; «buscar en todos» abre la lista entera, buscada en el servidor, y una fila contesta el campo.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

const GLOBEX = "C-004";
const DE_GLOBEX = FACTURAS.filter((f) => f.customer_id === GLOBEX);

function Cliente() {
  const cliente = useRecord(clientes, GLOBEX);
  if (cliente.status === "loading") return <Skeleton rows={4} label="Cargando" />;
  if (cliente.status === "failed")
    return <Refused error={cliente.error} onRetry={cliente.reload} />;
  return (
    <Record identity={{ title: cliente.record.name, subtitle: cliente.record.tax_id }}>
      <Record.Paper layout="horizontal">
        <div className="p-4">
          <RelatedList
            record={cliente}
            name="invoices"
            entity={facturas}
            pageSize={5}
            columns={["number", "state", "amount_total"]}
          />
        </div>
      </Record.Paper>
    </Record>
  );
}

export const LasFacturasDeUnCliente: Story = {
  render: () => <EscenarioRest>{() => <Cliente />}</EscenarioRest>,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("1–5")).toBeVisible();
    await expect(canvas.getByText(String(DE_GLOBEX.length))).toBeInTheDocument();
    const box = canvas.getByRole("searchbox", { name: "Buscar" });

    // One of its own invoices is found…
    const suya = DE_GLOBEX.at(-1)!.number;
    await userEvent.type(box, suya.slice(-4));
    await expect(await canvas.findByText(suya)).toBeVisible();

    // …and another customer's never is: the relation's scope is AND-ed with every search.
    await userEvent.clear(box);
    await userEvent.type(box, "0007");
    await expect(await canvas.findByText("Nada coincide.")).toBeVisible();
  },
};

export const ElegirEntreDoscientosMil: Story = {
  render: function Render() {
    const [movimiento, setMovimiento] = useState("");
    return (
      <div className="max-w-md p-6">
        <Field label="Movimiento">
          <EntityPicker entity={movimientos} value={movimiento} onChange={setMovimiento} />
        </Field>
        <p className="mt-2 font-mono text-micro text-muted">elegido: {movimiento || "—"}</p>
      </div>
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
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(await canvas.findByRole("combobox", { name: /Movimiento/ }));
    // web-ui's «Buscar más…» option carries how many more there are in its name.
    await userEvent.click(await page.findByRole("option", { name: /^Buscar más…/ }));
    const chooser = await page.findByRole("dialog", { name: "Movimientos" });
    // The box appears with the entity's definition, on the first answer.
    await userEvent.type(await within(chooser).findByLabelText("Buscar"), "Ajuste 123455");
    await userEvent.click(await within(chooser).findByText("M-0123455"));
    await waitFor(() => expect(canvas.getByText("elegido: M-0123455")).toBeVisible());
  },
};
