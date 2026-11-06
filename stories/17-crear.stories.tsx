import { entity, isEntityId, restTransport } from "@sincpro/client-framework";
import {
  dirtyOf,
  EntityPicker,
  explain,
  FrameworkProvider,
  RecordField,
  type RecordReading,
  Refused,
  useRecord,
} from "@sincpro/web-framework";
import { Button, Callout, Record, Skeleton } from "@sincpro/web-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ReactNode, useMemo, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { type Call, restServer } from "./support/rest";
import { servidorVentas } from "./support/servidor";
import { type Cliente, clientes, type Factura, facturas } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/17 · Crear un registro",
  parameters: {
    docs: {
      description: {
        component:
          '`useRecord(entidad, "")` es un registro que **todavía no existe**: arranca con los `default` que publica la meta (estado borrador, efectivo, descuento 0), se previsualiza como cualquier otro y `save()` lo manda a la ruta `create` de la entidad. Si la respuesta trae la identidad nueva, el mismo hook **pasa a ser ese registro** y lo lee. Cada alta viaja con un **`Idempotency-Key`** (sincpro_framework lo exige en un Command `@idempotency`): si la respuesta se pierde en el camino, «Guardar» otra vez manda la **misma** clave y el servidor contesta lo que ya hizo — una factura, no dos.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

/** The same server and wire as story 12; `perder` drops the answer of the first create AFTER
 *  the server ran it — the request that a network cut leaves in doubt. */
function Escena({
  perder = false,
  children,
}: {
  perder?: boolean;
  children: (calls: readonly Call[]) => ReactNode;
}) {
  const [calls, setCalls] = useState<Call[]>([]);
  const transport = useMemo(() => {
    const server = restServer(servidorVentas(), "/v1", (call) =>
      queueMicrotask(() => setCalls((now) => [...now, call])),
    );
    let perdida = perder;
    const fetcher: typeof fetch = async (input, init) => {
      const answer = await server.fetch(input, init);
      if (perdida && init?.method === "POST" && String(input).endsWith("/facturas")) {
        perdida = false;
        throw new TypeError("Failed to fetch");
      }
      return answer;
    };
    return restTransport({ base: server.base, fetch: fetcher });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- set up once per story
  }, []);
  return (
    <FrameworkProvider transport={transport} locale="es">
      <div className="min-h-dvh bg-ground p-6">
        <div className="@container overflow-clip rounded-box border border-line-strong bg-surface">
          {children(calls)}
        </div>
      </div>
    </FrameworkProvider>
  );
}

function Cable({ calls }: { calls: readonly Call[] }) {
  return (
    <ol aria-label="Lo que viajó" className="px-4 pb-4 font-mono text-micro text-muted">
      {calls.map((call, i) => (
        <li key={i}>
          {call.method} {decodeURIComponent(call.url).slice(0, 70)}
          {call.key === undefined ? "" : ` · clave ${call.key.slice(0, 8)}`}
        </li>
      ))}
    </ol>
  );
}

function Formulario({ factura }: { factura: RecordReading<Factura> }) {
  const { edit } = factura;
  const dirty = dirtyOf(factura);
  if (factura.status === "loading") return <Skeleton rows={6} label="Cargando" />;
  if (factura.status === "failed")
    return <Refused error={factura.error} onRetry={factura.reload} />;
  const fallo = edit.failure === null ? null : explain(edit.failure);
  return (
    <Record
      identity={{
        title: factura.isNew ? "Nueva factura" : factura.record.number,
        ...(factura.isNew ? {} : { subtitle: factura.record.customer.name }),
      }}
      {...(dirty === undefined ? {} : { dirty })}
    >
      <Record.Rail>
        <Record.Actions>
          <Button size="sm" role="ghost" onClick={factura.reload}>
            Volver a leer
          </Button>
        </Record.Actions>
      </Record.Rail>
      <Record.Paper layout="horizontal">
        {fallo === null ? null : (
          <Callout tone="bad" title={fallo.heading}>
            {fallo.sentence}
          </Callout>
        )}
        <div className="grid max-w-3xl grid-cols-2 gap-3 p-4">
          <RecordField
            record={factura}
            name="customer_id"
            as={({ value, set, label }) => (
              <EntityPicker
                entity={clientes}
                value={String(value ?? "")}
                onChange={set}
                aria-label={label}
              />
            )}
          />
          <RecordField record={factura} name="state" />
          <RecordField record={factura} name="payment" />
          <RecordField record={factura} name="discount" />
          <RecordField record={factura} name="notes" />
        </div>
      </Record.Paper>
    </Record>
  );
}

function Nueva() {
  return <Formulario factura={useRecord(facturas, "")} />;
}

async function elegirGlobex(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  const page = within(canvasElement.ownerDocument.body);
  await userEvent.click(await canvas.findByRole("combobox", { name: /Cliente \(código\)/ }));
  await userEvent.click(await page.findByRole("option", { name: /Globex Bolivia/ }));
}

export const ArrancaConLosValoresPorDefecto: Story = {
  render: () => (
    <Escena>
      {(calls) => (
        <>
          <Nueva />
          <Cable calls={calls} />
        </>
      )}
    </Escena>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("heading", { name: "Nueva factura" });
    // The model's defaults, on screen before anything is typed: `state` is the server's
    // (read-only) and reads as its word; the payment starts as cash.
    await expect(canvas.getByText("Borrador")).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: /^(?!Copiar).*Forma de pago/ }),
    ).toHaveTextContent("Efectivo");
    // Only the model was asked — one row, for its definition. No record was read.
    await expect(canvas.getByLabelText("Lo que viajó")).not.toHaveTextContent(
      "GET /v1/facturas/",
    );
  },
};

