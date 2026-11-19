import { entity, memoryTransport } from "@sincpro/client-framework";
import { entityView, SincproApp } from "@sincpro/web-framework";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { servidorVentas } from "./support/servidor";
import { type Cliente, clienteMeta } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/52 · Eliminar un registro",
  parameters: {
    docs: {
      description: {
        component:
          'Una entidad que declara el `Delete` de sincpro_framework (`delete: "DELETE /clientes/{id}"`, generado del rol `delete` desde client-framework 1.12) tiene **«Eliminar»** en su registro sin escribir nada: `EntityRecord` lo da a su dock (`useRecordLifecycleActions`), aparte, en «Más acciones». Antes de borrar le **pregunta al servidor qué haría** (su `dry_run`) y muestra eso — «Se eliminará Globex Bolivia» —, no un «¿estás seguro?». Con «Hacerlo» el registro se va, la vista se cierra y la lista que lo mostraba vuelve a leer sola. Cada pedido lleva la versión que se leyó (`origin_version`): si alguien lo cambió, el servidor se niega.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

/** The customers, with sincpro_framework's generic `Delete`. */
const clientes = entity<Cliente>("ventas:cliente", {
  list: "/clientes",
  delete: "DELETE /clientes/{id}",
});

function App() {
  const transport = useMemo(() => {
    const servidor = servidorVentas();
    return memoryTransport(servidor.tables, { latency: 40, handle: servidor.handle });
  }, []);
  const views = useMemo(
    () => [entityView(clientes, { transport, name: "Clientes", meta: clienteMeta })],
    [transport],
  );
  return (
    <div className="flex h-dvh min-h-0 flex-col bg-ground">
      <SincproApp
        transport={transport}
        views={views}
        start={clientes.ref()}
        metas={{ [clientes.key]: clienteMeta }}
      />
    </div>
  );
}

export const SeEliminaDespuesDeVerLoQueHaria: Story = {
  render: () => <App />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(await canvas.findByText("Globex Bolivia"));
    await canvas.findByRole("heading", { name: "Globex Bolivia" });
    // What destroys is apart, in «Más acciones» — never beside what moves the record on.
    await userEvent.click(await canvas.findByRole("button", { name: "Más acciones" }));
    await userEvent.click(await page.findByRole("menuitem", { name: /Eliminar/ }));
    // The server's word on what would go — nothing touched yet.
    const ventana = await page.findByRole("dialog", { name: "Eliminar" });
    await waitFor(() =>
      expect(
        within(ventana).getByText("Se eliminará Globex Bolivia. Sus facturas no se tocan."),
      ).toBeVisible(),
    );
    await userEvent.click(within(ventana).getByRole("button", { name: "Hacerlo" }));
    // Gone: the record's page closed, and the list read again without it.
    await waitFor(() =>
      expect(canvas.queryByRole("heading", { name: "Globex Bolivia" })).toBeNull(),
    );
    await expect(await canvas.findByText("Importadora del Oriente")).toBeVisible();
    await waitFor(() => expect(canvas.queryByText("Globex Bolivia")).toBeNull());
  },
};
