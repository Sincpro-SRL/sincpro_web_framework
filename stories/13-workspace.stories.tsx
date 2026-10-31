import {
  Composer,
  type ResourceRef,
  useCrumbs,
  useWorkspace,
  type ViewProps,
  type ViewSpec,
  Zone,
} from "@sincpro/web-composer";
import { createRegistry } from "@sincpro/web-composer/domain";
import {
  dirtyOf,
  EntityList,
  entityView,
  factsOf,
  FrameworkProvider,
  RecordField,
  Refused,
  restTransport,
  useListing,
  useRecord,
  useRecordInWorkspace,
  webUiSkin,
} from "@sincpro/web-framework";
import { Button, Record, Skeleton } from "@sincpro/web-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useMemo, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { restServer } from "./support/rest";
import { servidorVentas } from "./support/servidor";
import { clienteMeta, clientes, facturaMeta, facturas } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/13 · El workspace: ⌘K, selección, descartar",
  parameters: {
    docs: {
      description: {
        component:
          "Varias entidades en el workspace de composer, vestido de web-ui (`webUiSkin`), todo por HTTP. **⌘K** busca una factura con la `LiteralSearch` de la entidad. **La selección** de la lista se publica (`api.select`) y un panel al costado la sigue sin conocer la lista. **Descartar pregunta antes**: el registro le dice al workspace que tiene cambios (`useRecordInWorkspace`), y una miga, un cierre o el Atrás del navegador preguntan con el `Dialog` de web-ui. **El vistazo** es el `Peek` de web-ui.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

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
  const dirty = dirtyOf(factura);
  if (factura.status === "loading") return <Skeleton rows={4} label="Cargando" />;
  if (factura.status === "failed")
    return <Refused error={factura.error} onRetry={factura.reload} />;
  return (
    <Record
      identity={{ title: factura.record.number, subtitle: factura.record.customer.name }}
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
      <Record.Paper layout="horizontal">
        <Record.Facts
          fields={factsOf(factura.record, factura.meta, ["state", "amount_total"], {
            locale: "es",
          })}
        />
        <div className="max-w-md p-4">
          <RecordField record={factura} name="notes" />
        </div>
      </Record.Paper>
    </Record>
  );
}

function Clientes({ api }: ViewProps) {
  return <EntityList listing={useListing(clientes)} api={api} />;
}

function Cliente({ resource }: ViewProps) {
  const cliente = useRecord(clientes, resource.id ?? "");
  if (cliente.status !== "ready") return <Skeleton rows={2} label="Cargando" />;
  return <Record identity={{ title: cliente.record.name }}>{null}</Record>;
}

/** A panel that follows what the page has ticked — and knows nothing of the list. */
function Seleccion({ api }: ViewProps) {
  const [refs, setRefs] = useState<readonly ResourceRef[]>(() => api.context.selection());
  useEffect(() => api.context.subscribe(() => setRefs(api.context.selection())), [api]);
  return (
    <p className="p-4 text-ink" aria-live="polite">
      {refs.length === 0
        ? "Marcá facturas en la lista."
        : `${refs.length} marcadas: ${refs.map((ref) => ref.id).join(", ")}`}
    </p>
  );
}

const SELECCION: ResourceRef = { domain: "ventas", kind: "seleccion" };

function Workspace({ conPanel = false }: { conPanel?: boolean }) {
  const transport = useMemo(() => {
    const server = restServer(servidorVentas());
    return restTransport({ base: server.base, fetch: server.fetch });
  }, []);
  const registry = useMemo(
    () =>
      createRegistry([
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
        {
          domain: "ventas",
          kind: "seleccion",
          title: () => "Selección",
          load: async () => Seleccion,
        } satisfies ViewSpec,
      ]),
    [transport],
  );
  const workspace = useWorkspace();
  useEffect(() => {
    workspace.start(facturas.ref());
    if (conPanel) workspace.openPanel(SELECCION, Zone.Right);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the first screen only
  }, [workspace]);
  return (
    <FrameworkProvider transport={transport} locale="es">
      <div className="flex h-dvh min-h-0 flex-col bg-ground">
        <Composer workspace={workspace} registry={registry} skin={webUiSkin} />
      </div>
    </FrameworkProvider>
  );
}

export const BuscarConCmdK: Story = {
  render: () => <Workspace />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await canvas.findByText("20 de 64");
    await userEvent.keyboard("{Meta>}k{/Meta}");
    const palette = await page.findByRole("dialog");
    await userEvent.type(within(palette).getByRole("combobox"), "0007");
    await userEvent.click(
      await within(palette).findByRole("option", { name: /F-2026-0007/ }),
    );
    const heading = await canvas.findByRole("heading", { name: "F-2026-0007" });
    await waitFor(() => expect(heading).toBeVisible());
  },
};

export const LaSeleccionLaSigueUnPanel: Story = {
  render: () => <Workspace conPanel />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("20 de 64");
    await expect(await canvas.findByText("Marcá facturas en la lista.")).toBeInTheDocument();
    const boxes = await canvas.findAllByRole("checkbox");
    await userEvent.click(boxes[1]!);
    await userEvent.click(boxes[2]!);
    await expect(
      await canvas.findByText(/^2 marcadas: F-2026-\d{4}, F-2026-\d{4}$/),
    ).toBeInTheDocument();
  },
};

export const DescartarPreguntaAntes: Story = {
  render: () => <Workspace />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await canvas.findByText("20 de 64");
    const [first] = await canvas.findAllByText(/^F-2026-\d{4}$/);
    const number = first?.textContent ?? "";
    await userEvent.click(first!);
    await userEvent.type(await canvas.findByRole("textbox", { name: "Nota" }), "a medias");
    // A crumb is a link (React Aria's `Breadcrumbs`), not a button.
    await userEvent.click(await canvas.findByRole("link", { name: "Facturas" }));
    // The question fades in: in the document before it is visible.
    const question = await page.findByRole("dialog");
    await waitFor(() => expect(question).toBeVisible());
    await userEvent.keyboard("{Escape}");
    // Escape is the safe answer: nothing is thrown away, the record stays.
    await expect(await canvas.findByDisplayValue("a medias")).toBeInTheDocument();
    await expect(canvas.getByRole("heading", { name: number })).toBeInTheDocument();
  },
};

export const ElVistazoEsDeWebUi: Story = {
  render: () => <Workspace />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("20 de 64");
    const [eye] = await canvas.findAllByRole("button", { name: /vistazo/i });
    await userEvent.click(eye!);
    const drawer = await canvas.findByRole("complementary");
    await expect(drawer.querySelector("svg.lucide")).not.toBeNull();
  },
};
