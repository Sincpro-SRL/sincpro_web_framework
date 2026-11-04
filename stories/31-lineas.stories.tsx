import type { AnyRecord } from "@sincpro/criteria";
import {
  dirtyOf,
  type LineAdding,
  type Method,
  RecordField,
  type RecordReading,
  useRecord,
} from "@sincpro/web-framework";
import { Button, Record, Skeleton, ToastProvider } from "@sincpro/web-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Escenario, EscenarioRest } from "./support/escenario";
import {
  type LineaPedido,
  PEDIDO,
  pedidos,
  productos,
  servidorPedidos,
} from "./support/pedidos";
import type { Call } from "./support/rest";
import { type Factura, FACTURA_GRANDE, FACTURAS, facturas } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/31 · Las líneas de una factura",
  parameters: {
    docs: {
      description: {
        component:
          'Las líneas de un agregado se editan **dentro** del registro (`RecordField name="lines"` dibuja el `LineItems` de web-ui) y viajan como sincpro_framework las escribe: la **lista completa y en orden**, en el mismo comando que la factura y con su versión. Una línea leída lleva su id; una **nueva va sin id** —el servidor rechaza uno que no conoce y pone el suyo—, así que su clave en pantalla se guarda aparte y se reconcilia por posición. Agregar, quitar, deshacer y reordenar son de la pantalla: por el cable viaja sólo la lista que resulta. **Dónde se escribe una línea** es una sola decisión: en la **tabla** —«Agregar una línea» es su última fila y una fila se escribe donde está; el lápiz abre la línea entera en su diálogo— siempre que cada campo que se escribe quepa en una celda (un producto many2one es el picker de su entidad); en el **diálogo** si alguno no cabe (un many2one de una entidad que la aplicación no declaró, una fecha con hora) o si la pantalla lo pide (`adding="editor"`): una fila que no se puede terminar donde se abrió es una trampa. El **preview** recalcula los subtotales y dice el estado de cada celda (`states.lines.items[i]`) y sus advertencias (`warnings`, con `path`); un **422** que apunta a `#/values/lines/1/quantity` se dice en esa celda, debajo de su valor. Una factura que trajo **sólo una página** de sus líneas no se edita: escribirla entera borraría las que no trajo.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

/** A draft invoice that brought all its lines (more than one). */
const EDITABLE = FACTURAS.find(
  (f) => f.state === "draft" && f.lines.cursor === null && f.lines.items.length >= 2,
)!;
const LINEAS = EDITABLE.lines.items.length;

/** What the last save sent, as the server read it: each line's id — or «nueva» — and the version. */
function Guardado({ calls, numero }: { calls: readonly Call[]; numero: string }) {
  const saved = [...calls]
    .reverse()
    .find((call) => call.method === "PUT" && call.url.endsWith(`/facturas/${numero}`));
  const body = (saved?.body ?? null) as {
    lines?: { id?: string }[];
    version?: number;
  } | null;
  return (
    <p aria-label="Lo que se guardó" className="px-4 pb-4 font-mono text-micro text-muted">
      {body === null
        ? "—"
        : `versión ${String(body.version)} · ${(body.lines ?? []).map((l) => l.id ?? "nueva").join(", ")}`}
    </p>
  );
}

function Formulario({
  factura,
  adding,
}: {
  factura: RecordReading<Factura>;
  adding?: LineAdding;
}) {
  const dirty = dirtyOf(factura);
  if (factura.status !== "ready") return <Skeleton rows={6} label="Cargando la factura" />;
  return (
    <Record
      identity={{ title: factura.record.number, subtitle: factura.record.customer.name }}
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
          <RecordField
            record={factura}
            name="lines"
            {...(adding === undefined ? {} : { adding })}
          />
          <RecordField record={factura} name="amount_total" />
        </div>
      </Record.Paper>
    </Record>
  );
}

function Escena({ numero, adding }: { numero: string; adding?: LineAdding }) {
  // The toasts («Se quitó… Deshacer») are the application's, as in `SincproApp`.
  return (
    <ToastProvider>
      <EscenarioRest>
        {({ calls }) => (
          <>
            <Conectado numero={numero} {...(adding === undefined ? {} : { adding })} />
            <Guardado calls={calls} numero={numero} />
          </>
        )}
      </EscenarioRest>
    </ToastProvider>
  );
}

function Conectado({ numero, adding }: { numero: string; adding?: LineAdding }) {
  const factura = useRecord(facturas, numero);
  return <Formulario factura={factura} {...(adding === undefined ? {} : { adding })} />;
}

function Pedido() {
  const pedido = useRecord(pedidos, PEDIDO);
  const dirty = dirtyOf(pedido);
  if (pedido.status !== "ready") return <Skeleton rows={3} label="Cargando el pedido" />;
  return (
    <Record
      identity={{ title: pedido.record.number }}
      {...(dirty === undefined ? {} : { dirty })}
    >
      <Record.Rail>
        <Record.Actions>
          <Button size="sm" role="ghost" onClick={pedido.reload}>
            Volver a leer
          </Button>
        </Record.Actions>
      </Record.Rail>
      <Record.Paper>
        <div className="grid gap-3 p-4">
          <RecordField record={pedido} name="lines" />
        </div>
      </Record.Paper>
    </Record>
  );
}

/** An order whose lines name a product; `declarado` says whether the app declared products. */
function EscenaPedido({ declarado = true }: { declarado?: boolean }) {
  const [guardado, setGuardado] = useState("—");
  const servidor = useMemo(() => {
    const own = servidorPedidos();
    // What each save sent, as the server read it: «product_code×quantity» per line.
    const handle = (method: Method, route: string, body: unknown) => {
      const lines = (body as { lines?: LineaPedido[] }).lines ?? [];
      queueMicrotask(() =>
        setGuardado(lines.map((one) => `${one.product_code}×${one.quantity}`).join(", ")),
      );
      return own.handle(method, route, body);
    };
    return { tables: own.tables, handle };
  }, []);
  return (
    <ToastProvider>
      <Escenario
        tables={
          servidor.tables as Readonly<Record<string, { meta: never; rows: AnyRecord[] }>>
        }
        handle={servidor.handle}
        latency={40}
        entities={declarado ? [pedidos, productos] : [pedidos]}
      >
        <Pedido />
        <p
          aria-label="Lo que se guardó"
          className="px-4 pb-4 font-mono text-micro text-muted"
        >
          {guardado}
        </p>
      </Escenario>
    </ToastProvider>
  );
}

/** Open a line's dialog — the `index`-th «Editar la línea» — and hand back the dialog. */
async function abrir(canvasElement: HTMLElement, index: number) {
  const canvas = within(canvasElement);
  const page = within(canvasElement.ownerDocument.body);
  const editar = await canvas.findAllByRole("button", { name: "Editar la línea" });
  await userEvent.click(editar[index]!);
  return within(await page.findByRole("dialog"));
}

async function escribir(where: ReturnType<typeof within>, label: string, text: string) {
  const field = where.getByLabelText(label);
  await userEvent.clear(field);
  await userEvent.type(field, text);
}

export const AgregarEnLaTabla: Story = {
  render: () => <Escena numero={EDITABLE.number} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await expect(await canvas.findByText(`${LINEAS} líneas`)).toBeVisible();
    // Every field of a line fits a cell: «Agregar una línea» writes it IN the table.
    await userEvent.click(canvas.getByRole("button", { name: "Agregar una línea" }));
    const producto = await canvas.findByRole("textbox", { name: "Producto" });
    await waitFor(() => expect(producto).toHaveFocus());
    await expect(page.queryByRole("dialog")).toBeNull();
    await userEvent.type(producto, "Tóner");
    await escribir(canvas, "Cantidad", "2");
    await escribir(canvas, "Precio", "10");
    await userEvent.keyboard("{Enter}");
    await expect((await canvas.findAllByRole("cell", { name: "Tóner" }))[0]).toBeVisible();
    await expect(canvas.getByText(`${LINEAS + 1} líneas`)).toBeVisible();
    // Saved like any other: the whole list, in order, the new line WITHOUT an id.
    await userEvent.click(canvas.getByRole("button", { name: "Guardar" }));
    const ids = EDITABLE.lines.items.map((line) => line.id).join(", ");
    await waitFor(() =>
      expect(canvas.getByLabelText("Lo que se guardó")).toHaveTextContent(
        `versión ${EDITABLE.version} · ${ids}, nueva`,
      ),
    );
  },
};

export const UnProductoEnLaCelda: Story = {
  render: () => <EscenaPedido />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    // A line reads its product by name, not by the key it is written with.
    await expect(
      (await canvas.findAllByRole("cell", { name: "Cemento 50 kg" }))[0],
    ).toBeVisible();
    await expect(canvas.queryByText("CEM-50")).toBeNull();
    // A product is a picker of its entity, inside the cell: the server's literal search.
    await userEvent.click(canvas.getByRole("button", { name: "Agregar una línea" }));
    await expect(page.queryByRole("dialog")).toBeNull();
    const producto = await canvas.findByRole("combobox", { name: "Producto" });
    await userEvent.type(producto, "Fierro");
    await userEvent.click(await page.findByRole("option", { name: /Fierro 12 mm/ }));
    await escribir(canvas, "Cantidad", "3");
    await userEvent.keyboard("{Enter}");
    // Closed, the cell names what was chosen — with no second question to the server.
    await expect(
      (await canvas.findAllByRole("cell", { name: "Fierro 12 mm" }))[0],
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Guardar" }));
    // The key travelled, not the name.
    await waitFor(() =>
      expect(canvas.getByLabelText("Lo que se guardó")).toHaveTextContent(
        "CEM-50×4, FIE-12×3",
      ),
    );
  },
};

export const SinSuEntidadSeAgregaEnElDialogo: Story = {
  render: () => <EscenaPedido declarado={false} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await expect(
      (await canvas.findAllByRole("cell", { name: "Cemento 50 kg" }))[0],
    ).toBeVisible();
    // Products are not an entity of this app: in a cell the product would be a key nobody
    // types, so the line is written in its dialog, where every field has room.
    await userEvent.click(canvas.getByRole("button", { name: "Agregar una línea" }));
    const dialogo = within(await page.findByRole("dialog"));
    await waitFor(() =>
      expect(dialogo.getByRole("textbox", { name: /^Producto/ })).toBeVisible(),
    );
    await expect(canvas.queryByRole("combobox", { name: "Producto" })).toBeNull();
  },
};

export const AgregarEnElDialogoCambiarYGuardar: Story = {
  // The screen asks for the dialog: the table only reads, a line is written in its dialog.
  render: () => <Escena numero={EDITABLE.number} adding="editor" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await expect(await canvas.findByText(`${LINEAS} líneas`)).toBeVisible();

    // A price under cost: the preview warns about THAT price (`path: ["lines", 0, "price"]`).
    let dialogo = await abrir(canvasElement, 0);
    await escribir(dialogo, "Precio", "0");
    await userEvent.click(dialogo.getByRole("button", { name: "Listo" }));
    await expect(
      await canvas.findByRole("button", { name: "Precio bajo el costo" }),
    ).toBeVisible();

    // A new line, with a quantity the server refuses.
    await userEvent.click(canvas.getByRole("button", { name: "Agregar una línea" }));
    dialogo = within(await page.findByRole("dialog"));
    await escribir(dialogo, "Producto", "Tóner");
    await escribir(dialogo, "Cantidad", "0");
    await escribir(dialogo, "Precio", "10");
    await userEvent.click(dialogo.getByRole("button", { name: "Listo" }));
    await expect(await canvas.findByText(`${LINEAS + 1} líneas`)).toBeVisible();

    // Saved: the 422 points at `#/values/lines/<new>/quantity` and is said in THAT cell, under
    // its value (web-ui 1.6 `cellState`) — not on the whole field, not on the whole line.
    await userEvent.click(canvas.getByRole("button", { name: "Guardar" }));
    const error = await canvas.findByText("La cantidad tiene que ser mayor a cero.");
    await expect(error).toBeVisible();
    const fila = error.closest("tr")!;
    await expect(within(fila).getAllByText("Tóner").length).toBeGreaterThan(0);
    await expect(within(fila).queryByRole("button", { name: /mayor a cero/ })).toBeNull();
    // The whole list traveled, in order, the new one WITHOUT an id, with the version read.
    const ids = EDITABLE.lines.items.map((line) => line.id).join(", ");
    await expect(canvas.getByLabelText("Lo que se guardó")).toHaveTextContent(
      `versión ${EDITABLE.version} · ${ids}, nueva`,
    );

    // Fixed in its own dialog — found by its local key, it has no id yet — and saved again.
    dialogo = await abrir(canvasElement, LINEAS);
    await escribir(dialogo, "Cantidad", "2");
    await userEvent.click(dialogo.getByRole("button", { name: "Listo" }));
    await userEvent.click(canvas.getByRole("button", { name: "Guardar" }));
    // The server minted the new line's id: read back, nothing is unsaved and it is a line.
    await waitFor(() => expect(canvas.queryByRole("button", { name: "Guardar" })).toBeNull());
    await expect((await canvas.findAllByText("Tóner")).length).toBeGreaterThan(0);
    await expect(canvas.getByText(`${LINEAS + 1} líneas`)).toBeVisible();
  },
};

