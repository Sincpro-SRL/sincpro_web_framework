import {
  CommandButton,
  dirtyOf,
  frameworkCopy,
  RecordField,
  Refused,
  textOf,
  useHistory,
  useRecord,
} from "@sincpro/web-framework";
import { Button, Callout, Record, Skeleton } from "@sincpro/web-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Escenario } from "./support/escenario";
import { servidorVentas } from "./support/servidor";
import { facturas } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/10 · Trabajar un registro: editar, actuar, su historia",
  parameters: {
    docs: {
      description: {
        component:
          "Una factura con todo lo que el backend ya resuelve. **Editar**: cada campo es un nombre (`RecordField`) — su palabra, si es obligatorio o de sólo lectura AHORA (los hints de la entidad evaluados sobre lo que está en pantalla: pagar con tarjeta pide la referencia al instante), y el error del servidor debajo. Guardar manda sólo lo que cambió con la versión leída: si alguien guardó antes, el servidor contesta 409 y no se pisa nada. Un **borrador** guardado vuelve con el registro. **Actuar**: confirmar corre al clic; anular, que no se deshace, primero pregunta al servidor qué haría (dry run) y eso es la confirmación. **La historia**: los eventos de negocio de la factura, del contexto de ventas.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

type Servidor = ReturnType<typeof servidorVentas>;

function Factura({ number, servidor }: { number: string; servidor: Servidor }) {
  const factura = useRecord(facturas, number);
  const historia = useHistory(facturas, number, [factura.record]);
  const copy = frameworkCopy().record;

  if (factura.status === "loading") return <Skeleton rows={6} label="Cargando la factura" />;
  if (factura.status === "failed")
    return <Refused error={factura.error} onRetry={factura.reload} />;

  const { record, meta: model, edit } = factura;
  const estado = textOf(model, "state", record.state, "es") ?? record.state;
  const tone =
    record.state === "cancelled" ? "bad" : record.state === "draft" ? "neutral" : "good";
  const dirty = dirtyOf(factura);

  return (
    <Record
      identity={{
        title: record.number,
        subtitle: record.customer.name,
        tag: { label: estado, tone },
      }}
      {...(dirty === undefined ? {} : { dirty })}
      {...(edit.failure === null ? {} : { error: String((edit.failure as Error).message) })}
    >
      <Record.Rail>
        <Record.Actions>
          {record.state === "draft" ? (
            <CommandButton
              entity={facturas}
              command="confirmar"
              id={number}
              label="Confirmar"
              role="primary"
              onDone={factura.reload}
            />
          ) : null}
          {record.state === "cancelled" ? null : (
            <CommandButton
              entity={facturas}
              command="anular"
              id={number}
              label="Anular"
              destructive
              onDone={factura.reload}
            />
          )}
          <Button size="sm" role="ghost" onClick={() => servidor.alguienGuarda(number)}>
            Simular: otra persona guarda
          </Button>
        </Record.Actions>
      </Record.Rail>
      <Record.Paper layout="horizontal">
        <div className="flex max-w-xl flex-col gap-3 p-4">
          {edit.conflict ? (
            <Callout tone="warn" title={copy.conflict}>
              <Button size="sm" role="secondary" onClick={factura.reload}>
                {copy.reload}
              </Button>
            </Callout>
          ) : null}
          {edit.restored ? (
            <Callout tone="info" title={copy.restored}>
              {null}
            </Callout>
          ) : null}
          <RecordField record={factura} name="payment" />
          <RecordField record={factura} name="card_reference" />
          <RecordField record={factura} name="notes" />
          <RecordField record={factura} name="due_date" />
          {edit.advice.map((one) => (
            <Callout key={one.text} tone="info" title={one.text}>
              {null}
            </Callout>
          ))}
        </div>
      </Record.Paper>
      {historia === undefined ? null : <Record.Activity events={historia} />}
    </Record>
  );
}

function Escena({ number, preparar }: { number: string; preparar?: (s: Servidor) => void }) {
  const servidor = useMemo(() => {
    const s = servidorVentas();
    preparar?.(s);
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Escenario
      tables={servidor.tables}
      handle={servidor.handle}
      draft={servidor.draft}
      latency={120}
    >
      <Factura number={number} servidor={servidor} />
    </Escenario>
  );
}

/** A draft invoice (i = 6: draft, cash) and a posted one (i = 1). */
const BORRADOR = "F-2026-0007";
const PUBLICADA = "F-2026-0002";

export const EditarYGuardar: Story = {
  render: () => <Escena number={BORRADOR} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nota = await canvas.findByRole("textbox", { name: "Nota" });
    await userEvent.type(nota, "Entregar el lunes");
    await userEvent.click(await canvas.findByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(canvas.queryByRole("button", { name: "Guardar" })).toBeNull());
    await expect(await canvas.findByDisplayValue("Entregar el lunes")).toBeVisible();
  },
};

export const SiAlguienGuardoAntes: Story = {
  render: () => <Escena number={BORRADOR} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // While something is unsaved the record shows «Guardar / Descartar» in place of its
    // actions, so the other person saves first — the version this screen read is stale all
    // the same.
    await userEvent.click(await canvas.findByRole("button", { name: /otra persona guarda/ }));
    await userEvent.type(await canvas.findByRole("textbox", { name: "Nota" }), "Mi cambio");
    await userEvent.click(await canvas.findByRole("button", { name: "Guardar" }));
    await expect(await canvas.findByText(/Alguien guardó este registro/)).toBeVisible();
  },
};

export const UnBorradorQueVuelve: Story = {
  render: () => (
    <Escena
      number={BORRADOR}
      preparar={(s) => s.keepDraft(BORRADOR, { notes: "Llamar al cliente" })}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByDisplayValue("Llamar al cliente")).toBeVisible();
    await expect(await canvas.findByText(/Volvió un borrador/)).toBeVisible();
  },
};

export const ConfirmarYSuHistoria: Story = {
  render: () => <Escena number={BORRADOR} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Confirmar" }));
    await expect(await canvas.findByText("Publicada")).toBeVisible();
    await waitFor(() =>
      expect(canvas.getAllByText("Factura confirmada").length).toBeGreaterThan(0),
    );
  },
};

export const AnularDiceAntesQueHara: Story = {
  render: () => <Escena number={PUBLICADA} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(await canvas.findByRole("button", { name: "Anular" }));
    await expect(await page.findByText(/queda anulada: su total/)).toBeInTheDocument();
    await userEvent.click(await page.findByRole("button", { name: "Hacerlo" }));
    await expect(await canvas.findByText("Anulada")).toBeVisible();
  },
};
