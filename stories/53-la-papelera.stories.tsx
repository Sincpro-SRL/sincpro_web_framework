import { entity, field, memoryTransport, type Transport } from "@sincpro/client-framework";
import type { AnyRecord, Criteria, Meta as Model } from "@sincpro/criteria";
import { useWorkspace } from "@sincpro/web-composer";
import { entityView, listView, SincproApp, trashOf } from "@sincpro/web-framework";
import { Button } from "@sincpro/web-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { type Cliente, clienteMeta, CLIENTES } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/53 · La papelera",
  parameters: {
    docs: {
      description: {
        component:
          "Una entidad con la papelera de sincpro_framework (`ArchivableMixin`, `Archive`, `Restore`: `archive` y `restore` en la entidad, desde client-framework 2.0) tiene **«Mover a la papelera»** en su registro: el registro sale de toda lectura y no se pierde nada. `trashOf(entidad)` es su **«Papelera»** — la propia lista de la entidad bajo `archived_at` no nulo, que es como el servidor la lee — y cada fila ofrece **«Restaurar»**. Las dos cosas se pueden deshacer, así que corren al primer clic; sólo «Eliminar» pregunta antes.",
      },
    },
  },
};
export default meta;
type Story = StoryObj;

/** The customers, archivable: `archived_at` is set while a record is in the trash. */
const clienteArchivableMeta: Model = {
  ...clienteMeta,
  fields: {
    ...clienteMeta.fields,
    archived_at: field.datetime({
      label: "En la papelera desde",
      nullable: true,
      readonly: true,
    }),
  },
};

const clientes = entity<Cliente & { archived_at: string | null }>("ventas:cliente", {
  list: "/clientes",
  archive: "POST /clientes/{id}/archive",
  restore: "POST /clientes/{id}/restore",
});
const papelera = trashOf(clientes);

/** Whether a question names `archived_at` — the trash's reading does; every other leaves an
 *  archived record out, as sincpro_framework does. */
const namesArchived = (criteria: Criteria<AnyRecord>) =>
  JSON.stringify(criteria.selection ?? null).includes('"archived_at"');

/** The sales service of this story: archive and restore stamp and clear `archived_at`. */
function servidor(): Transport {
  const rows: AnyRecord[] = structuredClone(CLIENTES).map((one) => ({
    ...one,
    archived_at: null,
  }));
  const memory = memoryTransport(
    { "/clientes": { meta: clienteArchivableMeta, rows } },
    {
      latency: 40,
      handle: (method, route) => {
        const [, , id, action] = route.split("/");
        const row = rows.find((one) => one["id"] === decodeURIComponent(id ?? ""));
        if (method === "POST" && row !== undefined && action === "archive") {
          row["archived_at"] = new Date().toISOString();
          return null;
        }
        if (method === "POST" && row !== undefined && action === "restore") {
          row["archived_at"] = null;
          return null;
        }
        throw new Error(`Nada contesta ${method} ${route}.`);
      },
    },
  );
  return {
    ...memory,
    list: (route, criteria, signal, options) =>
      memory.list(
        route,
        namesArchived(criteria as Criteria<AnyRecord>)
          ? criteria
          : ({
              ...criteria,
              selection:
                criteria.selection === undefined
                  ? { field: "archived_at", operator: "is null", value: true }
                  : {
                      all: [
                        criteria.selection,
                        { field: "archived_at", operator: "is null", value: true },
                      ],
                    },
            } as typeof criteria),
        signal,
        options,
      ),
  };
}

function App() {
  const transport = useMemo(servidor, []);
  const workspace = useWorkspace();
  const views = useMemo(
    () => [
      entityView(clientes, { transport, name: "Clientes", meta: clienteArchivableMeta }),
      listView(papelera),
    ],
    [transport],
  );
  return (
    <div className="flex h-dvh min-h-0 flex-col bg-ground">
      <SincproApp
        transport={transport}
        views={views}
        start={clientes.ref()}
        metas={{ [clientes.key]: clienteArchivableMeta }}
        workspace={workspace}
        bar={
          <nav aria-label="Aplicación" className="flex gap-2 p-2">
            <Button size="sm" role="ghost" onClick={() => workspace.push(clientes.ref())}>
              Ver clientes
            </Button>
            <Button size="sm" role="ghost" onClick={() => workspace.push(papelera.ref())}>
              Ver la papelera
            </Button>
          </nav>
        }
      />
    </div>
  );
}

export const VaALaPapeleraYVuelve: Story = {
  render: () => <App />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText("Globex Bolivia"));
    await canvas.findByRole("heading", { name: "Globex Bolivia" });
    // It can be undone: it goes on the first click, and the record's surface closes.
    await userEvent.click(await canvas.findByRole("button", { name: "Mover a la papelera" }));
    await waitFor(() =>
      expect(canvas.queryByRole("heading", { name: "Globex Bolivia" })).toBeNull(),
    );
    await canvas.findByText("Importadora del Oriente");
    await waitFor(() => expect(canvas.queryByText("Globex Bolivia")).toBeNull());
    // In the trash, and only there: «Restaurar» on its row brings it back.
    await userEvent.click(canvas.getByRole("button", { name: "Ver la papelera" }));
    await canvas.findByRole("heading", { name: "Papelera" });
    const fila = (await canvas.findByText("Globex Bolivia")).closest("tr") as HTMLElement;
    await expect(within(fila).queryByText("Importadora del Oriente")).toBeNull();
    await userEvent.click(within(fila).getByRole("button", { name: "Restaurar" }));
    await waitFor(() => expect(canvas.queryByText("Globex Bolivia")).toBeNull());
    await userEvent.click(canvas.getByRole("button", { name: "Ver clientes" }));
    await expect(await canvas.findByText("Globex Bolivia")).toBeVisible();
  },
};
