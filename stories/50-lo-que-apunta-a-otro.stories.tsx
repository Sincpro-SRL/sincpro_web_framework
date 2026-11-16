import { memoryTransport } from "@sincpro/client-framework";
import { useCrumbs, type ViewProps } from "@sincpro/web-composer";
import {
  entityView,
  factsOf,
  RelatedRecord,
  scopedRef,
  SincproApp,
  useCount,
  useRecord,
  useRecordInWorkspace,
} from "@sincpro/web-framework";
import { Field, Record, Skeleton, SmartButton } from "@sincpro/web-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { FileText } from "lucide-react";
import { useMemo } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { servidorVentas } from "./support/servidor";
import { clienteMeta, clientes, facturaMeta, facturas } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/50 · Lo que apunta a otro",
  parameters: {
    docs: {
      description: {
        component:
          "Un registro que apunta a otro **por su clave sola** —el pago de una cuota, `payment_id`— se lee por su **nombre**: `RelatedRecord` lo pide una vez por clave y deja la clave al lado, como enlace que abre donde el workspace lo pone. En los hechos de un registro (`factsOf`) un many2one de una entidad declarada es ese mismo **enlace**, no un texto.\n\nY lo que **otros registros tienen de este** —«las facturas de este cliente (8)»— es un botón con su número: `useCount(entidad, criteria)` lo cuenta el **servidor** (una lista de una fila; «—» mientras no contesta, nunca 0), y `scopedRef(entidad, selección)` abre la lista de la entidad **bajo ese corte**, que viaja en la referencia: sobrevive a recargar y a un enlace, y nada de lo que se busque lo saca.",
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const GLOBEX = "C-004";
const GLOBEX_INVOICE = "F-2026-0004";

/** An invoice that shows its customer by the KEY it holds, as a record that holds only the key. */
function Factura({ api, resource }: ViewProps) {
  const factura = useRecord(facturas, resource.id ?? "");
  const crumbs = useCrumbs(api);
  useRecordInWorkspace(api, factura);
  if (factura.status !== "ready") return <Skeleton rows={3} label="Cargando" />;
  return (
    <Record identity={{ title: factura.record.number }}>
      <Record.Rail>
        {crumbs.length === 0 ? null : <Record.Crumbs crumbs={crumbs} />}
      </Record.Rail>
      <Record.Paper layout="stacked">
        <div className="grid max-w-xl gap-3 p-4">
          <Field label="Cliente">
            <RelatedRecord api={api} entity={clientes} value={factura.record.customer_id} />
          </Field>
        </div>
      </Record.Paper>
    </Record>
  );
}

/** A customer with a button that counts its invoices and opens them. */
function Cliente({ api, resource }: ViewProps) {
  const id = resource.id ?? "";
  const cliente = useRecord(clientes, id);
  const crumbs = useCrumbs(api);
  useRecordInWorkspace(api, cliente);
  const suyas = useMemo(
    () => ({ field: "customer_id", operator: "=", value: id }) as const,
    [id],
  );
  const cuantas = useCount(facturas, { selection: suyas });
  if (cliente.status !== "ready") return <Skeleton rows={2} label="Cargando" />;
  return (
    <Record identity={{ title: cliente.record.name, subtitle: cliente.record.city }}>
      <Record.Rail>
        {crumbs.length === 0 ? null : <Record.Crumbs crumbs={crumbs} />}
      </Record.Rail>
      <Record.Paper layout="stacked">
        <div className="p-4">
          <SmartButton
            icon={FileText}
            label="Facturas"
            {...(cuantas === null ? {} : { count: cuantas.value })}
            onClick={() => api.open(scopedRef(facturas, suyas))}
          />
        </div>
      </Record.Paper>
    </Record>
  );
}

/** An invoice whose facts name its customer: `factsOf` draws the many2one as a link. */
function FacturaConHechos({ api, resource }: ViewProps) {
  const factura = useRecord(facturas, resource.id ?? "");
  useRecordInWorkspace(api, factura);
  if (factura.status !== "ready") return <Skeleton rows={3} label="Cargando" />;
  return (
    <Record identity={{ title: factura.record.number }}>
      <Record.Paper layout="horizontal">
        <Record.Facts
          fields={factsOf(factura.record, factura.meta, ["customer", "state"], {
            locale: "es",
          })}
        />
      </Record.Paper>
    </Record>
  );
}

function App({
  start,
  factura = Factura,
}: {
  start: "factura" | "cliente";
  factura?: (props: ViewProps) => React.JSX.Element;
}) {
  const transport = useMemo(() => {
    const servidor = servidorVentas();
    return memoryTransport(servidor.tables, { latency: 40, handle: servidor.handle });
  }, []);
  const views = useMemo(
    () => [
      // The invoices' own list is the framework's: it reads under the cut the reference carries.
      entityView(facturas, { transport, name: "Facturas", record: factura }),
      entityView(clientes, { transport, name: "Clientes", record: Cliente }),
    ],
    [transport, factura],
  );
  return (
    <div className="flex h-dvh min-h-0 flex-col bg-ground">
      <SincproApp
        transport={transport}
        views={views}
        start={start === "factura" ? facturas.ref(GLOBEX_INVOICE) : clientes.ref(GLOBEX)}
        metas={{ [facturas.key]: facturaMeta, [clientes.key]: clienteMeta }}
        entities={[facturas, clientes]}
      />
    </div>
  );
}

export const UnaClaveSolaSeLeePorSuNombre: Story = {
  render: () => <App start="factura" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("heading", { name: GLOBEX_INVOICE });
    // The record holds only `customer_id`: its name is asked by key, the key stays beside it.
    await expect(await canvas.findByRole("link", { name: "Globex Bolivia" })).toBeVisible();
    await expect(canvas.getByText(GLOBEX)).toBeVisible();
  },
};

export const LoQueOtrosTienenDeEsteSeCuentaYSeAbre: Story = {
  render: () => <App start="cliente" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("heading", { name: "Globex Bolivia" });
    // Counted by the server: eight of the sixty-four invoices are this customer's.
    const boton = await canvas.findByRole("button", { name: /Facturas/ });
    await waitFor(() => expect(boton).toHaveTextContent("8"));
    await userEvent.click(boton);
    // The invoices' list, under the cut: eight rows (under 200 every row is drawn), every one
    // of this customer.
    const filas = () => within(canvas.getByRole("table")).getAllByRole("row").slice(1);
    await waitFor(() => expect(filas()).toHaveLength(8));
    for (const fila of filas()) await expect(fila).toHaveTextContent("Globex Bolivia");
  },
};

export const UnHechoQueApuntaAOtroEsUnEnlace: Story = {
  render: () => <App start="factura" factura={FacturaConHechos} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("heading", { name: GLOBEX_INVOICE });
    // The customer is a fact of the invoice — and a door: it opens over the invoice.
    await userEvent.click(await canvas.findByRole("link", { name: "Globex Bolivia" }));
    const modal = await canvas.findByRole("dialog", { name: "Globex Bolivia" });
    await expect(await within(modal).findByText("Sucre")).toBeVisible();
  },
};
