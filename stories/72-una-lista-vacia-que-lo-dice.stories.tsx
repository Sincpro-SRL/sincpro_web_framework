import { EntityList, useListing } from "@sincpro/web-framework";
import { Button } from "@sincpro/web-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ReceiptText } from "lucide-react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Escenario } from "./support/escenario";
import { clienteMeta, facturaMeta, facturas, VENTAS } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/72 · Una lista vacía que lo dice",
  parameters: {
    docs: {
      description: {
        component:
          "Una lista que **es** la pantalla y todavía no tiene nada lo dice como pantalla (web-ui 2.14, `Empty`): un **título**, un **ícono** o la ilustración de la aplicación, y lo que se puede hacer — `EntityList empty={{ title, icon, sentence, action }}`. Lo que no se da son las palabras del framework, y si lo vació una búsqueda dice **otra cosa** (`whenFiltered`): a quien escribió mal un nombre no se le pide que cree su primera factura. Un texto solo sigue siendo la frase tranquila de siempre.",
      },
    },
  },
};
export default meta;
type Story = StoryObj;

/** A business with customers and not one invoice yet. */
const SIN_FACTURAS = {
  "/clientes": VENTAS["/clientes"],
  "/facturas": { meta: facturaMeta, rows: [] },
};

function Facturas() {
  const listing = useListing(facturas);
  return (
    <EntityList
      listing={listing}
      empty={{
        title: "Todavía no hay facturas",
        icon: ReceiptText,
        sentence: "Cuando emitas la primera, va a aparecer acá.",
        action: <Button role="primary">Emitir factura</Button>,
      }}
    />
  );
}

export const LaPrimeraVez: Story = {
  render: () => (
    <Escenario tables={SIN_FACTURAS} latency={40} metas={{ "/clientes": clienteMeta }}>
      <Facturas />
    </Escenario>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The screen's own empty: its title, its sentence and what to do.
    await expect(await canvas.findByText("Todavía no hay facturas")).toBeVisible();
    await expect(
      canvas.getByText("Cuando emitas la primera, va a aparecer acá."),
    ).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Emitir factura" })).toBeVisible();
  },
};

export const VaciaPorUnaBusqueda: Story = {
  render: () => (
    <Escenario tables={SIN_FACTURAS} latency={40} metas={{ "/clientes": clienteMeta }}>
      <Facturas />
    </Escenario>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("Todavía no hay facturas");
    await userEvent.type(canvas.getByRole("combobox", { name: "Buscar" }), "pagada");
    await userEvent.click(
      await within(await canvas.findByRole("listbox", { name: "Sugerencias" })).findByRole(
        "option",
        { name: /Estado.*Pagada/ },
      ),
    );
    // Emptied by a search: the framework's words for it, never «create your first one».
    await expect(await canvas.findByText("Nada coincide.")).toBeVisible();
    await waitFor(() => expect(canvas.queryByText("Todavía no hay facturas")).toBeNull());
  },
};
