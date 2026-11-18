import { CommandButton, ServiceButton, useRecord } from "@sincpro/web-framework";
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
          'Una acción que necesita datos vive entre las acciones del registro como cualquier otra: `CommandButton … ask={["areas"]}` abre un diálogo con esos campos y los manda en el cuerpo del Command al **Confirmar**. Cada campo se lee como el campo del registro con ese nombre — su etiqueta, sus opciones con sus palabras, su control: «Áreas» son checks «Control de pagos», «Tienda», «Directorio» —, empieza con lo que el registro tiene (`record`) y la clave nunca se pregunta. Un campo que la entidad no tiene lo describe la acción (`{ name, label, widget }`; un control propio, con `as`). Un rechazo queda en el diálogo, sobre los campos, para corregirlos. Lo que muestra el diálogo es de la pantalla: el backend no agrega nada.\n\nUn campo dado como objeto es **el campo de la entidad con lo que la acción dice encima**: `{ name: "rol", label, choices, initial: "miembro", hint }` empieza en «Miembro» cuando el registro no tiene nada ahí (lo que el registro tiene sigue ganando) y dice qué se espera; la ayuda que el backend escribió para un campo (`help`) también llega al diálogo. El **título** del diálogo es la etiqueta del botón sin sus «…» —el botón avisaba que se abría una ventana; la ventana ya está abierta—, y `dialog={{ title, subtitle }}` lo dice a su manera.',
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

/** An action of the application that asks for a role: where it starts, what each field is for. */
function Invitar() {
  const cuenta = useRecord(cuentas, CUENTA);
  const [hecho, setHecho] = useState<string | null>(null);
  if (cuenta.record === null) return <p className="text-meta text-muted">…</p>;
  return (
    <div className="flex max-w-md flex-col gap-3 p-6">
      <p>{String(cuenta.record["nombre"])}</p>
      <ServiceButton
        label="Invitar al panel…"
        entity={cuentas}
        record={cuenta.record}
        dialog={{ subtitle: "Le llega un correo con el enlace." }}
        ask={[
          // The account already has its areas: what the record holds wins over `initial`.
          { name: "areas", initial: ["TIENDA"] },
          {
            name: "rol",
            label: "Rol",
            choices: [
              { value: "miembro", label: "Miembro" },
              { value: "admin", label: "Administrador" },
            ],
            initial: "miembro",
            hint: "Lo que podrá hacer en el panel.",
          },
        ]}
        run={async (asked) => asked}
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

export const EmpiezaDondeLaAccionDiceYExplicaCadaCampo: Story = {
  render: () => (
    <Colegio>
      <Invitar />
    </Colegio>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("Lucía Choque");
    await userEvent.click(canvas.getByRole("button", { name: "Invitar al panel…" }));
    // Titled once, without the «…» that said a window would open; the screen's sentence under it.
    const ventana = await within(canvasElement.ownerDocument.body).findByRole("dialog", {
      name: "Invitar al panel",
    });
    await waitFor(() => expect(ventana).toBeVisible());
    await expect(ventana).toHaveAccessibleDescription("Le llega un correo con el enlace.");
    const dialog = within(ventana);
    // The backend's help for its own field, under the checks that name themselves.
    await expect(dialog.getByText("Lo que la cuenta ve en el panel.")).toBeVisible();
    // The action's hint for the field it described, on the field's label.
    await expect(
      dialog.getByRole("button", { name: "Lo que podrá hacer en el panel." }),
    ).toBeVisible();
    // What the record holds wins over `initial`: the account's own area, not «Tienda».
    await expect(dialog.getByRole("option", { name: "Control de pagos" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(dialog.getByRole("option", { name: "Tienda" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    // Untouched, the role goes as it started: «Miembro».
    await userEvent.click(dialog.getByRole("button", { name: "Confirmar" }));
    await expect(
      await canvas.findByText(
        `hecho: ${JSON.stringify({ areas: ["CONTROL_PAGOS"], rol: "miembro" })}`,
      ),
    ).toBeVisible();
  },
};
