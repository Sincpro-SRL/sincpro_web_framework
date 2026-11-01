import {
  dirtyOf,
  EntityPicker,
  frameworkCopy,
  RecordField,
  type RecordReading,
  Refused,
  useRecord,
} from "@sincpro/web-framework";
import { Button, Callout, Record, Skeleton } from "@sincpro/web-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { EscenarioRest } from "./support/escenario";
import type { Call } from "./support/rest";
import { clientes, type Factura, facturas } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/12 · Un formulario armado con la meta, por HTTP",
  parameters: {
    docs: {
      description: {
        component:
          "Todo pasa por `restTransport` contra el protocolo REST de sincpro_framework (el servidor del otro lado es falso; el cable no). Cada campo es un **nombre**: su control sale del tipo — una opción, un número, una fecha, sí/no, una lista, un texto —, y `as` pone otro (acá el cliente, un many2one, con `EntityPicker`). Los **hints** se evalúan sobre lo que está en pantalla: con tarjeta aparece la referencia y guardar se bloquea hasta escribirla. El **preview** del servidor aconseja; un **422** se lee debajo del campo; un **borrador** se guarda en el servidor con su versión. Abajo, lo que viajó por el cable.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

/** A draft invoice, cash: everything editable. */
const NUMERO = "F-2026-0007";

function Cable({ calls }: { calls: readonly Call[] }) {
  return (
    <ol aria-label="Lo que viajó" className="px-4 pb-4 font-mono text-micro text-muted">
      {calls.map((call, i) => (
        <li key={i}>
          {call.method} {decodeURIComponent(call.url).slice(0, 90)}
        </li>
      ))}
    </ol>
  );
}

function Formulario({ factura }: { factura: RecordReading<Factura> }) {
  const copy = frameworkCopy().record;
  const { edit } = factura;
  const dirty = dirtyOf(factura);
  if (factura.status === "loading") return <Skeleton rows={6} label="Cargando la factura" />;
  if (factura.status === "failed")
    return <Refused error={factura.error} onRetry={factura.reload} />;
  return (
    <Record
      identity={{ title: factura.record.number, subtitle: factura.record.customer.name }}
      {...(dirty === undefined ? {} : { dirty })}
    >
      {/* `Record.Actions` always there: without them web-ui's `Record` remounts its paper when
          `dirty` first appears, and the field being typed in loses its focus after one letter
          (a web-ui bug, see docs/ROADMAP.md). */}
      <Record.Rail>
        <Record.Actions>
          <Button size="sm" role="ghost" onClick={factura.reload}>
            {copy.reload}
          </Button>
        </Record.Actions>
      </Record.Rail>
      <Record.Paper layout="horizontal">
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
          <RecordField record={factura} name="payment" />
          <RecordField record={factura} name="card_reference" />
          <RecordField record={factura} name="discount" />
          <RecordField record={factura} name="due_date" />
          <RecordField record={factura} name="tags" />
          <RecordField record={factura} name="notes" />
          <RecordField record={factura} name="urgent" />
          <RecordField record={factura} name="amount_total" />
        </div>
        {/* In the body and not the rail: while something is unsaved, web-ui's record shows
            «Guardar / Descartar» in place of its actions — and a draft is kept exactly then. */}
        {edit.keep === undefined || !edit.dirty ? null : (
          <div className="px-4 pt-4">
            <Button size="sm" role="secondary" onClick={() => void edit.keep?.()}>
              {copy.keep}
            </Button>
          </div>
        )}
        {edit.advice.map((one) => (
          <Callout key={one.text} tone="info" title={one.text}>
            {null}
          </Callout>
        ))}
        {edit.draft === null ? null : (
          <p className="px-4 text-meta text-muted">
            Borrador en el servidor · versión {edit.draft.version}
          </p>
        )}
      </Record.Paper>
    </Record>
  );
}

function Escena() {
  return (
    <EscenarioRest>
      {({ calls }) => (
        <>
          <Conectado />
          <Cable calls={calls} />
        </>
      )}
    </EscenarioRest>
  );
}

function Conectado() {
  const factura = useRecord(facturas, NUMERO);
  return <Formulario factura={factura} />;
}

export const CadaTipoConSuControl: Story = {
  render: () => <Escena />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("textbox", { name: "Nota" });
    await expect(canvas.getByRole("checkbox", { name: "Urgente" })).toBeInTheDocument();
    // A list of words is chips (`TagsField`), not a text area one word per line.
    await expect(canvas.getByRole("combobox", { name: "Etiquetas" })).toBeInTheDocument();
    await expect(canvas.getByText("Total")).toBeInTheDocument();
    // Read-only by the model: drawn as a value, not a control.
    await expect(canvas.queryByRole("textbox", { name: "Total" })).toBeNull();
    // Hidden by its hint: cash does not ask for a card reference.
    await expect(canvas.queryByText("Referencia de la tarjeta")).toBeNull();
    await userEvent.click(canvas.getByRole("checkbox", { name: "Urgente" }));
    await expect(await canvas.findByRole("button", { name: "Guardar" })).toBeVisible();
    await expect(canvas.getByLabelText("Lo que viajó")).toHaveTextContent(
      `GET /v1/facturas/${NUMERO}`,
    );
  },
};

export const ConTarjetaPideLaReferencia: Story = {
  render: () => <Escena />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    // The field also has a «Copiar «Forma de pago»» button: the select is the other one.
    await userEvent.click(
      await canvas.findByRole("button", { name: /^(?!Copiar).*Forma de pago/ }),
    );
    await userEvent.click(await page.findByRole("option", { name: "Tarjeta" }));
    const reference = await canvas.findByRole("textbox", {
      name: /Referencia de la tarjeta/,
    });
    await waitFor(() =>
      expect(canvas.getByRole("button", { name: "Guardar" })).toBeDisabled(),
    );
    await userEvent.type(reference, "VISA-4242");
    await waitFor(() =>
      expect(canvas.getByRole("button", { name: "Guardar" })).toBeEnabled(),
    );
  },
};

export const ElServidorRechazaUnCampo: Story = {
  render: () => <Escena />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const discount = await canvas.findByRole("textbox", { name: /Descuento/ });
    await userEvent.clear(discount);
    await userEvent.type(discount, "80");
    await userEvent.tab();
    await userEvent.click(await canvas.findByRole("button", { name: "Guardar" }));
    await expect(
      await canvas.findByText("El descuento no puede pasar del 50 %."),
    ).toBeVisible();
    await expect(canvas.getByLabelText("Lo que viajó")).toHaveTextContent(
      `PUT /v1/facturas/${NUMERO}`,
    );
  },
};

