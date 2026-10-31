import { Destination, useCrumbs, type ViewProps } from "@sincpro/web-composer";
import {
  chooserIn,
  dirtyOf,
  EntityList,
  EntityPicker,
  entityView,
  memoryTransport,
  RecordField,
  Refused,
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
  title: "Casos de uso/18 · Las ventanas de composer",
  parameters: {
    docs: {
      description: {
        component:
          "Cómo un registro usa el workspace sin escribir referencias a mano. **Nuevo**: la lista ofrece «Nuevo» cuando la entidad declara `create`, y abre `entidad.newRef()` — la misma vista del registro, sin id; al crearse, la superficie se **reemplaza** (`api.replace`) por el registro que nació, en la página, el vistazo o la ventana donde estaba, sin miga que vuelva a un formulario vacío. **Elegir**: `chooserIn(api, entidad, set)` abre la lista de la entidad como selector (`api.pick` + `entidad.chooserRef()`); ahí una fila **contesta** (`api.answer`) en vez de abrirse, y la ventana se cierra.\n\nUna ventana es angosta: web-ui dibuja la lista como filas, y una fila contesta igual.\n\n**Huecos**: composer no le dice a una vista que la abrieron para elegir — viaja como parámetro `pick` de la referencia; y el `Picker` de web-ui sólo ofrece «ver todos…» cuando tiene filas que no dibuja, así que con ocho clientes el selector se abre con un botón propio. Los dos están en `docs/ROADMAP.md`.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

function Facturas({ api }: ViewProps) {
  const listing = useListing(facturas, { pageSize: 20 });
  return (
    <EntityList
      listing={listing}
      api={api}
      columns={["number", "customer", "state", "amount_total"]}
      actions={
        <Button
          size="sm"
          role="secondary"
          onClick={() => api.open(facturas.newRef(), { to: Destination.Window })}
        >
          Nueva en una ventana
        </Button>
      }
    />
  );
}

function Factura({ api, resource }: ViewProps) {
  const factura = useRecord(facturas, resource.id ?? "");
  const crumbs = useCrumbs(api);
  useRecordInWorkspace(api, factura);
  const dirty = dirtyOf(factura);
  if (factura.status === "loading") return <Skeleton rows={4} label="Cargando" />;
  if (factura.status === "failed")
    return <Refused error={factura.error} onRetry={factura.reload} />;
  return (
    <Record
      identity={{
        title: factura.isNew ? "Nueva factura" : factura.record.number,
        ...(factura.isNew ? {} : { subtitle: factura.record.customer.name }),
      }}
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
          <RecordField
            record={factura}
            name="customer_id"
            as={({ value, set, label }) => (
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <EntityPicker
                    entity={clientes}
                    value={String(value ?? "")}
                    onChange={set}
                    onBrowseAll={chooserIn(api, clientes, set)}
                    aria-label={label}
                  />
                </div>
                <Button size="sm" role="ghost" onClick={chooserIn(api, clientes, set)}>
                  Elegir en una ventana
                </Button>
              </div>
            )}
          />
          <RecordField record={factura} name="payment" />
          <RecordField record={factura} name="notes" />
        </div>
      </Record.Paper>
    </Record>
  );
}

function Clientes({ api }: ViewProps) {
  return <EntityList listing={useListing(clientes)} api={api} />;
}

function Cliente({ api, resource }: ViewProps) {
  const cliente = useRecord(clientes, resource.id ?? "");
  useRecordInWorkspace(api, cliente);
  if (cliente.status !== "ready") return <Skeleton rows={2} label="Cargando" />;
  return <Record identity={{ title: cliente.record.name }}>{null}</Record>;
}

function App() {
  const transport = useMemo(() => {
    const servidor = servidorVentas();
    return memoryTransport(servidor.tables, { latency: 60, handle: servidor.handle });
  }, []);
  const views = useMemo(
    () => [
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
    ],
    [transport],
  );
  return (
    <div className="flex h-dvh min-h-0 flex-col bg-ground">
      <SincproApp
        transport={transport}
        views={views}
        start={facturas.ref()}
        metas={{ [facturas.key]: facturaMeta, [clientes.key]: clienteMeta }}
      />
    </div>
  );
}

async function elegirGlobex(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  const page = within(canvasElement.ownerDocument.body);
  await userEvent.click(await canvas.findByRole("combobox", { name: /Cliente \(código\)/ }));
  await userEvent.click(await page.findByRole("option", { name: /Globex Bolivia/ }));
}

export const NuevaDesdeLaLista: Story = {
  render: () => <App />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("1–20");
    // Offered because `facturas` declares `create`: the list does not need a button written.
    await userEvent.click(canvas.getByRole("button", { name: "Nuevo" }));
    await canvas.findByRole("heading", { name: "Nueva factura" });
    // The crumb names it by the model until it exists — `useCrumbs` follows `setTitle`.
    await expect(await canvas.findByText("Facturas · nuevo")).toBeInTheDocument();
    await elegirGlobex(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Guardar" }));
    // Replaced, not pushed: the page is the invoice now, and no crumb leads back to the form.
    await expect(await canvas.findByRole("heading", { name: "F-2026-0065" })).toBeVisible();
    await waitFor(() =>
      expect(canvas.queryByRole("heading", { name: "Nueva factura" })).toBeNull(),
    );
  },
};

export const LaNuevaEnUnaVentana: Story = {
  render: () => <App />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("1–20");
    await userEvent.click(canvas.getByRole("button", { name: "Nueva en una ventana" }));
    await canvas.findByRole("heading", { name: "Nueva factura" });
    await elegirGlobex(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Guardar" }));
    // The window stays a window: it now holds the invoice it created, the list stays behind.
    await expect(await canvas.findByRole("heading", { name: "F-2026-0065" })).toBeVisible();
    await expect(canvas.getByText("1–20")).toBeInTheDocument();
  },
};

export const ElegirEnUnaVentana: Story = {
  render: () => <App />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("1–20");
    await userEvent.click(canvas.getByRole("button", { name: "Nuevo" }));
    await canvas.findByRole("heading", { name: "Nueva factura" });
    await userEvent.click(canvas.getByRole("button", { name: "Elegir en una ventana" }));
    // The customers' own list, opened to CHOOSE: no «New», no peek links on the identity —
    // a row is an answer, not a door.
    await canvas.findByText("Globex Bolivia");
    await expect(canvas.queryByRole("button", { name: "Nuevo" })).toBeNull();
    await expect(canvas.queryAllByRole("button", { name: /vistazo/i })).toHaveLength(0);
    // A window is narrow: web-ui swaps the table for rows after its first paint
    // (`useNarrowList`). Click the row that stays, not the one that was swapped out.
    await waitFor(() => expect(canvas.getByText("Globex Bolivia").closest("tr")).toBeNull());
    await userEvent.click(canvas.getByText("Globex Bolivia"));
    // The row ANSWERED: the field holds the customer, the chooser closed, the form is still new.
    await expect(await canvas.findByDisplayValue("Globex Bolivia")).toBeVisible();
    await waitFor(() => expect(canvas.queryByText("Ferretería El Progreso")).toBeNull());
    await expect(canvas.getByRole("heading", { name: "Nueva factura" })).toBeVisible();
  },
};
