import { memoryTransport } from "@sincpro/client-framework";
import type { ViewProps } from "@sincpro/web-composer";
import {
  BatchProgress,
  EntityList,
  entityView,
  RecordField,
  SincproApp,
  useBatchCommand,
  useCommandAction,
  useListing,
  useRecordScreen,
  useSelection,
} from "@sincpro/web-framework";
import { Record, ViewStyleProvider } from "@sincpro/web-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Ban, Check, Download } from "lucide-react";
import { useMemo } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { servidorVentas } from "./support/servidor";
import { clienteMeta, clientes, facturaMeta, facturas } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/67 · El estilo moderno",
  parameters: {
    docs: {
      description: {
        component:
          'web-ui 2.9 toma el **estilo moderno** como dirección (`ViewStyleProvider value="modern"`): las acciones de una pantalla van en **una píldora flotante**, abajo y al centro. Una lista de web-framework da sus acciones **como datos** — «Nuevo», las de la pantalla (`actions`) y lo que se hace con lo elegido (`selectionActions`) — y el estilo decide cómo se dibujan: los botones de la barra en el tradicional, la píldora en el moderno. Mientras hay filas elegidas, la píldora es la de lo elegido: «2 elegidas ✕ · Confirmar (2)». Un **registro** igual: sus comandos como acciones de su dock (`useCommandAction`, `useServiceAction`, y «Eliminar» con `useRecordLifecycleActions`) flotan abajo; lo que destruye queda aparte, en «Más acciones», y dice primero qué haría. Agrupada, la tabla dice lo que el servidor sumó de cada grupo **bajo su columna**, sin repetirlo junto al nombre del grupo.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

/** The invoices, with a Command over what is chosen and one action of the screen's own. */
function Facturas({ api }: ViewProps) {
  const listing = useListing(facturas);
  const elegidas = useSelection(listing);
  const confirmar = useBatchCommand(facturas, "confirmar");
  return (
    <div className="flex flex-col gap-3">
      <div className="px-5 pt-3 empty:hidden">
        <BatchProgress batch={confirmar} />
      </div>
      <EntityList
        listing={listing}
        api={api}
        selectable
        selection={elegidas}
        actions={[{ id: "exportar", label: "Exportar", icon: Download, onSelect: () => {} }]}
        selectionActions={(elegidas) => [
          {
            id: "confirmar",
            label: `Confirmar (${elegidas.size ?? "todas"})`,
            icon: Check,
            primary: true,
            onSelect: () => void confirmar.run(elegidas.selection),
          },
        ]}
      />
    </div>
  );
}

/** An invoice screen of the application's own: its Commands as the dock's actions. */
function Factura(props: ViewProps) {
  const screen = useRecordScreen(facturas, props);
  const id = props.resource.id ?? "";
  const confirmar = useCommandAction({
    entity: facturas,
    command: "confirmar",
    id,
    label: "Confirmar",
    icon: Check,
    primary: true,
  });
  // It destroys: asked first what it would do, and drawn apart, in «Más acciones».
  const anular = useCommandAction({
    entity: facturas,
    command: "anular",
    id,
    label: "Anular",
    icon: Ban,
    destructive: true,
  });
  if (screen.reading.status !== "ready") return null;
  return (
    <>
      <Record {...screen.record}>
        <Record.Rail>
          {screen.crumbs.length === 0 ? null : <Record.Crumbs crumbs={screen.crumbs} />}
          {screen.pager === undefined ? null : <Record.Pager {...screen.pager} />}
          <Record.Dock actions={[confirmar.action, anular.action]} />
        </Record.Rail>
        <Record.Paper layout="horizontal">
          <RecordField record={screen.reading} name="note" />
        </Record.Paper>
      </Record>
      {confirmar.dialog}
      {anular.dialog}
    </>
  );
}

function App() {
  const transport = useMemo(() => {
    const servidor = servidorVentas();
    return memoryTransport(servidor.tables, { latency: 20, handle: servidor.handle });
  }, []);
  const views = useMemo(
    () => [
      entityView(facturas, { transport, name: "Facturas", list: Facturas, record: Factura }),
      entityView(clientes, { transport, name: "Clientes" }),
    ],
    [transport],
  );
  return (
    <ViewStyleProvider value="modern">
      <div className="flex h-dvh min-h-0 flex-col bg-ground">
        <SincproApp
          transport={transport}
          views={views}
          entities={[facturas, clientes]}
          start={facturas.ref()}
          metas={{ [facturas.key]: facturaMeta, [clientes.key]: clienteMeta }}
        />
      </div>
    </ViewStyleProvider>
  );
}

/** Where a toolbar is drawn: `bottom` when it floats, `inline` in the bar. */
const placementOf = (toolbar: HTMLElement) =>
  toolbar.closest('[data-ui="dock"]')?.getAttribute("data-placement") ?? "inline";

export const UnaPildoraFlotante: Story = {
  render: () => <App />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("F-2026-0064");
    // What the list starts floats at the bottom: «Exportar», and «Nuevo» — the gold — last.
    const nuevo = await canvas.findByRole("button", { name: "Nuevo" });
    const lista = nuevo.closest<HTMLElement>('[role="toolbar"]')!;
    await expect(placementOf(lista)).toBe("bottom");
    await expect(within(lista).getByRole("button", { name: "Exportar" })).toBeVisible();
    // Two rows chosen: the pill is what is done to them, with how many and the way out.
    const boxes = await canvas.findAllByRole("checkbox");
    await userEvent.click(boxes[1]!);
    await userEvent.click(boxes[2]!);
    const confirmar = await canvas.findByRole("button", { name: "Confirmar (2)" });
    await expect(placementOf(confirmar.closest<HTMLElement>('[role="toolbar"]')!)).toBe(
      "bottom",
    );
    await expect(canvas.queryByRole("button", { name: "Nuevo" })).toBeNull();
    // Never two pills: cleared, the list's comes back.
    await userEvent.click(canvas.getByRole("button", { name: "Deshacer la selección" }));
    await waitFor(() => expect(canvas.getByRole("button", { name: "Nuevo" })).toBeVisible());
  },
};

export const LasAccionesDelRegistro: Story = {
  render: () => <App />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(await canvas.findByText("F-2026-0061"));
    // The record's Commands float too: «Confirmar» — the gold — at the bottom.
    const confirmar = await canvas.findByRole("button", { name: "Confirmar" });
    await expect(placementOf(confirmar.closest<HTMLElement>('[role="toolbar"]')!)).toBe(
      "bottom",
    );
    await userEvent.click(confirmar);
    await waitFor(() => expect(canvas.getAllByText("Publicada").length).toBeGreaterThan(0));
    // «Anular» destroys: apart, in «Más acciones», and it says what it would do first.
    await userEvent.click(canvas.getByRole("button", { name: "Más acciones" }));
    await userEvent.click(await page.findByRole("menuitem", { name: /Anular/ }));
    const ventana = await page.findByRole("dialog", { name: "Anular" });
    // The window opens with a fade: what it says is read once it is shown.
    await waitFor(() => expect(within(ventana).getByText(/queda anulada/)).toBeVisible());
  },
};
