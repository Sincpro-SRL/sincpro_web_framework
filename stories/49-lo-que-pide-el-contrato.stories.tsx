import { defineMeta, entity, field } from "@sincpro/client-framework";
import { RecordField, useRecord } from "@sincpro/web-framework";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";

import { Escenario } from "./support/escenario";

const meta: Meta = {
  title: "Casos de uso/49 · Lo que pide el contrato",
  parameters: {
    docs: {
      description: {
        component:
          'El contrato dice **con qué se escribe cada campo** (`widget`): el de su tipo, o el que nombra `presentation(widgets=…)` en sincpro_framework. `<RecordField name="body" />` de un campo con `widget: "textarea"` es un texto de **varias líneas**, sin que la pantalla pase `as`. En la celda de una tabla de líneas sigue siendo de una línea: la fila no tiene más alto, y el diálogo sí.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

/** A news item of a portal: its title is one line, its body several — the contract says so. */
const noticiaMeta = defineMeta({
  aggregate: "Noticia",
  identity: "id",
  display: "title",
  fields: {
    id: field.text({ readonly: true }),
    title: field.text({ label: { default: "Title", es: "Título" } }),
    // `FieldOptions` has no `widget` yet (client-framework): the definition says it as the
    // server's does.
    body: { ...field.text({ label: { default: "Body", es: "Texto" } }), widget: "textarea" },
  },
});

// It can be stored (`save`): a record of an entity nothing can write is drawn read only.
const noticias = entity("portal:noticia", { list: "/noticias", save: "PUT /noticias/{id}" });

const NOTICIAS = [{ id: "n1", title: "Asamblea de diciembre", body: "" }];

function Noticia() {
  const noticia = useRecord(noticias, "n1");
  if (noticia.record === null) return <p className="text-meta text-muted">…</p>;
  return (
    <div className="flex max-w-xl flex-col gap-3 p-6">
      <RecordField record={noticia} name="title" />
      <RecordField record={noticia} name="body" />
    </div>
  );
}

export const UnTextoLargoSeEscribeEnVariasLineas: Story = {
  render: () => <Noticia />,
  decorators: [
    (Story) => (
      <Escenario tables={{ "/noticias": { meta: noticiaMeta, rows: NOTICIAS } }}>
        <Story />
      </Escenario>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const title = await canvas.findByRole("textbox", { name: "Título" });
    const body = canvas.getByRole("textbox", { name: "Texto" });
    // The title is the type's one-line input; the body, the widget the contract names.
    await expect(title.tagName).toBe("INPUT");
    await expect(body.tagName).toBe("TEXTAREA");
    await userEvent.type(body, "Orden del día:{Enter}1. Cuotas");
    await expect(body).toHaveValue("Orden del día:\n1. Cuotas");
  },
};
