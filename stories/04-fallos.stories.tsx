import type { Criteria, Problem } from "@sincpro/criteria";
import { EntityList, Refused, useListing, useRecord } from "@sincpro/web-framework";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { Escenario } from "./support/escenario";
import { type Factura, facturas, VENTAS } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/04 · Cuando el servidor dice que no",
  parameters: {
    docs: {
      description: {
        component:
          "Un rechazo llega de cualquier transporte con la misma forma (`Problem`: `kind`, `next_step`, `guidance`) y se dice con las palabras del servidor — lo que pasó y **qué hacer**. Reintentar aparece sólo cuando reintentar puede servir. Y una condición que el modelo no sabe contestar no rompe nada: se ignora, la lista sale MÁS ancha de lo pedido, y la pantalla lo avisa.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

const SIN_ACCESO: Problem = {
  kind: "permission_denied",
  reason: "MISSING_PERMISSION",
  title: "No tenés acceso a ventas",
  detail: "Tu usuario no tiene el permiso VENTAS_LEER.",
  guidance: "Pedíselo al administrador de tu empresa.",
  next_step: "ask_for_access",
  retryable: false,
  status: 403,
  errors: [],
  extensions: {},
};

export const SinAccesoALaLista: Story = {
  render: function Render() {
    const listing = useListing(facturas);
    return <EntityList listing={listing} title="Facturas" />;
  },
  decorators: [
    (Story) => (
      <Escenario tables={VENTAS} refuse={() => SIN_ACCESO}>
        <Story />
      </Escenario>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(/Pedíselo al administrador/)).toBeVisible();
  },
};

export const UnRegistroQueNoExiste: Story = {
  render: function Render() {
    const factura = useRecord(facturas, "F-1999-0001");
    if (factura.status !== "failed") return <p className="p-4 text-meta">…</p>;
    return (
      <div className="p-4">
        <Refused error={factura.error} onRetry={factura.reload} />
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
    await expect(await canvas.findByText("No existe")).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Reintentar" })).toBeNull();
  },
};

export const UnaCondicionIgnorada: Story = {
  render: function Render() {
    // A reading saved against an older schema: the field it names is gone. Typed criteria
    // would refuse it at compile time, which is exactly why one from a URL is not typed.
    const saved = { where: { field: "vendedor", operator: "=", value: "ana" } };
    const listing = useListing(facturas, { criteria: saved as unknown as Criteria<Factura> });
    return <EntityList listing={listing} columns={["number", "customer", "amount_total"]} />;
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
    await expect(
      await canvas.findByText(/El servidor ignoró una condición sobre vendedor/),
    ).toBeVisible();
  },
};
