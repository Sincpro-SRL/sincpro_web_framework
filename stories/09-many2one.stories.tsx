import type { Criteria } from "@sincpro/criteria";
import { defineList, EntityPicker, lookupOf, useLookup } from "@sincpro/web-framework";
import { Field, List, SearchField } from "@sincpro/web-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Escenario } from "./support/escenario";
import {
  clienteMeta,
  CLIENTES,
  clientes,
  type Factura,
  FACTURAS,
  facturas,
  VENTAS,
} from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/09 · Elegir un registro: el many2one",
  parameters: {
    docs: {
      description: {
        component:
          "`EntityPicker` es el many2one: el `Picker` de web-ui alimentado por `useLookup` — cada registro como una opción con su `display` y su clave al lado, de a una página. «Abrir» y «buscar en todo» son del composer (`api.open`, `api.pick`) y los pasa la pantalla.\n\n**Hueco conocido**: el `Picker` de web-ui filtra lo que ya tiene y no sabe pedir más por texto, así que lo tipeado acota la página cargada; con miles de registros, «buscar en todo» abre la lista entera. Un `Picker` que busque en el servidor es de web-ui.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

const GLOBEX = lookupOf(clienteMeta, CLIENTES).find((one) => one.label === "Globex Bolivia")!;

export const ElClienteDeUnaFactura: Story = {
  render: function Render() {
    const [cliente, setCliente] = useState(GLOBEX.id);
    return (
      <div className="max-w-md p-6">
        <Field label="Cliente">
          <EntityPicker entity={clientes} value={cliente} onChange={setCliente} />
        </Field>
      </div>
    );
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
    // The chosen record reads in the field itself — an input's value, not a text node.
    await expect(await canvas.findByDisplayValue("Globex Bolivia")).toBeVisible();
  },
};

/** Every list request that reached the server, as it arrived. */
const pedidos: { route: string; criteria: Criteria }[] = [];
const observar = (route: string, criteria: Criteria) => pedidos.push({ route, criteria });

const IMPORTADORA = CLIENTES[0]!;

export const AcotadoPorOtroCampo: Story = {
  render: function Render() {
    const [cliente, setCliente] = useState(GLOBEX.id);
    const [factura, setFactura] = useState("");
    // Which invoices may be chosen: those of the chosen customer. The server applies it.
    const scope = useMemo<Criteria<Factura>>(
      () => ({ where: { field: "customer_id", operator: "=", value: cliente } }),
      [cliente],
    );
    return (
      <div className="flex max-w-md flex-col gap-3 p-6">
        <Field label="Cliente">
          <EntityPicker
            entity={clientes}
            value={cliente}
            onChange={(id) => {
              setCliente(id);
              setFactura("");
            }}
          />
        </Field>
        <Field label="Factura del cliente">
          <EntityPicker
            entity={facturas}
            criteria={scope}
            value={factura}
            onChange={setFactura}
            aria-label="Factura del cliente"
          />
        </Field>
      </div>
    );
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
    const asked = (id: string) =>
      pedidos.some(
        (one) =>
          one.route === "/facturas" && JSON.stringify(one.criteria).includes(`"${id}"`),
      );
    await waitFor(() => expect(asked(GLOBEX.id)).toBe(true));
    // Only Globex's invoices are offered.
    const own = FACTURAS.filter((f) => f.customer_id === GLOBEX.id).map((f) => f.number);
    await userEvent.click(
      await canvas.findByRole("combobox", { name: /Factura del cliente/ }),
    );
    await page.findByRole("option", { name: new RegExp(own[0]!) });
    const offered = page.getAllByRole("option").map((o) => o.textContent ?? "");
    await expect(offered.every((text) => own.some((n) => text.includes(n)))).toBe(true);
    await userEvent.keyboard("{Escape}");
    // Another customer: the choices start over, under the new scope.
    await userEvent.click(canvas.getAllByRole("combobox")[0]!);
    await userEvent.click(
      await page.findByRole("option", { name: new RegExp(IMPORTADORA.name) }),
    );
    await waitFor(() => expect(asked(IMPORTADORA.id)).toBe(true));
  },
};

/** The customers that may still buy: a named list, chosen from as such. */
const clientesActivos = defineList(clientes, {
  id: "activos",
  title: "Clientes activos",
  scope: { where: { field: "active", operator: "=", value: true } },
  columns: ["name", "tax_id", "city"],
});
const INACTIVO = CLIENTES.find((c) => !c.active)!;

export const BuscarEnTodosConUnaTabla: Story = {
  render: function Render() {
    const [cliente, setCliente] = useState("");
    return (
      <div className="max-w-md p-6">
        <Field label="Cliente">
          <EntityPicker
            entity={clientes}
            columns={["name", "tax_id", "city"]}
            value={cliente}
            onChange={setCliente}
          />
        </Field>
      </div>
    );
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
    const page = within(canvasElement.ownerDocument.body);
    // Always a click away, even with eight customers: the chooser over the whole set.
    await userEvent.click(await canvas.findByRole("button", { name: "Buscar en todos" }));
    const chooser = await page.findByRole("dialog", { name: "Clientes" });
    // A table, with the columns asked for.
    await expect(
      await within(chooser).findByRole("columnheader", { name: /NIT/ }),
    ).toBeVisible();
    await expect(within(chooser).getByRole("columnheader", { name: /Ciudad/ })).toBeVisible();
    // The literal search, answered by the server.
    await userEvent.type(within(chooser).getByLabelText("Buscar"), "Globex");
    await waitFor(() =>
      expect(within(chooser).queryByText("Clínica San Gabriel")).toBeNull(),
    );
    // What was searched for is highlighted inside the name: found by the rest of it.
    await userEvent.click(await within(chooser).findByText(/Bolivia/));
    await expect(await canvas.findByDisplayValue("Globex Bolivia")).toBeVisible();
  },
};

export const DesdeUnaListaConDominio: Story = {
  render: function Render() {
    const [cliente, setCliente] = useState("");
    return (
      <div className="max-w-md p-6">
        <Field label="Cliente">
          <EntityPicker
            entity={clientesActivos}
            value={cliente}
            onChange={setCliente}
            aria-label="Cliente activo"
          />
        </Field>
      </div>
    );
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
    const page = within(canvasElement.ownerDocument.body);
    // Only the active ones are offered: the list's cut, applied by the server.
    await userEvent.click(await canvas.findByRole("combobox", { name: /Cliente activo/ }));
    await page.findByRole("option", { name: /Globex Bolivia/ });
    await expect(page.queryByRole("option", { name: new RegExp(INACTIVO.name) })).toBeNull();
    await userEvent.keyboard("{Escape}");
    // Its chooser carries the list's name and columns.
    await userEvent.click(canvas.getByRole("button", { name: "Buscar en todos" }));
    const chooser = await page.findByRole("dialog", { name: "Clientes activos" });
    await expect(
      await within(chooser).findByRole("columnheader", { name: /NIT/ }),
    ).toBeVisible();
    await expect(within(chooser).queryByText(INACTIVO.name)).toBeNull();
  },
};

/** A chooser of its own (level 2): `useLookup` asks the server as one types. */
function SelectorPropio({ onChoose }: { onChoose: (id: string) => void }) {
  const lookup = useLookup(clientes, { pageSize: 5 });
  return (
    <List<{ id: string; label: string; detail?: string }>
      items={lookup.options}
      keyOf={(one) => one.id}
      present="rows"
      onOpen={(one) => onChoose(one.id)}
      state={{ loading: lookup.loading }}
    >
      <List.Bar>
        <List.Search>
          <SearchField
            value={lookup.text}
            onChange={lookup.search}
            placeholder="Nombre o NIT"
            aria-label="Buscar un cliente"
          />
        </List.Search>
      </List.Bar>
      <List.Rows<{ id: string; label: string; detail?: string }>
        row={(one) => ({ name: one.label, ...(one.detail ? { meta: one.detail } : {}) })}
      />
    </List>
  );
}

const pedidosPropio: Criteria[] = [];
/** Stable: an observer made on each render would build a new transport each render. */
const observarPropio = (_route: string, criteria: Criteria) => pedidosPropio.push(criteria);

export const UnSelectorPropio: Story = {
  render: function Render() {
    const [cliente, setCliente] = useState("");
    return (
      <div className="max-w-md p-6">
        <SelectorPropio onChoose={setCliente} />
        <p aria-live="polite">{cliente === "" ? "Nada elegido" : `Elegido: ${cliente}`}</p>
      </div>
    );
  },
  decorators: [
    (Story) => (
      <Escenario tables={VENTAS} observe={observarPropio}>
        <Story />
      </Escenario>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(await canvas.findByLabelText("Buscar un cliente"), "Globex");
    // The typed text filled the entity's literal search template, on the SERVER.
    await waitFor(() =>
      expect(
        pedidosPropio.some((one) => JSON.stringify(one.where ?? {}).includes("Globex")),
      ).toBe(true),
    );
    await waitFor(() => expect(canvas.queryByText("Clínica San Gabriel")).toBeNull());
    await userEvent.click(await canvas.findByText(/Bolivia/));
    await expect(await canvas.findByText(`Elegido: ${GLOBEX.id}`)).toBeVisible();
  },
};
