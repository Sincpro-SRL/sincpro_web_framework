import { memoryTransport } from "@sincpro/client-framework";
import type { ViewProps } from "@sincpro/web-composer";
import {
  EntityList,
  EntityPicker,
  EntityTags,
  entityView,
  SincproApp,
  useListing,
} from "@sincpro/web-framework";
import { Field } from "@sincpro/web-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { CONTACTOS_TABLAS, personaMeta, personas } from "./support/contactos";
import { servidorVentas } from "./support/servidor";
import { clienteMeta, clientes, facturaMeta, facturas } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/39 · Todo se abre en el workspace",
  parameters: {
    docs: {
      description: {
        component:
          "Dentro de una aplicación con composer, **un registro y un selector se abren siempre en el workspace** — también desde un `EntityPicker` o un `EntityTags` escritos a mano, como los de la consola de forge (`none`, `exclude`). El picker lee cómo abrir de la vista que lo contiene (`RecordOpening`, que `entityView` da a cada vista): el elegido abre donde lo pone el workspace (un modal que se mueve, «Abrir en…» para el resto) y «Buscar más…» es la lista de la entidad abierta para elegir, **con el recorte del picker**: lo que `criteria` deja afuera y lo que `exclude` excluye no se ofrece tampoco ahí (viaja en la referencia, `chooserRef(query, scope)`, y la lista —la de la aplicación también— lo aplica en el servidor). Antes, sin pasar `onBrowseAll` a mano, el picker abría un `Dialog` fijo de web-ui. El selector propio queda para un picker fuera de un workspace (historias 9 y 38) y para una línea que se está escribiendo.",
      },
    },
  },
};
export default meta;
type Story = StoryObj;

/** Clínica San Gabriel: already chosen elsewhere, so the picker never offers it. */
const EXCLUIDO = "C-002";
const GLOBEX = "C-004";

/** A screen written by hand, as forge writes its own: a picker and tags, no `onBrowseAll`. */
function Asignar() {
  const [cliente, setCliente] = useState(GLOBEX);
  const [seguidores, setSeguidores] = useState<string[]>(["U-0001"]);
  return (
    <div className="grid max-w-xl gap-3 p-4">
      <h1>Asignar</h1>
      <Field label="Cliente">
        <EntityPicker
          entity={clientes}
          value={cliente}
          onChange={setCliente}
          exclude={[EXCLUIDO]}
        />
      </Field>
      <p aria-label="Cliente elegido">{cliente}</p>
      <Field label="Seguidores">
        <EntityTags entity={personas} value={seguidores} onChange={setSeguidores} />
      </Field>
      <p aria-label="Seguidores elegidos">{seguidores.join(" ")}</p>
    </div>
  );
}

function Clientes({ api }: ViewProps) {
  return <EntityList listing={useListing(clientes)} api={api} />;
}

function App() {
  const transport = useMemo(() => {
    const servidor = servidorVentas();
    return memoryTransport(
      { ...servidor.tables, ...CONTACTOS_TABLAS },
      { latency: 40, handle: servidor.handle },
    );
  }, []);
  const views = useMemo(
    () => [
      entityView(facturas, { transport, name: "Facturas", record: Asignar }),
      entityView(clientes, { transport, name: "Clientes", list: Clientes }),
      entityView(personas, { transport, name: "Personas" }),
    ],
    [transport],
  );
  return (
    <div className="flex h-dvh min-h-0 flex-col bg-ground">
      <SincproApp
        transport={transport}
        views={views}
        entities={[facturas, clientes, personas]}
        start={facturas.ref("F-2026-0001")}
        metas={{
          [facturas.key]: facturaMeta,
          [clientes.key]: clienteMeta,
          [personas.key]: personaMeta,
        }}
      />
    </div>
  );
}

/** The composer's modal — not web-ui's `Dialog`, which a picker used to open by itself. */
async function modalDelWorkspace(canvasElement: HTMLElement, name: RegExp) {
  const modal = await within(canvasElement).findByRole("dialog", { name });
  await expect(modal).toHaveClass("sc-modal");
  return modal;
}

export const BuscarMasAbreLaListaEnElWorkspace: Story = {
  render: () => <App />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("heading", { name: "Asignar" });
    await waitFor(() =>
      expect(canvas.getByRole("combobox", { name: /Cliente/ })).toHaveValue("Globex Bolivia"),
    );
    await userEvent.click(canvas.getByRole("button", { name: "Buscar en todos" }));
    const modal = await modalDelWorkspace(canvasElement, /Clientes/);
    // The customers' own list — the application's — offers what the picker would: never the
    // one it excludes, though the list itself has it.
    await expect(await within(modal).findByText("Ferretería El Progreso")).toBeVisible();
    await expect(within(modal).queryByText("Clínica San Gabriel")).toBeNull();
    // A row answers the field, and the chooser closes.
    await userEvent.click(within(modal).getByText("Ferretería El Progreso"));
    await waitFor(() =>
      expect(canvas.getByLabelText("Cliente elegido")).toHaveTextContent("C-003"),
    );
    await waitFor(() => expect(canvas.queryByRole("dialog")).toBeNull());
  },
};

export const ElElegidoAbreEnElWorkspace: Story = {
  render: () => <App />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("heading", { name: "Asignar" });
    await waitFor(() =>
      expect(canvas.getByRole("combobox", { name: /Cliente/ })).toHaveValue("Globex Bolivia"),
    );
    // The chosen customer is a door, as in a field the model draws: a modal over this screen.
    await userEvent.click(canvas.getByRole("button", { name: "Abrir en un modal" }));
    const modal = await modalDelWorkspace(canvasElement, /Globex Bolivia/);
    await expect(modal).toBeVisible();
    await expect(canvas.getByRole("heading", { name: "Asignar" })).toBeInTheDocument();
  },
};

export const LasEtiquetasBuscanEnElWorkspace: Story = {
  render: () => <App />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await canvas.findByRole("heading", { name: "Asignar" });
    await userEvent.click(canvas.getByRole("combobox", { name: /Seguidores/ }));
    await userEvent.click(await page.findByRole("option", { name: /^Buscar más…/ }));
    const modal = await modalDelWorkspace(canvasElement, /Personas/);
    // The people already on are not offered again; the one clicked is added to them.
    await expect(await within(modal).findByText("Luis Pérez 2")).toBeVisible();
    await expect(within(modal).queryByText("Ana Rojas 1")).toBeNull();
    await userEvent.click(within(modal).getByText("Luis Pérez 2"));
    await waitFor(() =>
      expect(canvas.getByLabelText("Seguidores elegidos")).toHaveTextContent("U-0001 U-0002"),
    );
    await waitFor(() => expect(canvas.queryByRole("dialog")).toBeNull());
  },
};
