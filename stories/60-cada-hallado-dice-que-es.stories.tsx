import { memoryTransport } from "@sincpro/client-framework";
import { Composer, useWorkspace } from "@sincpro/web-composer";
import { createRegistry } from "@sincpro/web-composer/domain";
import { entityView, FrameworkProvider, webUiSkin } from "@sincpro/web-framework";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useMemo } from "react";
import { expect, userEvent, within } from "storybook/test";

import { cuentas, inscripciones, servidorColegio } from "./support/colegio";

const meta: Meta = {
  title: "Casos de uso/60 · Cada hallado dice qué es",
  parameters: {
    docs: {
      description: {
        component:
          'En ⌘K, tres «María Fernanda Apaza Quispe» — la colegiada, su inscripción, su cuenta — sólo se distinguían por el ícono. Ahora cada hallado dice **qué es** (`noun`, del composer): el nombre del modelo que publica el servidor («Inscripción»), o el que la vista declara (`entityView(…, { noun: "Cuenta del personal" })`). Al lado va lo que lo distingue: el `option` de la entidad, o la descripción o el tipo de su resumen («Excel para contadores») — **nunca su clave**, que a una persona no le dice nada.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

function Espacio() {
  const transport = useMemo(() => {
    const servidor = servidorColegio();
    return memoryTransport(servidor.tables, { latency: 40 });
  }, []);
  const registry = useMemo(
    () =>
      createRegistry([
        entityView(inscripciones, { transport, name: "Inscripciones" }),
        entityView(cuentas, { transport, name: "Cuentas", noun: "Cuenta del personal" }),
      ]),
    [transport],
  );
  const workspace = useWorkspace();
  useEffect(() => {
    workspace.start(cuentas.ref());
  }, [workspace]);
  return (
    <FrameworkProvider transport={transport} locale="es">
      <div className="flex h-dvh min-h-0 flex-col bg-ground">
        <Composer workspace={workspace} registry={registry} skin={webUiSkin} />
      </div>
    </FrameworkProvider>
  );
}

export const DosMariasDistintas: Story = {
  render: () => <Espacio />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await canvas.findByText("Lucía Choque");
    await userEvent.keyboard("{Meta>}k{/Meta}");
    const palette = within(await page.findByRole("dialog"));
    await userEvent.type(palette.getByRole("combobox"), "María");
    // The enrollment: what the model is called, and its course — what tells it apart.
    await expect(
      await palette.findByRole("option", {
        name: /María Fernanda Apaza Quispe.*Inscripción · Excel para contadores/,
      }),
    ).toBeVisible();
    // The account: what its view calls one, and nothing beside it — never its key.
    const cuenta = await palette.findByRole("option", {
      name: /María Fernanda Apaza Quispe.*Cuenta del personal/,
    });
    await expect(cuenta).toBeVisible();
    await expect(cuenta).not.toHaveAccessibleName(/C-02/);
    await expect(palette.queryByRole("option", { name: /I-001/ })).toBeNull();
  },
};
