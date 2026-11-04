import type { AnyRecord } from "@sincpro/criteria";
import {
  dirtyOf,
  type EntityFace,
  EntityList,
  type LineControl,
  type LinesLook,
  RecordField,
  useListing,
  useRecord,
} from "@sincpro/web-framework";
import {
  Button,
  Dialog,
  IconButton,
  Record,
  Skeleton,
  Tag,
  ToastProvider,
} from "@sincpro/web-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Minus, Plus, Rows3 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Escenario, EscenarioRest } from "./support/escenario";
import {
  clienteMeta,
  clientes,
  type Factura,
  facturaMeta,
  FACTURAS,
  facturas,
  VENTAS,
} from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/36 · A tu manera",
  parameters: {
    docs: {
      description: {
        component:
          "Lo que el modelo dibuja es un **default, nunca una jaula**: cada nivel se reemplaza pieza por pieza y el resto sigue siendo del modelo. **Un campo**: `RecordField as` (un widget propio). **Las líneas** de un agregado: `RecordField lines={…}` elige y ordena las columnas, dibuja una celda a su manera (`cells`), escribe un campo con un **control propio** en la celda y en el diálogo (`controls`), suma **columnas que no son campos** —la entrega de una línea, con un botón que la abre en un modal— (`extra`) o escribe el diálogo entero (`editor`); dónde se escribe una línea sigue siendo una sola regla (un campo con control propio cabe en la celda). **Una lista**: `EntityList faces` agrega **caras propias** —una factura con sus líneas y sus botones— que reciben el mismo conjunto que las demás (la página, el agrupado, la selección, qué hace apretar). **Una lista dentro de un registro**: `RecordField list={…}` le pasa a la lista relacionada lo que `EntityList` acepta.",
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const EDITABLE = FACTURAS.find(
  (f) => f.state === "draft" && f.lines.cursor === null && f.lines.items.length >= 2,
)!;
const PRIMERA = EDITABLE.lines.items[0]!;

/** A quantity written with two buttons: a widget of the screen's own, in the cell and the dialog. */
function Cantidad(control: LineControl): ReactNode {
  const now = Number(control.value ?? 0);
  return (
    <span className="flex items-center gap-1">
      <IconButton icon={Minus} label="Restar uno" onClick={() => control.set(now - 1)} />
      <span className="text-meta tabular-nums" aria-label={control.label}>
        {now}
      </span>
      <IconButton icon={Plus} label="Sumar uno" onClick={() => control.set(now + 1)} />
    </span>
  );
}

/** A line's delivery: a sub-model of the line, opened in a modal from a button in its row. */
function Entrega({ line }: { line: AnyRecord }) {
  const [abierta, setAbierta] = useState(false);
  const pedidas = Number(line["quantity"] ?? 0);
  return (
    <>
      <Button size="sm" role="ghost" onClick={() => setAbierta(true)}>
        Ver entrega
      </Button>
      <Dialog
        open={abierta}
        title={`Entrega de ${String(line["product"])}`}
        onClose={() => setAbierta(false)}
      >
        <p className="text-meta">
          Entregadas {Math.floor(pedidas / 2)} de {pedidas}
        </p>
      </Dialog>
    </>
  );
}

const LINEAS_A_MI_MANERA: LinesLook = {
  columns: ["product", "quantity", "subtotal"],
  cells: { product: (line) => <Tag title="Del catálogo">{String(line["product"])}</Tag> },
  controls: { quantity: Cantidad },
  extra: [{ id: "entrega", header: "Entrega", cell: (line) => <Entrega line={line} /> }],
};

function Lineas() {
  const factura = useRecord(facturas, EDITABLE.number);
  const dirty = dirtyOf(factura);
  if (factura.status !== "ready") return <Skeleton rows={4} label="Cargando la factura" />;
  return (
    <Record
      identity={{ title: factura.record.number }}
      {...(dirty === undefined ? {} : { dirty })}
    >
      <Record.Rail>
        <Record.Actions>
          <Button size="sm" role="ghost" onClick={factura.reload}>
            Volver a leer
          </Button>
        </Record.Actions>
      </Record.Rail>
      <Record.Paper>
        <div className="grid gap-3 p-4">
          <RecordField record={factura} name="lines" lines={LINEAS_A_MI_MANERA} />
        </div>
      </Record.Paper>
    </Record>
  );
}

export const LineasConCeldasYControlesPropios: Story = {
  render: () => (
    <ToastProvider>
      <EscenarioRest>{() => <Lineas />}</EscenarioRest>
    </ToastProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    // The product drawn the screen's way; only the columns asked for, plus one that is not a field.
    const propias = await canvas.findAllByTitle("Del catálogo");
    await expect(propias.length).toBe(EDITABLE.lines.items.length);
    await expect(canvas.getByRole("columnheader", { name: "Entrega" })).toBeVisible();
    await expect(canvas.queryByRole("columnheader", { name: "Precio" })).toBeNull();

    // The quantity is written with the screen's own widget, in place.
    await userEvent.click(propias[0]!);
    await userEvent.click(await canvas.findByRole("button", { name: "Sumar uno" }));
    await userEvent.click(canvas.getByRole("heading", { name: EDITABLE.number }));
    await expect(await canvas.findByRole("button", { name: "Guardar" })).toBeVisible();
    await waitFor(() =>
      expect(canvas.getAllByRole("cell", { name: String(PRIMERA.quantity + 1) }).length).toBe(
        1,
      ),
    );

    // The same widget in the line's dialog.
    await userEvent.click(canvas.getAllByRole("button", { name: "Editar la línea" })[0]!);
    const dialogo = within(await page.findByRole("dialog"));
    await expect(dialogo.getByRole("button", { name: "Sumar uno" })).toBeInTheDocument();
    await userEvent.click(dialogo.getByRole("button", { name: "Listo" }));
    await waitFor(() => expect(page.queryByRole("dialog")).toBeNull());

    // A column that is not a field: the line's delivery, opened in a modal from its row.
    await userEvent.click(canvas.getAllByRole("button", { name: "Ver entrega" })[0]!);
    const entrega = await page.findByRole("dialog", {
      name: `Entrega de ${PRIMERA.product}`,
    });
    const sentencia = await within(entrega).findByText(/^Entregadas \d+ de \d+$/);
    await waitFor(() => expect(sentencia).toBeVisible());
  },
};

/** An invoice with its lines and a button: a face of the list written by the screen. */
const CON_SUS_LINEAS: EntityFace<Factura> = {
  id: "con-lineas",
  label: "Con sus líneas",
  icon: Rows3,
  render: (set) => (
    <div className="grid gap-3 p-4">
      {set.items.map((factura) => (
        <article key={set.keyOf(factura)} aria-label={factura.number} className="grid gap-1">
          <h3 className="text-meta">
            {factura.number} · {factura.customer_name}
          </h3>
          <ul className="text-meta text-muted">
            {(factura.lines?.items ?? []).slice(0, 2).map((line) => (
              <li key={line.id}>
                {line.product} × {line.quantity}
              </li>
            ))}
          </ul>
          <Button size="sm" role="secondary" onClick={() => set.press?.(factura)}>
            Abrir
          </Button>
        </article>
      ))}
    </div>
  ),
};

const CARAS = [CON_SUS_LINEAS];

function ListaConCaraPropia() {
  const [abierta, setAbierta] = useState("—");
  return (
    <>
      <EntityList
        listing={useListing(facturas, { pageSize: 5 })}
        views={["con-lineas", "table"]}
        faces={CARAS}
        onOpen={(row) => setAbierta(row.number)}
      />
      <p aria-label="Abierta" className="px-4 pb-4 text-meta text-muted">
        {abierta}
      </p>
    </>
  );
}

export const UnaCaraPropia: Story = {
  render: () => (
    <Escenario tables={VENTAS}>
      <ListaConCaraPropia />
    </Escenario>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The list opens on the screen's face: each invoice with its lines.
    const [primera] = await canvas.findAllByRole("article");
    const numero = primera!.getAttribute("aria-label") ?? "";
    const factura = FACTURAS.find((f) => f.number === numero)!;
    await expect(
      within(primera!).getByText(
        `${factura.lines.items[0]!.product} × ${factura.lines.items[0]!.quantity}`,
      ),
    ).toBeVisible();
    // A press there does what a press does in this list: it opens the record.
    await userEvent.click(within(primera!).getByRole("button", { name: "Abrir" }));
    await expect(canvas.getByLabelText("Abierta")).toHaveTextContent(numero);
  },
};

const FACTURAS_PROPIAS = {
  cells: { number: (row: AnyRecord) => <span>{String(row["number"])} · propia</span> },
};

function ClienteConSusFacturas() {
  const cliente = useRecord(clientes, "C-004");
  if (cliente.status !== "ready") return <Skeleton rows={3} label="Cargando el cliente" />;
  return (
    <Record identity={{ title: cliente.record.name }}>
      <Record.Paper>
        <div className="grid gap-3 p-4">
          <RecordField record={cliente} name="invoices" list={FACTURAS_PROPIAS} />
        </div>
      </Record.Paper>
    </Record>
  );
}

export const UnaListaRelacionadaASuManera: Story = {
  render: () => (
    <Escenario
      tables={VENTAS}
      entities={[clientes, facturas]}
      metas={{ [facturas.key]: facturaMeta, [clientes.key]: clienteMeta }}
    >
      <ClienteConSusFacturas />
    </Escenario>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The customer's invoices, still searched and paged by the server — drawn the screen's way.
    const propias = await canvas.findAllByText(/^F-2026-\d{4} · propia$/);
    await expect(propias.length).toBeGreaterThan(0);
    await expect(canvas.getByRole("combobox", { name: "Buscar" })).toBeVisible();
  },
};
