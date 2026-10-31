import type { AnyRecord } from "@sincpro/criteria";
import { Composer, useWorkspace, type ViewProps } from "@sincpro/web-composer";
import { createRegistry } from "@sincpro/web-composer/domain";
import {
  EntityList,
  entityView,
  factsOf,
  FrameworkProvider,
  memoryTransport,
  Refused,
  textOf,
  useListing,
  useRecord,
} from "@sincpro/web-framework";
import { Record, Skeleton } from "@sincpro/web-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { clienteMeta, clientes, facturaMeta, facturas, VENTAS } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/08 · Varias entidades en el workspace",
  parameters: {
    docs: {
      description: {
        component:
          "Cada entidad se declara al composer con `entityView`: su lista (una referencia sin id) y su registro (con id), y su búsqueda en ⌘K — la `LiteralSearch` del framework, la misma pregunta que un many2one. `EntityList` con la `api` del workspace abre una fila como página, con el ojo en un vistazo, y las migas son las del composer. Ninguna vista importa a otra: el cliente de una factura se abre por referencia.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

const transport = memoryTransport(VENTAS, { latency: 150 });

function ListaDe<T extends AnyRecord>({
  api,
  entity,
  columns,
}: ViewProps & { entity: typeof facturas | typeof clientes; columns: string[] }) {
  const listing = useListing(entity as never, { paging: "more", pageSize: 20 });
  return <EntityList<T> listing={listing as never} api={api} columns={columns} />;
}

function RegistroDe({
  api,
  resource,
  entity,
  facts,
}: ViewProps & { entity: typeof facturas | typeof clientes; facts: string[] }) {
  const one = useRecord(entity as never, resource.id ?? "");
  if (one.status === "loading") return <Skeleton rows={5} label="Cargando" />;
  if (one.status === "failed") return <Refused error={one.error} onRetry={one.reload} />;
  const record = one.record as AnyRecord;
  const model = one.meta;
  const display = model?.display ?? "id";
  return (
    <Record
      identity={{ title: textOf(model, display, record[display], "es") ?? resource.id }}
    >
      <Record.Rail>
        {api.crumbs().length === 0 ? null : <Record.Crumbs crumbs={api.crumbs()} />}
      </Record.Rail>
      <Record.Paper layout="horizontal">
        <Record.Facts fields={factsOf(record, model, facts, { locale: "es" })} />
      </Record.Paper>
    </Record>
  );
}

const FACTURAS_LISTA = (props: ViewProps) => (
  <ListaDe
    {...props}
    entity={facturas}
    columns={["number", "customer", "state", "amount_total"]}
  />
);
const FACTURA = (props: ViewProps) => (
  <RegistroDe
    {...props}
    entity={facturas}
    facts={["customer", "state", "invoice_date", "amount_total"]}
  />
);
const CLIENTES_LISTA = (props: ViewProps) => (
  <ListaDe {...props} entity={clientes} columns={["id", "name", "city", "active"]} />
);
const CLIENTE = (props: ViewProps) => (
  <RegistroDe
    {...props}
    entity={clientes}
    facts={["tax_id", "city", "credit_limit", "active"]}
  />
);

function Workspace() {
  const workspace = useWorkspace();
  const registry = useMemo(
    () =>
      createRegistry([
        entityView(facturas, {
          transport,
          name: "Facturas",
          meta: facturaMeta,
          list: FACTURAS_LISTA,
          record: FACTURA,
        }),
        entityView(clientes, {
          transport,
          name: "Clientes",
          meta: clienteMeta,
          list: CLIENTES_LISTA,
          record: CLIENTE,
        }),
      ]),
    [],
  );
  useMemo(() => workspace.push(facturas.ref()), [workspace]);
  return (
    <FrameworkProvider transport={transport} locale="es">
      <div className="flex h-dvh flex-col bg-ground">
        <Composer workspace={workspace} registry={registry} />
      </div>
    </FrameworkProvider>
  );
}

export const DeLaListaAlRegistroEnElWorkspace: Story = {
  render: () => <Workspace />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("20 de 64");
    const [first] = await canvas.findAllByText(/^F-2026-\d{4}$/);
    const number = first?.textContent ?? "";
    await userEvent.click(first!);
    // It opens where a click on a row opens, and fades in: in the document before visible.
    const heading = await canvas.findByRole("heading", { name: number });
    await waitFor(() => expect(heading).toBeVisible());
  },
};
