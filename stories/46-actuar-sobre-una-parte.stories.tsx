import { defineMeta, field } from "@sincpro/client-framework";
import { RecordLines } from "@sincpro/web-framework";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { X } from "lucide-react";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

const meta: Meta = {
  title: "Casos de uso/46 · Actuar sobre una parte del registro",
  parameters: {
    docs: {
      description: {
        component:
          'Las **partes de un registro** — los miembros de un grupo, los tenants con los que se comparte un proyecto — no tienen ruta propia: se leen dentro del registro (`RecordLines`) y lo que las quita es un **comando del registro** (`useCommand(proyectos, "unshareProject")`). `rowActions` pone ese botón en la fila de cada parte; qué hace lo dice la pantalla.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

const shareMeta = defineMeta({
  aggregate: "Share",
  identity: "tenant_id",
  fields: {
    tenant_id: field.text({ label: { default: "Tenant", es: "Tenant" } }),
    name: field.text({ label: { default: "Name", es: "Nombre" } }),
  },
});

const projectMeta = defineMeta({
  aggregate: "Project",
  identity: "id",
  fields: {
    id: field.text(),
    shares: field.embedded(shareMeta, {
      many: true,
      label: { default: "Shared with", es: "Compartido con" },
    }),
  },
});

function Shares() {
  // What the record's Command would answer: the project without the share it removed.
  const [project, setProject] = useState({
    id: "p1",
    shares: [
      { tenant_id: "acme", name: "Acme Bolivia" },
      { tenant_id: "globex", name: "Globex" },
    ],
  });
  const [said, setSaid] = useState("");
  return (
    <div className="flex max-w-xl flex-col gap-3 p-6">
      <RecordLines
        record={project}
        meta={projectMeta}
        name="shares"
        locale="es"
        rowActions={(share) => [
          {
            id: "unshare",
            label: "Quitar",
            icon: X,
            tone: "danger",
            onSelect: () => {
              setProject((now) => ({
                ...now,
                shares: now.shares.filter((one) => one.tenant_id !== share["tenant_id"]),
              }));
              setSaid(`quitado: ${String(share["tenant_id"])}`);
            },
          },
        ]}
      />
      <p className="text-meta text-muted">{said}</p>
    </div>
  );
}

export const CadaParteSeQuitaDesdeSuFila: Story = {
  render: () => <Shares />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const row = (await canvas.findByText("Globex")).closest("tr")!;
    await userEvent.click(within(row).getByRole("button", { name: "Quitar" }));
    await expect(await canvas.findByText("quitado: globex")).toBeVisible();
    await waitFor(() => expect(canvas.queryByText("Globex")).toBeNull());
    await expect(canvas.getByText("Acme Bolivia")).toBeVisible();
  },
};
