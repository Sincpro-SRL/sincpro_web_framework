import { useCrumbs, type ViewProps } from "@sincpro/web-composer";
import {
  entityView,
  memoryTransport,
  RelatedRecord,
  SincproApp,
  useRecord,
  useRecordInWorkspace,
} from "@sincpro/web-framework";
import { Field, Record, Skeleton } from "@sincpro/web-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { servidorVentas } from "./support/servidor";
import { clienteMeta, clientes, facturaMeta, facturas } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/25 · Abrir un registro relacionado",
  parameters: {
    docs: {
      description: {
        component:
          "El cliente de una factura es **otro registro**, no un texto. `RelatedRecord` lo dibuja con su resumen (el nombre como enlace, su código, la tarjeta que flota del nombre) y lo abre con `openIn`: en un **modal** del tamaño de un registro por defecto —la persona estaba haciendo algo acá y vuelve exactamente a donde estaba— y «Abrir en…» ofrece vista previa, al costado y página, con la miga de vuelta.\n\nDesde **adentro** de un modal, lo relacionado se abre al costado o en vista previa: nunca un modal sobre otro. Lo decide `targetsFor(api)` con lo que composer dice de la vista (`api.over`), así que ninguna pantalla lo escribe. En el teléfono, composer traduce el modal a una hoja.",
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const GLOBEX_INVOICE = "F-2026-0004";

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
            <RelatedRecord api={api} entity={clientes} value={factura.record.customer} />
          </Field>
        </div>
      </Record.Paper>
    </Record>
  );
}

function Cliente({ api, resource }: ViewProps) {
  const cliente = useRecord(clientes, resource.id ?? "");
  const crumbs = useCrumbs(api);
  useRecordInWorkspace(api, cliente);
  if (cliente.status !== "ready") return <Skeleton rows={2} label="Cargando" />;
  return (
    <Record identity={{ title: cliente.record.name, subtitle: cliente.record.city }}>
      <Record.Rail>
        {crumbs.length === 0 ? null : <Record.Crumbs crumbs={crumbs} />}
      </Record.Rail>
    </Record>
  );
}

const Nada = () => null;

function App() {
  const transport = useMemo(() => {
    const servidor = servidorVentas();
    return memoryTransport(servidor.tables, { latency: 40, handle: servidor.handle });
  }, []);
  const views = useMemo(
    () => [
      entityView(facturas, { transport, name: "Facturas", list: Nada, record: Factura }),
      entityView(clientes, { transport, name: "Clientes", list: Nada, record: Cliente }),
    ],
    [transport],
  );
  return (
    <div className="flex h-dvh min-h-0 flex-col bg-ground">
      <SincproApp
        transport={transport}
        views={views}
        start={facturas.ref(GLOBEX_INVOICE)}
        metas={{ [facturas.key]: facturaMeta, [clientes.key]: clienteMeta }}
      />
    </div>
  );
}

export const UnModalPorDefecto: Story = {
  render: () => <App />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("heading", { name: GLOBEX_INVOICE });
    // The name of the related record is a link; what tells it apart sits beside it.
    await expect(canvas.getByText("C-004")).toBeVisible();
    await userEvent.click(canvas.getByRole("link", { name: "Globex Bolivia" }));
    // Over the invoice, which waits behind it: a modal named by the record it holds.
    const modal = await canvas.findByRole("dialog", { name: "Globex Bolivia" });
    // The customer's own view inside it: its city is what the invoice did not show.
    await expect(await within(modal).findByText("Sucre")).toBeVisible();
    await expect(canvas.getByRole("heading", { name: GLOBEX_INVOICE })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(canvas.queryByRole("dialog")).toBeNull());
  },
};

export const AbrirEnComoPaginaYVolver: Story = {
  render: () => <App />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await canvas.findByRole("heading", { name: GLOBEX_INVOICE });
    await userEvent.click(canvas.getByRole("button", { name: "Abrir en…" }));
    // The rest of the places, the modal being the link itself. The menu fades in.
    await waitFor(() =>
      expect(page.getByRole("menuitem", { name: "Abrir como página" })).toBeVisible(),
    );
    await expect(page.getByRole("menuitem", { name: "Vista previa" })).toBeInTheDocument();
    await expect(
      page.getByRole("menuitem", { name: "Abrir al costado" }),
    ).toBeInTheDocument();
    await expect(page.queryByRole("menuitem", { name: "Abrir en un modal" })).toBeNull();
    await userEvent.click(page.getByRole("menuitem", { name: "Abrir como página" }));
    // The page is the customer now, and the crumb brings the invoice back.
    await canvas.findByRole("heading", { name: "Globex Bolivia" });
    await waitFor(() =>
      expect(canvas.queryByRole("heading", { name: GLOBEX_INVOICE })).toBeNull(),
    );
    await expect(canvas.queryByRole("dialog")).toBeNull();
    // A crumb is a link (React Aria's breadcrumb), named by the invoice's real number.
    await userEvent.click(await canvas.findByRole("link", { name: GLOBEX_INVOICE }));
    await expect(await canvas.findByRole("heading", { name: GLOBEX_INVOICE })).toBeVisible();
  },
};
