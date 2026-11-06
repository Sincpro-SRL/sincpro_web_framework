import { defineMeta, entity, field, RecordField, useRecord } from "@sincpro/web-framework";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Escenario } from "./support/escenario";

const meta: Meta = {
  title: "Casos de uso/41 · Una clave que dice de quién es",
  parameters: {
    docs: {
      description: {
        component:
          'En sincpro_framework una clave puede decir de quién es por su tipo: `tenant_id: EntityID[Tenant]`, publicado como `relation: "auth.Tenant"` en el contrato — sin un campo relación al lado. Para el formulario es un **many2one igual**: `<RecordField name="tenant_id" />` y nada más. Al leer muestra el **nombre** del tenant, pedido una sola vez por su clave (`useNameOf`), no el id; al escribir es el picker de tenants (búsqueda literal en el servidor), y lo elegido se guarda como **su clave**, nunca el registro. La entidad se encuentra por el nombre del modelo: `auth.Tenant` es `auth:tenant`, la clave con que se genera (`sincpro-web generate`).',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

const tenantMeta = defineMeta({
  aggregate: "Tenant",
  identity: "id",
  display: "display_name",
  search: ["display_name"],
  fields: {
    id: field.text({ label: { default: "Key", es: "Clave" } }),
    display_name: field.text({ label: { default: "Name", es: "Nombre" } }),
  },
});

/** An issue whose tenant is a key alone, as the framework publishes `EntityID[Tenant]`. */
const issueMeta = (writable: boolean) =>
  defineMeta({
    aggregate: "Issue",
    identity: "id",
    display: "title",
    fields: {
      id: field.text(),
      title: field.text({ label: { default: "Title", es: "Título" } }),
      tenant_id: {
        ...field.text({ label: { default: "Tenant", es: "Tenant" }, readonly: !writable }),
        relation: "auth.Tenant",
      },
    },
  });

const tenants = entity("auth:tenant", { list: "/tenants" });
const issues = entity("project:issue", { list: "/issues" });

const TENANTS = [
  { id: "acme", display_name: "Acme Bolivia" },
  { id: "globex", display_name: "Globex" },
];
const ISSUES = [{ id: "i1", title: "Falla el login", tenant_id: "acme" }];

function tablesFor(writable: boolean) {
  return {
    "/tenants": { meta: tenantMeta, rows: TENANTS },
    "/issues": { meta: issueMeta(writable), rows: ISSUES },
  };
}

function Issue() {
  const issue = useRecord(issues, "i1");
  if (issue.record === null) return <p className="text-meta text-muted">…</p>;
  return (
    <div className="flex max-w-md flex-col gap-3 p-6">
      <RecordField record={issue} name="tenant_id" />
      <p className="text-meta text-muted">
        tenant_id = {String(issue.edit.values["tenant_id"] ?? "")}
      </p>
    </div>
  );
}

export const AlLeerMuestraSuNombre: Story = {
  render: () => <Issue />,
  decorators: [
    (Story) => (
      <Escenario tables={tablesFor(false)} entities={[tenants, issues]}>
        <Story />
      </Escenario>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The tenant's name, asked once by its key — not the key itself.
    await expect(await canvas.findByText("Acme Bolivia")).toBeVisible();
    await expect(canvas.getByText("tenant_id = acme")).toBeVisible();
  },
};

export const AlEscribirSeEligeYSeGuardaSuClave: Story = {
  render: () => <Issue />,
  decorators: [
    (Story) => (
      <Escenario tables={tablesFor(true)} entities={[tenants, issues]}>
        <Story />
      </Escenario>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    // The picker of the entity the key names, showing the chosen one by its name.
    await expect(await canvas.findByDisplayValue("Acme Bolivia")).toBeVisible();
    await userEvent.click(canvas.getByRole("combobox", { name: /Tenant/ }));
    await userEvent.click(await page.findByRole("option", { name: /Globex/ }));
    // What is written is the key, never the record.
    await waitFor(() => expect(canvas.getByText("tenant_id = globex")).toBeVisible());
  },
};
