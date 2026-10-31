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
          "La definición del modelo no es chica — la de `Project` en forge pesa ~97 KB aunque no haya filas — y es la misma en cada pedido. El framework la pide **una vez por entidad**: la segunda lista, el registro que se abre desde ella o el select que apunta a ella piden con `meta: false`. Y si la aplicación la trae de antes (`FrameworkProvider metas`: un snapshot de la del servidor, o `defineMeta`), **ni el primer pedido la pide**.\n\nPor qué no sale de OpenAPI: en sincpro_framework las lecturas responden con esquema `{}` — no existe un esquema `Project` —, así que la meta de una lista sólo existe en la respuesta. OpenAPI sí describe bien los comandos y los value objects (`metaFromSchema`).",
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
        .map((one, i) => `pedido ${i + 1}: meta ${one.meta === false ? "no" : "sí"}`)
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
    await expect(await canvas.findByText(/pedido 1: meta sí/)).toBeVisible();
  },
};

export const ConLaMetaPrecargada: Story = {
  render: () => <Escena preload />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("20 de 64");
    await expect(await canvas.findByText(/pedido 1: meta no/)).toBeVisible();
    await expect(await canvas.findByRole("columnheader", { name: /Cliente/ })).toBeVisible();
  },
};
