import { labelOf } from "@sincpro/criteria";
import {
  countOf,
  EntityList,
  factsOf,
  RecordLines,
  Refused,
  textOf,
  useListing,
  useRecord,
} from "@sincpro/web-framework";
import { Record, Skeleton } from "@sincpro/web-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";

import { Escenario } from "./support/escenario";
import { type Factura, FACTURA_GRANDE, facturas, VENTAS } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/03 · Un registro que se arma con la meta",
  parameters: {
    docs: {
      description: {
        component:
          "La factura llega con la definición de su modelo, y de ahí sale todo: el rótulo de cada dato, cómo se lee cada valor y las líneas del one2many con sus propias columnas. El framework manda un one2many **como una página** (`{items, count, cursor}`): esta factura tiene 120 líneas y trae 20, y la pantalla lo dice — la pestaña cuenta 120, no 20. La pantalla sigue escribiendo el árbol de `Record`; lo que sale de la meta son sus props.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

const DATOS = ["customer", "invoice_date", "due_date", "tags", "created_at"];

function FacturaRecord({ number, onBack }: { number: string; onBack?: () => void }) {
  const factura = useRecord(facturas, number);
  const [page, setPage] = useState("lines");

  if (factura.status === "loading") return <Skeleton rows={6} label="Cargando la factura" />;
  if (factura.status === "failed")
    return <Refused error={factura.error} onRetry={factura.reload} />;

  const { record, meta: model, locale } = factura;
  return (
    <Record
      identity={{
        title: record.number,
        subtitle: textOf(model, "customer", record.customer, locale),
        tag: { label: textOf(model, "state", record.state, locale) ?? record.state },
        figure: {
          label: labelOf(model, "amount_total", locale),
          value: textOf(model, "amount_total", record.amount_total, locale) ?? "",
        },
      }}
    >
      <Record.Rail>
        {onBack === undefined ? null : (
          <Record.Crumbs
            crumbs={[{ label: "Facturas", onClick: onBack }, { label: record.number }]}
          />
        )}
      </Record.Rail>
      <Record.Paper layout="horizontal">
        <Record.Facts fields={factsOf<Factura>(record, model, DATOS, { locale })} />
        <Record.Pages current={page} onChange={setPage}>
          <Record.Page
            id="lines"
            label={labelOf(model, "lines", locale)}
            count={countOf(record, "lines")}
          >
            <RecordLines record={record} meta={model} name="lines" locale={locale} />
          </Record.Page>
        </Record.Pages>
      </Record.Paper>
    </Record>
  );
}

export const UnaFacturaConMuchasLineas: Story = {
  render: () => (
    <Escenario tables={VENTAS}>
      <FacturaRecord number={FACTURA_GRANDE} />
    </Escenario>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Se muestran 20 de 120.")).toBeVisible();
    await expect(await canvas.findByRole("tab", { name: /120/ })).toBeVisible();
    await expect(await canvas.findByRole("columnheader", { name: /Producto/ })).toBeVisible();
  },
};

function DeLaListaAlRegistro() {
  const listing = useListing(facturas, { paging: "more", pageSize: 20 });
  const [open, setOpen] = useState<string | null>(null);
  if (open !== null) return <FacturaRecord number={open} onBack={() => setOpen(null)} />;
  return (
    <EntityList
      listing={listing}
      columns={["number", "customer", "state", "amount_total"]}
      onOpen={(row) => setOpen(row.number)}
    />
  );
}

export const DeLaListaAlRegistroYVolver: Story = {
  render: () => (
    <Escenario tables={VENTAS}>
      <DeLaListaAlRegistro />
    </Escenario>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The list comes in the entity's own order (newest first): open whatever is on top.
    const [first] = await canvas.findAllByText(/^F-2026-\d{4}$/);
    const number = first?.textContent ?? "";
    await userEvent.click(first!);
    await expect(await canvas.findByRole("heading", { name: number })).toBeVisible();
    await userEvent.click(await canvas.findByText("Facturas"));
    await expect(await canvas.findByText("20 de 64")).toBeVisible();
  },
};
