import { memoryTransport } from "@sincpro/client-framework";
import { EntityTags, entityView, SincproApp } from "@sincpro/web-framework";
import { Field } from "@sincpro/web-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { CONTACTOS_TABLAS, personaMeta, personas } from "./support/contactos";
import { servidorVentas } from "./support/servidor";
import { facturaMeta, facturas } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/65 · Elegir varios para una relación",
  parameters: {
    docs: {
      description: {
        component:
          "Los destinatarios de un correo son un **many2many**: se llenaban de a uno. Ahora «Buscar más…» abre la lista de la entidad **para elegir varios** (`RecordOpening.chooseMany`, la pregunta `CHOOSE_MANY` del composer): una fila se marca en vez de contestar, y «Agregar (N)» contesta lo elegido — una `Selection` de client-framework —, que el campo convierte en claves (`keysOf`) y agrega. Con lo escrito como búsqueda, «Elegir los 71 que coinciden» trae a todos los Mamani sin marcarlos uno por uno, hasta `BATCH_LIMIT` (200); más que eso no agrega nada y lo avisa.",
      },
    },
  },
};
export default meta;
type Story = StoryObj;

/** A mail's recipients, written by hand: one person on, the rest to be chosen. */
function Correo() {
  const [para, setPara] = useState<string[]>(["U-0001"]);
  return (
    <div className="grid max-w-xl gap-3 p-4">
      <h1>Correo</h1>
      <Field label="Para">
        <EntityTags entity={personas} value={para} onChange={setPara} />
      </Field>
      <p aria-label="Destinatarios">{para.join(" ")}</p>
    </div>
  );
}

function App() {
  const transport = useMemo(() => {
    const servidor = servidorVentas();
    return memoryTransport(
      { ...servidor.tables, ...CONTACTOS_TABLAS },
      { latency: 20, handle: servidor.handle },
    );
  }, []);
  const views = useMemo(
    () => [
      entityView(facturas, { transport, name: "Facturas", record: Correo }),
      entityView(personas, { transport, name: "Personas" }),
    ],
    [transport],
  );
  return (
    <div className="flex h-dvh min-h-0 flex-col bg-ground">
      <SincproApp
        transport={transport}
        views={views}
        entities={[facturas, personas]}
        start={facturas.ref("F-2026-0001")}
        metas={{ [facturas.key]: facturaMeta, [personas.key]: personaMeta }}
      />
    </div>
  );
}

/** «Buscar más…» from the field, on what was typed: the chooser of several, in a modal. */
async function buscarMas(canvasElement: HTMLElement, escrito: string) {
  const canvas = within(canvasElement);
  const page = within(canvasElement.ownerDocument.body);
  await canvas.findByRole("heading", { name: "Correo" });
  await userEvent.type(canvas.getByRole("combobox", { name: /Para/ }), escrito);
  await userEvent.click(await page.findByRole("option", { name: /^Buscar más…/ }));
  return within(await canvas.findByRole("dialog", { name: /Personas/ }));
}

const destinatarios = (canvasElement: HTMLElement) =>
  (within(canvasElement).getByLabelText("Destinatarios").textContent ?? "").split(" ");

export const MarcarVariosYAgregar: Story = {
  render: () => <App />,
  play: async ({ canvasElement }) => {
    const elegir = await buscarMas(canvasElement, "Jorge Mamani");
    // A row press ticks — it does not answer — so several are chosen before anything is added.
    await userEvent.click(await elegir.findByText("Jorge Mamani 4"));
    await userEvent.click(elegir.getByText("Jorge Mamani 60"));
    await userEvent.click(await elegir.findByRole("button", { name: "Agregar (2)" }));
    await waitFor(() =>
      expect(destinatarios(canvasElement)).toEqual(["U-0001", "U-0004", "U-0060"]),
    );
    await waitFor(() => expect(within(canvasElement).queryByRole("dialog")).toBeNull());
  },
};

export const TodosLosQueCoinciden: Story = {
  render: () => <App />,
  play: async ({ canvasElement }) => {
    const elegir = await buscarMas(canvasElement, "Mamani");
    // The page ticked whole offers the whole search, as the server counted it: 71 Mamani.
    await userEvent.click((await elegir.findAllByRole("checkbox"))[0]!);
    await userEvent.click(
      await elegir.findByRole("button", { name: /Elegir los 71 que coinciden/ }),
    );
    await userEvent.click(await elegir.findByRole("button", { name: "Agregar (71)" }));
    // Their keys, read once — never ticked one by one —, after the one already there.
    await waitFor(() => expect(destinatarios(canvasElement)).toHaveLength(72));
    await expect(destinatarios(canvasElement)[0]).toBe("U-0001");
  },
};
