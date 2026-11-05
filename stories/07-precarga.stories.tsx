import type { Criteria } from "@sincpro/criteria";
import { EntityList, useListing } from "@sincpro/web-framework";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useCallback, useState } from "react";
import { expect, within } from "storybook/test";

import { Escenario } from "./support/escenario";
import { facturaMeta, facturas, VENTAS } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/07 · La meta precargada",
  parameters: {
    docs: {
      description: {
        component:
          "La definición del modelo se publica **una vez**: el contexto la describe en su documento de descubrimiento (OpenAPI, con `x-sincpro`) y el transporte la lee de ahí (`metaFromContract`), no de cada respuesta — una respuesta trae sólo su `model_version`, y otra versión significa volver a leer el documento. Si la aplicación la trae de antes (`FrameworkProvider metas`: un snapshot del documento, o `defineMeta`), las columnas se dibujan antes de que llegue la primera página.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

function Pedidos({ asked }: { asked: readonly Criteria[] }) {
  return (
    <p className="px-4 py-2 font-mono text-micro text-muted">
      {asked
        .map((one, i) => `pedido ${i + 1}: ${one.pagination?.limit ?? "—"} filas`)
        .join(" · ")}
    </p>
  );
}

function Lista() {
  const listing = useListing(facturas, { paging: "more", pageSize: 20 });
  return (
    <EntityList listing={listing} columns={["number", "customer", "state", "amount_total"]} />
  );
}

function Escena({ preload }: { preload: boolean }) {
  const [asked, setAsked] = useState<Criteria[]>([]);
  const observe = useCallback((_: string, criteria: Criteria) => {
    // A state update from the transport's call, not from a render.
    queueMicrotask(() => setAsked((now) => [...now, criteria]));
  }, []);
  return (
    <Escenario
      tables={VENTAS}
      observe={observe}
      {...(preload ? { metas: { [facturas.key]: facturaMeta } } : {})}
    >
      <Pedidos asked={asked} />
      <Lista />
    </Escenario>
  );
}

export const SinPrecarga: Story = {
  render: () => <Escena preload={false} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("20 de 64");
    await expect(await canvas.findByText(/pedido 1: 20 filas/)).toBeVisible();
  },
};

export const ConLaMetaPrecargada: Story = {
  render: () => <Escena preload />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("20 de 64");
    await expect(await canvas.findByText(/pedido 1: 20 filas/)).toBeVisible();
    await expect(await canvas.findByRole("columnheader", { name: /Cliente/ })).toBeVisible();
  },
};
