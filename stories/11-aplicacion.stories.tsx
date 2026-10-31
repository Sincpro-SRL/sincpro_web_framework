import type { ViewProps } from "@sincpro/web-composer";
import { useCrumbs } from "@sincpro/web-composer";
import {
  EntityList,
  entityView,
  factsOf,
  memoryTransport,
  Refused,
  SincproApp,
  useListing,
  useRecord,
  useRecordInWorkspace,
} from "@sincpro/web-framework";
import { Record, Skeleton } from "@sincpro/web-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { servidorVentas } from "./support/servidor";
import { clienteMeta, clientes, facturaMeta, facturas } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/11 · Una aplicación entera",
  parameters: {
    docs: {
      description: {
        component:
          "`SincproApp` es el contexto de la aplicación en un solo lugar: el transporte, el idioma de las tres tablas de textos (web-ui, composer y framework), las metas ya conocidas, los avisos y el workspace con sus vistas, ⌘K y atajos. La aplicación sólo declara sus entidades (`entityView`) y escribe sus pantallas. Es una comodidad, no la única puerta: todo lo que monta se exporta.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

const servidor = servidorVentas();
const transport = memoryTransport(servidor.tables, {
  latency: 120,
  handle: servidor.handle,
  draft: servidor.draft,
});

function Facturas({ api }: ViewProps) {
  const listing = useListing(facturas, { paging: "more", pageSize: 20 });
  return (
    <EntityList
      listing={listing}
      api={api}
      selectable
      columns={["number", "customer", "state", "amount_total"]}
    />
  );
}

function Factura({ api, resource }: ViewProps) {
  const factura = useRecord(facturas, resource.id ?? "");
  const crumbs = useCrumbs(api);
  useRecordInWorkspace(api, factura);
  if (factura.status === "loading") return <Skeleton rows={4} label="Cargando" />;
  if (factura.status === "failed")
    return <Refused error={factura.error} onRetry={factura.reload} />;
  return (
    <Record
      identity={{ title: factura.record.number, subtitle: factura.record.customer.name }}
    >
      <Record.Rail>
        {crumbs.length === 0 ? null : <Record.Crumbs crumbs={crumbs} />}
      </Record.Rail>
      <Record.Paper layout="horizontal">
        <Record.Facts
          fields={factsOf(
            factura.record,
            factura.meta,
            ["state", "invoice_date", "amount_total"],
            {
              locale: "es",
            },
          )}
        />
      </Record.Paper>
    </Record>
  );
}

function Clientes({ api }: ViewProps) {
  const listing = useListing(clientes);
  return <EntityList listing={listing} api={api} />;
}

function Cliente({ api, resource }: ViewProps) {
  const cliente = useRecord(clientes, resource.id ?? "");
  useRecordInWorkspace(api, cliente);
  if (cliente.status !== "ready") return <Skeleton rows={3} label="Cargando" />;
  return (
    <Record identity={{ title: cliente.record.name, subtitle: cliente.record.tax_id }}>
      <Record.Paper layout="horizontal">
        <Record.Facts
          fields={factsOf(cliente.record, cliente.meta, ["city", "credit_limit"], {
            locale: "es",
          })}
        />
      </Record.Paper>
    </Record>
  );
}

const VIEWS = [
  entityView(facturas, {
    transport,
    name: "Facturas",
    meta: facturaMeta,
    list: Facturas,
    record: Factura,
  }),
  entityView(clientes, {
    transport,
    name: "Clientes",
    meta: clienteMeta,
    list: Clientes,
    record: Cliente,
  }),
];

export const FacturasYClientes: Story = {
  render: () => (
    <SincproApp
      transport={transport}
      views={VIEWS}
      start={facturas.ref()}
      metas={{ [facturas.key]: facturaMeta, [clientes.key]: clienteMeta }}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("20 de 64");
    const [first] = await canvas.findAllByText(/^F-2026-\d{4}$/);
    const number = first?.textContent ?? "";
    await userEvent.click(first!);
    const heading = await canvas.findByRole("heading", { name: number });
    await waitFor(() => expect(heading).toBeVisible());
  },
};
