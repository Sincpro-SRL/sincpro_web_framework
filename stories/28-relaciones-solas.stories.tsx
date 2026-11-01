import { useCrumbs, type ViewProps } from "@sincpro/web-composer";
import {
  dirtyOf,
  EntityList,
  entityView,
  memoryTransport,
  RecordField,
  SincproApp,
  useListing,
  useRecord,
  useRecordInWorkspace,
} from "@sincpro/web-framework";
import { Button, Record, Skeleton } from "@sincpro/web-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { servidorVentas } from "./support/servidor";
import { clienteMeta, clientes, facturaMeta, facturas } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/28 · Las relaciones se arman solas",
  parameters: {
    docs: {
      description: {
        component:
          'Un many2one no se escribe a mano: `<RecordField name="customer_id" />` y nada más. La metadata dice a qué apunta (`relation: "Cliente"`, escrito por `customer_id`), la aplicación declaró esa entidad una vez (`SincproApp entities`), y el campo es un `EntityPicker` de clientes — búsqueda literal en el servidor, los diez primeros, «Buscar más…» como la lista que contesta — que abre el cliente en un **modal** con «Abrir en…» para el resto. Dónde abre lo dice la vista que contiene el formulario (`entityView`): el mismo formulario fuera de un espacio de trabajo no abre nada.',
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
  const dirty = dirtyOf(factura);
  if (factura.status !== "ready") return <Skeleton rows={3} label="Cargando" />;
  return (
    <Record
      identity={{ title: factura.record.number }}
      {...(dirty === undefined ? {} : { dirty })}
    >
      <Record.Rail>
        {crumbs.length === 0 ? null : <Record.Crumbs crumbs={crumbs} />}
        <Record.Actions>
          <Button size="sm" role="ghost" onClick={factura.reload}>
            Volver a leer
          </Button>
        </Record.Actions>
      </Record.Rail>
      <Record.Paper layout="stacked">
        <div className="grid max-w-xl gap-3 p-4">
          <RecordField record={factura} name="customer_id" />
          <RecordField record={factura} name="notes" />
        </div>
      </Record.Paper>
    </Record>
  );
}

function Cliente({ api, resource }: ViewProps) {
  const cliente = useRecord(clientes, resource.id ?? "");
  useRecordInWorkspace(api, cliente);
  if (cliente.status !== "ready") return <Skeleton rows={2} label="Cargando" />;
  return (
    <Record identity={{ title: cliente.record.name, subtitle: cliente.record.city }}>
      <Record.Paper layout="stacked">
        <div className="p-4">
          <RecordField record={cliente} name="invoices" />
        </div>
      </Record.Paper>
    </Record>
  );
}

const Nada = () => null;

function Clientes({ api }: ViewProps) {
  return <EntityList listing={useListing(clientes)} api={api} />;
}

function App({
  start = facturas.ref(GLOBEX_INVOICE),
}: {
  start?: ReturnType<typeof facturas.ref>;
}) {
  const transport = useMemo(() => {
    const servidor = servidorVentas();
    return memoryTransport(servidor.tables, { latency: 40, handle: servidor.handle });
  }, []);
  const views = useMemo(
    () => [
      entityView(facturas, { transport, name: "Facturas", list: Nada, record: Factura }),
      entityView(clientes, { transport, name: "Clientes", list: Clientes, record: Cliente }),
    ],
    [transport],
  );
  return (
    <div className="flex h-dvh min-h-0 flex-col bg-ground">
      <SincproApp
        transport={transport}
        views={views}
        entities={[facturas, clientes]}
        start={start}
        metas={{ [facturas.key]: facturaMeta, [clientes.key]: clienteMeta }}
      />
    </div>
  );
}

export const UnMany2oneSinEscribirlo: Story = {
  render: () => <App />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await canvas.findByRole("heading", { name: GLOBEX_INVOICE });
    // The key field is the customer, by name — not a text box with «C-004».
    const campo = await canvas.findByRole("combobox", { name: /Cliente \(código\)/ });
    await waitFor(() => expect(campo).toHaveValue("Globex Bolivia"));
    // Chosen by the server's literal search.
    await userEvent.clear(campo);
    await userEvent.type(campo, "Clínica");
    await userEvent.click(await page.findByRole("option", { name: /Clínica San Gabriel/ }));
    await expect(campo).toHaveValue("Clínica San Gabriel");
    // Opened where the view says: a modal over the invoice, which waits behind it.
    await userEvent.click(canvas.getByRole("button", { name: "Abrir en un modal" }));
    const modal = await canvas.findByRole("dialog", { name: "Clínica San Gabriel" });
    await expect(await within(modal).findByText("La Paz")).toBeVisible();
    await expect(canvas.getByRole("heading", { name: GLOBEX_INVOICE })).toBeInTheDocument();
  },
};

export const BuscarMasConLoEscrito: Story = {
  render: () => <App start={facturas.ref("F-2026-0001")} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const campo = await canvas.findByRole("combobox", { name: /Cliente \(código\)/ });
    await waitFor(() => expect(campo).toHaveValue("Importadora del Oriente"));
    await userEvent.clear(campo);
    await userEvent.type(campo, "Glo");
    await userEvent.click(await page.findByRole("option", { name: /^Buscar más…/ }));
    // The customers' own list, in a modal that answers, opened on what was typed.
    const modal = await canvas.findByRole("dialog", { name: /Clientes/ });
    await expect(await within(modal).findByText("Buscar «Glo»")).toBeVisible();
    await waitFor(() => expect(within(modal).queryByText("Clínica San Gabriel")).toBeNull());
    await userEvent.click(await within(modal).findByText("Globex Bolivia"));
    await waitFor(() => expect(campo).toHaveValue("Globex Bolivia"));
    await waitFor(() => expect(canvas.queryByRole("dialog")).toBeNull());
  },
};

export const UnOne2manyQueAbreSusFilas: Story = {
  render: () => <App start={clientes.ref("C-004")} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("heading", { name: "Globex Bolivia" });
    // The customer's invoices, read as their own list (searched and paged by the server).
    const [first] = await canvas.findAllByText(/^F-2026-\d{4}$/);
    const number = first!.textContent ?? "";
    await userEvent.click(first!);
    // A row opens its invoice in a modal over the customer.
    const modal = await canvas.findByRole("dialog", { name: number });
    // From inside the modal, the invoice's customer opens BESIDE — never a modal over a modal.
    await expect(
      await within(modal).findByRole("button", { name: "Abrir al costado" }),
    ).toBeVisible();
    await expect(
      within(modal).queryByRole("button", { name: "Abrir en un modal" }),
    ).toBeNull();
  },
};
