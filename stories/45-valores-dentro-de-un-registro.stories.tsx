import { defineMeta, entity, field } from "@sincpro/client-framework";
import { RecordField, useRecord } from "@sincpro/web-framework";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Escenario } from "./support/escenario";

const meta: Meta = {
  title: "Casos de uso/45 · Valores dentro de un registro",
  parameters: {
    docs: {
      description: {
        component:
          'Una **lista de valores dentro del registro** — los canales de un proyecto, los componentes de un inventario: `field.embedded(definición, { many: true })`, sin modelo propio ni id — se escribe igual que las líneas de una factura: `<RecordField name="channels" />` dibuja el editor de líneas de web-ui (agregar, editar en la celda, quitar con «Deshacer», reordenar), cada línea con su clave local, y la lista entera vuelve por el guardado del registro.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

/** A channel of a project: a value, no identity of its own. */
const channelMeta = defineMeta({
  aggregate: "Channel",
  identity: "",
  fields: {
    name: field.text({ label: { default: "Name", es: "Nombre" } }),
    url: field.text({ label: { default: "Address", es: "Dirección" } }),
  },
});

const projectMeta = defineMeta({
  aggregate: "Project",
  identity: "id",
  display: "title",
  fields: {
    id: field.text(),
    title: field.text({ label: { default: "Title", es: "Título" } }),
    channels: field.embedded(channelMeta, {
      many: true,
      label: { default: "Channels", es: "Canales" },
    }),
  },
});

const projects = entity("project:project", { list: "/projects" });

const PROJECTS = [
  {
    id: "p1",
    title: "Consola",
    channels: [
      { name: "#general", url: "https://chat.example.com/general" },
      { name: "#alertas", url: "https://chat.example.com/alertas" },
    ],
  },
];

function Project() {
  const project = useRecord(projects, "p1");
  if (project.record === null) return <p className="text-meta text-muted">…</p>;
  const channels = project.edit.values["channels"];
  return (
    // Wide enough for web-ui's table (640 px and up): narrower, the lines are cards.
    <div className="flex max-w-4xl flex-col gap-3 p-6">
      <RecordField record={project} name="channels" />
      <p className="text-meta text-muted">
        {`canales: ${Array.isArray(channels) ? channels.length : 0} · sin guardar: ${project.edit.dirty ? "sí" : "no"}`}
      </p>
    </div>
  );
}

export const UnaListaDeValoresSeEscribeComoLineas: Story = {
  render: () => <Project />,
  decorators: [
    (Story) => (
      <Escenario
        tables={{ "/projects": { meta: projectMeta, rows: PROJECTS } }}
        entities={[projects]}
      >
        <Story />
      </Escenario>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The values the record holds, as lines — not an empty field.
    await expect(await canvas.findByText("#general")).toBeVisible();
    await expect(canvas.getByText("canales: 2 · sin guardar: no")).toBeVisible();
    // A new value is a line written in the table — every field of a value fits a cell — and
    // the record holds it until it is saved.
    await userEvent.click(canvas.getByRole("button", { name: "Agregar una línea" }));
    const name = await canvas.findByRole("textbox", { name: "Nombre" });
    await waitFor(() => expect(name).toHaveFocus());
    await userEvent.type(name, "#ventas");
    await userEvent.keyboard("{Enter}");
    await expect((await canvas.findAllByRole("cell", { name: "#ventas" }))[0]).toBeVisible();
    await waitFor(() =>
      expect(canvas.getByText("canales: 3 · sin guardar: sí")).toBeVisible(),
    );
  },
};