export const SeCreaYSeVuelveElRegistro: Story = {
  render: () => (
    <Escena>
      {(calls) => (
        <>
          <Nueva />
          <Cable calls={calls} />
        </>
      )}
    </Escena>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("heading", { name: "Nueva factura" });
    await elegirGlobex(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Guardar" }));
    // The server numbered it; the same screen now IS that invoice, read back.
    await expect(await canvas.findByRole("heading", { name: "F-2026-0065" })).toBeVisible();
    const cable = canvas.getByLabelText("Lo que viajó");
    await expect(cable).toHaveTextContent(/POST \/v1\/facturas · clave/);
    await expect(cable).toHaveTextContent("GET /v1/facturas/F-2026-0065");
  },
};

export const ReintentarNoDuplica: Story = {
  render: () => (
    <Escena perder>
      {(calls) => (
        <>
          <Nueva />
          <Cable calls={calls} />
        </>
      )}
    </Escena>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("heading", { name: "Nueva factura" });
    await elegirGlobex(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Guardar" }));
    // The server created it, but the answer never arrived: nobody knows, so it says so.
    await expect(await canvas.findByText("Failed to fetch")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Guardar" }));
    // The retry carried the SAME key: the server answered the invoice it already made. With a
    // new key this would be F-2026-0066 — a second invoice for one click.
    await expect(await canvas.findByRole("heading", { name: "F-2026-0065" })).toBeVisible();
    const posts = () =>
      [...canvas.getByLabelText("Lo que viajó").querySelectorAll("li")]
        .map((li) => li.textContent ?? "")
        .filter((line) => line.startsWith("POST /v1/facturas ·"));
    await waitFor(() => expect(posts()).toHaveLength(2));
    await expect(posts()[0]).toBe(posts()[1]);
  },
};

/** The customers served by sincpro_framework's `Edit`: one route, by action — and a new one is
 *  created under the id the CLIENT mints. */
const clientesPorEdit = entity<Cliente>("ventas:cliente", {
  list: "/clientes",
  edit: "PUT /clientes/{id}/edit",
});

/** Each `Edit` that travelled: its action, the id in its path and the id in its body. */
function Ediciones({ calls }: { calls: readonly Call[] }) {
  const said = calls
    .filter((call) => call.method === "PUT")
    .map((call) => {
      const body = call.body as { action?: string; id?: string; values?: object };
      const enRuta = decodeURIComponent(call.url).split("/clientes/")[1]?.split("/")[0];
      const sinId = body.values !== undefined && !("id" in body.values);
      return `${body.action}:${enRuta}:${body.id}:${sinId ? "values-sin-id" : "values-con-id"}`;
    });
  return <p aria-label="Ediciones">{said.join(" ")}</p>;
}

function NuevoCliente() {
  const cliente = useRecord(clientesPorEdit, "");
  const { edit } = cliente;
  if (cliente.status === "loading") return <Skeleton rows={3} label="Cargando" />;
  if (cliente.status === "failed")
    return <Refused error={cliente.error} onRetry={cliente.reload} />;
  const fallo = edit.failure === null ? null : explain(edit.failure);
  return (
    <Record identity={{ title: cliente.isNew ? "Nuevo cliente" : cliente.record.name }}>
      <Record.Rail>
        <Record.Actions>
          {edit.keep === undefined ? null : (
            <Button size="sm" role="ghost" onClick={() => void edit.keep?.()}>
              Guardar borrador
            </Button>
          )}
          <Button size="sm" role="primary" onClick={() => void edit.save()}>
            Guardar
          </Button>
        </Record.Actions>
      </Record.Rail>
      <Record.Paper layout="stacked">
        {fallo === null ? null : (
          <Callout tone="bad" title={fallo.heading}>
            {fallo.sentence}
          </Callout>
        )}
        <div className="grid max-w-xl gap-3 p-4">
          <RecordField record={cliente} name="name" />
          <RecordField record={cliente} name="city" />
          <p aria-label="Código">{cliente.isNew ? "—" : cliente.id}</p>
          {edit.draft === null ? null : (
            <p>Borrador en el servidor · versión {edit.draft.version}</p>
          )}
        </div>
      </Record.Paper>
    </Record>
  );
}

export const NaceConElIdQueGeneraElFront: Story = {
  render: () => (
    <Escena>
      {(calls) => (
        <>
          <NuevoCliente />
          <Ediciones calls={calls} />
          <Cable calls={calls} />
        </>
      )}
    </Escena>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("heading", { name: "Nuevo cliente" });
    await userEvent.type(
      canvas.getByRole("textbox", { name: /^Nombre/ }),
      "Ferretería Andina",
    );
    // A new record keeps a draft on the server — under the key the front minted for it.
    await userEvent.click(canvas.getByRole("button", { name: "Guardar borrador" }));
    await expect(
      await canvas.findByText("Borrador en el servidor · versión 1"),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Guardar" }));
    // Stored, and the same screen IS that customer now, read back by its key.
    await expect(
      await canvas.findByRole("heading", { name: "Ferretería Andina" }),
    ).toBeVisible();
    const id = canvas.getByLabelText("Código").textContent ?? "";
    // A UUID v7 as sincpro_framework writes it: 32 hex, version 7.
    await expect(isEntityId(id)).toBe(true);
    // The draft and the stored record share it: the path and the body name the same one, and
    // the values never carry a field the framework writes.
    await expect(canvas.getByLabelText("Ediciones")).toHaveTextContent(
      `save_draft:${id}:${id}:values-sin-id save:${id}:${id}:values-sin-id`,
    );
    await expect(canvas.getByLabelText("Lo que viajó")).toHaveTextContent(
      `GET /v1/clientes/${id}`,
    );
    // No `create` route was needed: an entity that speaks `Edit` creates through it.
    await expect(canvas.getByLabelText("Lo que viajó")).not.toHaveTextContent(
      "POST /v1/clientes",
    );
  },
};
