import { EntityList, useListing } from "@sincpro/web-framework";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { expect, waitFor, within } from "storybook/test";

import { miembros, organos, servidorColegio } from "./support/colegio";
import { Escenario } from "./support/escenario";

const meta: Meta = {
  title: "Casos de uso/59 · Una relación con su nombre",
  parameters: {
    docs: {
      description: {
        component:
          "Una columna que guarda la clave de otro registro — `organo: EntityID[Organo]`, sin relación al lado — muestra **su nombre**, como lo muestra el picker del registro: «Consejo Técnico», no «CONSEJO_TECNICO». Las claves de toda la página se piden en **un solo pedido** por entidad (`useNameOf`, el libro de nombres del provider); hasta que contesta, y si la aplicación no declaró la entidad, la celda es la clave.",
      },
    },
  },
};
export default meta;
type Story = StoryObj;

function Miembros() {
  const listing = useListing(miembros);
  return (
    <EntityList listing={listing} search={false} columns={["nombre", "cargo", "organo"]} />
  );
}

export const LaCeldaDiceElNombre: Story = {
  render: function Render() {
    const servidor = useMemo(servidorColegio, []);
    return (
      <Escenario tables={servidor.tables} latency={40} entities={[organos, miembros]}>
        <Miembros />
      </Escenario>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("Ana Rojas");
    // The body each member belongs to, by its name — not its key.
    await expect(await canvas.findByText("Consejo Técnico")).toBeVisible();
    await expect(canvas.getByText("Directorio")).toBeVisible();
    await waitFor(() => expect(canvas.queryByText("CONSEJO_TECNICO")).toBeNull());
  },
};

export const SinLaEntidadQuedaLaClave: Story = {
  render: function Render() {
    const servidor = useMemo(servidorColegio, []);
    return (
      <Escenario tables={servidor.tables} latency={40} entities={[miembros]}>
        <Miembros />
      </Escenario>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("Ana Rojas");
    // Nobody declared what a body is: nothing to ask its name of, the key it is.
    await expect(canvas.getByText("CONSEJO_TECNICO")).toBeVisible();
  },
};