export const ElServidorAconseja: Story = {
  render: () => <Escena />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      await canvas.findByRole("textbox", { name: "Nota" }),
      "Entregar en el depósito del parque industrial, puerta 3, con la orden de compra impresa.",
    );
    await waitFor(
      () =>
        expect(canvas.getByLabelText("Lo que viajó")).toHaveTextContent(
          "POST /v1/facturas/preview",
        ),
      { timeout: 3000 },
    );
    await expect(
      await canvas.findByText(/La nota es larga/, {}, { timeout: 3000 }),
    ).toBeVisible();
  },
};

export const UnBorradorEnElServidor: Story = {
  render: () => <Escena />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      await canvas.findByRole("textbox", { name: "Nota" }),
      "Llamar antes",
    );
    await userEvent.click(canvas.getByRole("button", { name: "Guardar borrador" }));
    await expect(
      await canvas.findByText("Borrador en el servidor · versión 1"),
    ).toBeVisible();
    await expect(canvas.getByLabelText("Lo que viajó")).toHaveTextContent(
      `PUT /v1/facturas/${NUMERO}/draft`,
    );
  },
};

export const ElClienteEsUnMany2one: Story = {
  render: () => <Escena />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const picker = await canvas.findByRole("combobox", { name: /Cliente \(código\)/ });
    await userEvent.click(picker);
    await userEvent.click(await page.findByRole("option", { name: /Globex Bolivia/ }));
    await expect(await canvas.findByDisplayValue("Globex Bolivia")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Guardar" })).toBeVisible();
  },
};
