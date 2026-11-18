import { defineList, EntityList, useListing } from "@sincpro/web-framework";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { inscripciones, servidorColegio } from "./support/colegio";
import { Escenario } from "./support/escenario";

const meta: Meta = {
  title: "Casos de uso/56 · Buscar por lo que se escribe",
  parameters: {
    docs: {
      description: {
        component:
          "Al escribir en la barra, ofrece **Buscar** y después **dónde** buscar el texto: los campos que la pantalla nombra (`defineList(entidad, { facets })` o `EntityList facets`), y sin eso los que nombra la plantilla de búsqueda de la entidad (`DEFAULT_LITERAL_SEARCH`, lo que un texto ya significa para ella), y si no tiene, su campo de nombre. **Nunca todos los campos de texto**: «Excel» en las inscripciones ofrecía dieciséis lugares, entre ellos «ID», la huella del comprobante y la clave donde se guarda el archivo. Los demás campos siguen a mano en el constructor de filtros.",
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const porCurso = defineList(inscripciones, {
  id: "por-curso",
  title: "Inscripciones",
  facets: ["nombres", "curso_titulo"],
});

function Inscripciones({ nombradas = false }: { nombradas?: boolean }) {
  const listing = useListing(nombradas ? porCurso : inscripciones);
  return <EntityList listing={listing} />;
}

function Colegio({ children }: { children: React.ReactNode }) {
  const { tables } = useMemo(servidorColegio, []);
  return (
    <Escenario tables={tables} latency={40}>
      {children}
    </Escenario>
  );
}

/** Types into the bar and answers the suggestions offered for it. */
async function escribir(canvasElement: HTMLElement, text: string) {
  const canvas = within(canvasElement);
  await canvas.findByText("María Fernanda Apaza Quispe");
  await userEvent.type(canvas.getByRole("combobox", { name: "Buscar" }), text);
  await canvas.findByRole("option", { name: /^Nombres\s*:/ });
  return canvas;
}

export const SoloDondeUnaPersonaBusca: Story = {
  render: () => (
    <Colegio>
      <Inscripciones />
    </Colegio>
  ),
  play: async ({ canvasElement }) => {
    const canvas = await escribir(canvasElement, "Excel");
    // What a typed text means for an enrollment: its names and its ID card.
    await expect(canvas.getByRole("option", { name: /^CI\s*:/ })).toBeVisible();
    // Never every text field: not its key, nor its receipt's fingerprint or storage key.
    for (const nunca of [/^ID\s*:/, /^Huella del comprobante/, /^Comprobante/, /^Tipo del/])
      await expect(canvas.queryByRole("option", { name: nunca })).toBeNull();
    // Nor a field the template does not name — that one is in the criteria builder.
    await expect(canvas.queryByRole("option", { name: /^Curso\s*:/ })).toBeNull();
  },
};

export const LaPantallaNombraDondeBuscar: Story = {
  render: () => (
    <Colegio>
      <Inscripciones nombradas />
    </Colegio>
  ),
  play: async ({ canvasElement }) => {
    const canvas = await escribir(canvasElement, "Excel");
    // The list names its own: names and course, in that order — and nothing else.
    await expect(canvas.getByRole("option", { name: /^Curso\s*:/ })).toBeVisible();
    await expect(canvas.queryByRole("option", { name: /^CI\s*:/ })).toBeNull();
    await userEvent.click(canvas.getByRole("option", { name: /^Curso\s*:/ }));
    await waitFor(() => expect(canvas.queryByText("Juan Pablo Mamani")).toBeNull());
    await expect(canvas.getByText("María Fernanda Apaza Quispe")).toBeVisible();
  },
};