export const QuitarYDeshacer: Story = {
  render: () => <Escena numero={EDITABLE.number} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const primera = EDITABLE.lines.items[0]!;
    await expect(await canvas.findByText(`${LINEAS} líneas`)).toBeVisible();
    await userEvent.click(canvas.getAllByRole("button", { name: "Quitar la línea" })[0]!);
    await expect(await canvas.findByText(`${LINEAS - 1} líneas`)).toBeVisible();
    // Removing is the screen's: it is unsaved, and «Deshacer» puts it back where it was.
    await expect(canvas.getByRole("button", { name: "Guardar" })).toBeVisible();
    await userEvent.click(await page.findByRole("button", { name: "Deshacer" }));
    await expect(await canvas.findByText(`${LINEAS} líneas`)).toBeVisible();
    await expect(canvas.getAllByText(primera.product).length).toBeGreaterThan(0);
  },
};

export const UnaCeldaQueElServidorFija: Story = {
  render: () => <Escena numero={EDITABLE.number} />,
  play: async ({ canvasElement }) => {
    // From 100 units the price is the list's: the preview says so of THAT line's price
    // (`states.lines.items[0].price.readonly`), and its dialog shows it read only.
    const page = within(canvasElement.ownerDocument.body);
    const dialogo = await abrir(canvasElement, 0);
    await escribir(dialogo, "Cantidad", "100");
    await userEvent.click(dialogo.getByRole("button", { name: "Listo" }));
    // The preview answered when the line's subtotal is the server's 100 × price.
    const [entero, decimales] = (Number(EDITABLE.lines.items[0]!.price) * 100)
      .toFixed(2)
      .split(".");
    const subtotal = new RegExp(
      `^${entero!.replace(/\B(?=(\d{3})+(?!\d))/g, "[.,\\s]?")}[.,]${decimales!}$`,
    );
    await expect(
      (await within(canvasElement).findAllByText(subtotal)).length,
    ).toBeGreaterThan(0);
    // Then the price has no control: read, not written.
    const precioEscrito = (d: ReturnType<typeof within>) =>
      d.queryByRole("textbox", { name: "Precio" }) ??
      d.queryByRole("spinbutton", { name: "Precio" });
    const mirado = await abrir(canvasElement, 0);
    await expect(precioEscrito(mirado)).toBeNull();
    await userEvent.click(mirado.getByRole("button", { name: "Listo" }));
    await waitFor(() => expect(page.queryByRole("dialog")).toBeNull());
    // Another line's price is still the form's.
    const otra = await abrir(canvasElement, 1);
    await expect(precioEscrito(otra)).not.toBeNull();
  },
};

export const SoloUnaPaginaNoSeEdita: Story = {
  render: () => <Escena numero={FACTURA_GRANDE} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // 120 lines, 20 brought: written back whole, it would delete the other 100.
    await expect(await canvas.findByText(/se muestran 20 de 120/i)).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Agregar una línea" })).toBeNull();
    await expect(canvas.queryByRole("button", { name: "Quitar la línea" })).toBeNull();
  },
};
