import { Destination, type ResourceRef, type ViewProps } from "@sincpro/web-composer";
import {
  EntityList,
  entityView,
  factsOf,
  memoryTransport,
  SincproApp,
  useFollowed,
  useListing,
  useRecord,
} from "@sincpro/web-framework";
import { Button, Empty, Record, Skeleton } from "@sincpro/web-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { servidorVentas } from "./support/servidor";
import { facturaMeta, facturas } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/22 · Lista y detalle",
  parameters: {
    docs: {
      description: {
        component:
          "La lista en la página y, al costado, el detalle de la factura en la que está la persona. El panel **no conoce la lista**: `useFollowed(api, entidad)` le da el último registro marcado de su entidad (o el que tiene el foco), y se vuelve a dibujar cuando cambia. Es la misma regla de composer — las vistas se hablan por referencias — escrita una vez.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

const DETALLE: ResourceRef = { domain: "ventas", kind: "detalle" };

function Facturas({ api }: ViewProps) {
  return (
    <EntityList
      listing={useListing(facturas, { pageSize: 10 })}
      api={api}
      selectable
      create={false}
      columns={["number", "customer", "state", "amount_total"]}
      actions={
        <Button
          size="sm"
          role="secondary"
          onClick={() => api.open(DETALLE, { to: Destination.Side })}
        >
          Detalle al costado
        </Button>
      }
    />
  );
}

function Ficha({ id }: { id: string }) {
  const factura = useRecord(facturas, id);
  if (factura.status !== "ready") return <Skeleton rows={3} label="Cargando" />;
  return (
    <Record
      identity={{ title: factura.record.number, subtitle: factura.record.customer.name }}
    >
      <Record.Paper layout="stacked">
        <Record.Facts
          fields={factsOf(factura.record, factura.meta, ["state", "amount_total"], {
            locale: "es",
          })}
        />
      </Record.Paper>
    </Record>
  );
}

/** Follows the invoice the person is on — and knows nothing of the list. */
function Detalle({ api }: ViewProps) {
  const id = useFollowed(api, facturas);
  return id === undefined ? (
    <Empty sentence="Marcá una factura en la lista." />
  ) : (
    <Ficha id={id} />
  );
}

function App() {
  const transport = useMemo(() => {
    const servidor = servidorVentas();
    return memoryTransport(servidor.tables, { latency: 40, handle: servidor.handle });
  }, []);
  const views = useMemo(
    () => [
      entityView(facturas, {
        transport,
        name: "Facturas",
        meta: facturaMeta,
        list: Facturas,
        record: ({ resource }) => <Ficha id={resource.id ?? ""} />,
      }),
      { ...DETALLE, title: () => "Detalle", load: async () => Detalle },
    ],
    [transport],
  );
  return (
    <div className="flex h-dvh min-h-0 flex-col bg-ground">
      <SincproApp
        transport={transport}
        views={views}
        start={facturas.ref()}
        metas={{ [facturas.key]: facturaMeta }}
      />
    </div>
  );
}

export const ElDetalleSigueALaLista: Story = {
  render: () => <App />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("1–10");
    await userEvent.click(canvas.getByRole("button", { name: "Detalle al costado" }));
    await expect(await canvas.findByText("Marcá una factura en la lista.")).toBeVisible();
    const numeros = [...canvasElement.querySelectorAll("tbody tr")].map(
      (tr) => tr.textContent?.match(/F-2026-\d{4}/)?.[0] ?? "",
    );
    const boxes = await canvas.findAllByRole("checkbox");
    // Ticking a row: the panel shows that invoice.
    await userEvent.click(boxes[1]!);
    await expect(await canvas.findByRole("heading", { name: numeros[0]! })).toBeVisible();
    // Ticking another: it follows the last one.
    await userEvent.click(boxes[3]!);
    await expect(await canvas.findByRole("heading", { name: numeros[2]! })).toBeVisible();
    await waitFor(() =>
      expect(canvas.queryByRole("heading", { name: numeros[0]! })).toBeNull(),
    );
  },
};
