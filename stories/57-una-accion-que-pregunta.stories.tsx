import { CommandButton, useRecord } from "@sincpro/web-framework";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { CUENTA, cuentas, servidorColegio } from "./support/colegio";
import { Escenario } from "./support/escenario";

const meta: Meta = {
  title: "Casos de uso/57 · Una acción que pregunta",
  parameters: {
    docs: {
      description: {
        component:
          'Una acción que necesita datos vive entre las acciones del registro como cualquier otra: `CommandButton … ask={["areas"]}` abre un diálogo con esos campos y los manda en el cuerpo del Command al **Confirmar**. Cada campo se lee como el campo del registro con ese nombre — su etiqueta, sus opciones con sus palabras, su control: «Áreas» son checks «Control de pagos», «Tienda», «Directorio» —, empieza con lo que el registro tiene (`record`) y la clave nunca se pregunta. Un campo que la entidad no tiene lo describe la acción (`{ name, label, widget }`; un control propio, con `as`). Un rechazo queda en el diálogo, sobre los campos, para corregirlos. Lo que muestra el diálogo es de la pantalla: el backend no agrega nada.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

function Cuenta() {
  const cuenta = useRecord(cuentas, CUENTA);
  const [hecho, setHecho] = useState<string | null>(null);
  if (cuenta.record === null) return <p className="text-meta text-muted">…</p>;
  const areas = cuenta.record["areas"];
  return (
    <div className="flex max-w-md flex-col gap-3 p-6">
      <p>{String(cuenta.record["nombre"])}</p>
      <p className="text-meta text-muted">
        áreas: {Array.isArray(areas) ? areas.join(", ") : ""}
      </p>
      <CommandButton
        entity={cuentas}
        command="delegar_areas"
        id={CUENTA}
        record={cuenta.record}
        label="Delegar áreas"
        ask={["id", "areas", { name: "motivo", label: "Motivo", widget: "textarea" }]}
        onDone={(answer) => setHecho(JSON.stringify(answer))}
      />
      {hecho === null ? null : <p className="text-meta text-muted">hecho: {hecho}</p>}
    </div>
  );
}

function Colegio({ children }: { children: React.ReactNode }) {
  const servidor = useMemo(servidorColegio, []);
  return (
    <Escenario
      tables={servidor.tables}
      handle={servidor.handle}
      latency={40}
      entities={[cuentas]}
    >
      {children}
    </Escenario>
  );
}

/** Opens the action's dialog: its fields are in the overlay layer, not the story's canvas. */
async function abrir(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await canvas.findByText("áreas: CONTROL_PAGOS");
  await userEvent.click(canvas.getByRole("button", { name: "Delegar áreas" }));
  const dialog = await within(canvasElement.ownerDocument.body).findByRole("dialog");
  await waitFor(() => expect(dialog).toBeVisible());
  return within(dialog);
}

export const PreguntaLasAreasYLasManda: Story = {
  render: () => (
    <Colegio>
      <Cuenta />
    </Colegio>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const dialog = await abrir(canvasElement);
    // The account's own field: its label, its choices in their words, what it has ticked.
    await expect(dialog.getByText("Áreas")).toBeVisible();
    await expect(dialog.getByRole("option", { name: "Control de pagos" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    // Its key is never asked, even when the screen names it.
    await expect(dialog.queryByText("ID")).toBeNull();
    await userEvent.click(dialog.getByRole("option", { name: "Tienda" }));
    // A field the entity does not have, as the action describes it.
    await userEvent.type(dialog.getByRole("textbox", { name: "Motivo" }), "Cubre la tienda");
    await userEvent.click(dialog.getByRole("button", { name: "Confirmar" }));
    // Sent in the Command's body; the account is read again by itself.
    await expect(await canvas.findByText("áreas: CONTROL_PAGOS, TIENDA")).toBeVisible();
    await expect(
      canvas.getByText(
        `hecho: ${JSON.stringify({ id: CUENTA, areas: ["CONTROL_PAGOS", "TIENDA"], motivo: "Cubre la tienda" })}`,
      ),
    ).toBeVisible();
  },
};

export const UnRechazoQuedaSobreLosCampos: Story = {
  render: () => (
    <Colegio>
      <Cuenta />
    </Colegio>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const dialog = await abrir(canvasElement);
    // Nothing ticked: the server refuses, and says why — in the dialog, over the fields.
    await userEvent.click(dialog.getByRole("option", { name: "Control de pagos" }));
    await userEvent.click(dialog.getByRole("button", { name: "Confirmar" }));
    await expect(
      await dialog.findByText(/Una cuenta del personal lleva al menos un área/),
    ).toBeVisible();
    await expect(dialog.getByRole("option", { name: "Tienda" })).toBeVisible();
    // Put right, it goes.
    await userEvent.click(dialog.getByRole("option", { name: "Directorio" }));
    await userEvent.click(dialog.getByRole("button", { name: "Confirmar" }));
    await expect(await canvas.findByText("áreas: DIRECTORIO")).toBeVisible();
  },
};
