import type { ResourceRef } from "@sincpro/web-composer";
import { entityView, SincproApp } from "@sincpro/web-framework";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { expect, waitFor, within } from "storybook/test";

import { cuotaMeta, cuotas, PAGO, pagoMeta, pagos, servidorPagos } from "./support/pagos";

const meta: Meta = {
  title: "Casos de uso/54 · Un registro que dice cada cosa una vez",
  parameters: {
    docs: {
      description: {
        component:
          'El registro por defecto (`EntityRecord`) de un **pago** — una entidad que sólo mueven sus comandos: sin `edit` ni `save` — se dibuja **entero de sólo lectura**: nada invita a escribir lo que nadie puede guardar. Dice cada cosa **una vez**: el concepto es su título y el estado su etiqueta, con el color que la aplicación declaró (`presented(pagos, { tones })`), y no vuelven como campos; quién y cuándo lo creó y lo cambió están en la auditoría y la actividad, nunca como campos. El **recibo** que el pago lleva adentro se dibuja desde su definición, campo por campo. Sus **cuotas** son la lista propia de su entidad, sin columnas técnicas (ID, creado, versión) y, siendo tres, sin barra para buscarlas. El **historial** muestra cada edición a la vista, campo por campo — «Concepto», lo que tenía tachado y lo que tiene ahora — y cada hecho con su color. En un **teléfono** el formulario es una columna. El estado se llama `estado`, no `state`: la entidad lo nombra (`entity(…, { summary: { state: "estado" } })`).',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

function App({ start }: { start: ResourceRef }) {
  const transport = useMemo(servidorPagos, []);
  const views = useMemo(
    () => [
      entityView(pagos, { transport, name: "Pagos", meta: pagoMeta }),
      entityView(cuotas, { transport, name: "Cuotas", meta: cuotaMeta }),
    ],
    [transport],
  );
  return (
    <SincproApp
      transport={transport}
      views={views}
      start={start}
      entities={[pagos, cuotas]}
      metas={{ [pagos.key]: pagoMeta, [cuotas.key]: cuotaMeta }}
      currency="BOB"
    />
  );
}

/** The payment's record, once read: its title is its concept. */
async function abierto(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await canvas.findByRole("heading", { name: "Cuota de noviembre" });
  await canvas.findByText("Colegiado", { selector: "label" });
  return canvas;
}

export const UnPagoSoloSeLee: Story = {
  render: () => <App start={pagos.ref(PAGO)} />,
  play: async ({ canvasElement }) => {
    const canvas = await abierto(canvasElement);
    // Nothing can store a payment: no field invites typing.
    await expect(canvas.queryAllByRole("textbox")).toHaveLength(0);
    await expect(canvas.queryByRole("button", { name: "Guardar" })).toBeNull();
    await expect(canvas.getByText("Ana Rojas")).toBeVisible();
    // Its state on top, in the colour the application gave it — and not again as a field; nor
    // its concept, which is its title.
    await expect(canvas.getByText("Validado")).toBeVisible();
    await expect(canvas.queryByText("Estado", { selector: "label" })).toBeNull();
    await expect(canvas.queryByText("Concepto", { selector: "label" })).toBeNull();
    // The framework's stamps are the audit's and the activity's, never fields.
    await expect(canvas.queryByText("Versión", { selector: "label" })).toBeNull();
    await expect(canvas.queryByText("Creado por", { selector: "label" })).toBeNull();
    // The receipt it embeds, field by field from its definition.
    await expect(canvas.getByText("N.º de recibo", { selector: "label" })).toBeVisible();
    await expect(canvas.getByText("0042")).toBeVisible();
    await expect(canvas.getByText("16/11/2026")).toBeVisible();
  },
};

export const SusCuotasSinColumnasTecnicas: Story = {
  render: () => <App start={pagos.ref(PAGO)} />,
  play: async ({ canvasElement }) => {
    const canvas = await abierto(canvasElement);
    await canvas.findByText("Septiembre");
    // The dues read as a part of the payment: what they are, not how they are kept.
    for (const header of ["Mes", "Monto (Bs.)", "Estado"])
      await expect(canvas.getByRole("columnheader", { name: header })).toBeVisible();
    for (const header of ["ID", "Creado", "Actualizado", "Versión", "Pago"])
      await expect(canvas.queryByRole("columnheader", { name: header })).toBeNull();
    // Three of them are read, not searched.
    await expect(canvas.queryByRole("combobox", { name: "Buscar" })).toBeNull();
  },
};

export const ElHistorialDiceQueCambio: Story = {
  render: () => <App start={pagos.ref(PAGO)} />,
  play: async ({ canvasElement }) => {
    const canvas = await abierto(canvasElement);
    // Each kind of fact in its colour; the approval is quipu's own fact.
    await canvas.findByText("Se aprobó el pago");
    // An edit, in sight without opening it: each field in the words it had then, as it WAS
    // (struck) and as it IS, each side as the record writes it.
    await canvas.findByText("Se actualizó");
    const cambio = async (campo: string) => {
      const fila = within(
        (await canvas.findByText(campo, { selector: "dt" })).parentElement!,
      );
      return [
        fila.getByRole("deletion").textContent,
        fila.getByRole("insertion").textContent,
      ];
    };
    const [antes, ahora] = await cambio("Concepto");
    await expect(antes).toMatch(/Cuota$/);
    await expect(ahora).toMatch(/Cuota de noviembre$/);
    // (`Intl` puts a no-break space before the currency: `\s`.)
    const [montoAntes, montoAhora] = await cambio("Monto (Bs.)");
    await expect(montoAntes).toMatch(/20,00\sBOB$/);
    await expect(montoAhora).toMatch(/25,00\sBOB$/);
    // Never one line to read, nor the envelope as JSON.
    await expect(canvas.queryByText(/Concepto: Cuota|field_labels|changes/)).toBeNull();
  },
};

export const EnElTelefonoUnaColumna: Story = {
  render: () => (
    <div className="w-96">
      <App start={pagos.ref(PAGO)} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = await abierto(canvasElement);
    // One field under the other, never two side by side at 384 px: every label of the form
    // starts at the same place.
    const lefts = () =>
      new Set(
        [...canvasElement.querySelectorAll("label")]
          .filter((label) => (label.textContent ?? "").trim() !== "")
          .map((label) => Math.round(label.getBoundingClientRect().left)),
      );
    await waitFor(() => expect(lefts().size).toBe(1));
    await expect(canvas.getByText("Enviado el", { selector: "label" })).toBeVisible();
  },
};
