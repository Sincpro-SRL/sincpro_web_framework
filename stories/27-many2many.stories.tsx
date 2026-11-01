import { EntityTags } from "@sincpro/web-framework";
import { Field } from "@sincpro/web-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { CONTACTOS_TABLAS, PERSONAS, personas } from "./support/contactos";
import { Escenario } from "./support/escenario";

const meta: Meta = {
  title: "Casos de uso/27 · Varios registros (many2many)",
  parameters: {
    docs: {
      description: {
        component:
          "`EntityTags` pone **varios** registros de una entidad en éste —los seguidores de una factura, los productos de una promoción— como fichas. Es la misma búsqueda literal que un many2one, para N: abre con los **primeros 10** en el orden de la entidad, lo que se escribe lo busca el **servidor** (acá, por un correo que ninguna ficha muestra), los elegidos **no vuelven** como opción, y conservan su nombre estén donde estén — un seguidor guardado que no está entre los diez se nombra con **una** pregunta por su clave. Una persona se elige por su **cara** (`summary: { person: true }`): la foto o sus iniciales.",
      },
    },
  },
  decorators: [
    (Story) => (
      <Escenario tables={CONTACTOS_TABLAS} latency={60}>
        <Story />
      </Escenario>
    ),
  ],
};
export default meta;
type Story = StoryObj;

const GUARDADO = PERSONAS[299]!;
const LEJOS = PERSONAS[449]!;

export const SeguidoresDeUnaFactura: Story = {
  render: function Render() {
    // A saved follower that is not among the first ten.
    const [seguidores, setSeguidores] = useState<string[]>([GUARDADO.id]);
    return (
      <div className="max-w-xl p-6">
        <Field label="Seguidores">
          <EntityTags entity={personas} value={seguidores} onChange={setSeguidores} />
        </Field>
        <p className="mt-2 font-mono text-micro text-muted">valor: {seguidores.join(", ")}</p>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    // Named though it was never among the ten: asked once by its key.
    await expect(await canvas.findByText(GUARDADO.name)).toBeVisible();
    const campo = await canvas.findByRole("combobox", { name: "Seguidores" });
    await userEvent.click(campo);
    // The first ten, by their faces: the first has a photo.
    await waitFor(() => expect(page.getAllByRole("option")).toHaveLength(10));
    await expect(page.getAllByRole("option")[0]?.querySelector("img")).not.toBeNull();
    // An e-mail no chip shows: only the server's literal search finds it.
    await userEvent.type(campo, LEJOS.email);
    await userEvent.click(await page.findByRole("option", { name: new RegExp(LEJOS.name) }));
    await expect(
      await canvas.findByText(`valor: ${GUARDADO.id}, ${LEJOS.id}`),
    ).toBeInTheDocument();
    // Chosen, never offered again.
    await userEvent.type(campo, LEJOS.email);
    await waitFor(() =>
      expect(page.queryByRole("option", { name: new RegExp(LEJOS.name) })).toBeNull(),
    );
  },
};
