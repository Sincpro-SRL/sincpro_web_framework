import { defineMeta, entity, field } from "@sincpro/client-framework";
import { entityView, RecordField, SincproApp, useRecord } from "@sincpro/web-framework";
import { FormSection, FormStyleProvider, Record } from "@sincpro/web-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { expect, within } from "storybook/test";

import { Escenario } from "./support/escenario";
import { cuotaMeta, cuotas, PAGO, pagoMeta, pagos, servidorPagos } from "./support/pagos";

const meta: Meta = {
  title: "Casos de uso/62 · Un formulario de ajustes",
  parameters: {
    docs: {
      description: {
        component:
          'Con el estilo **«ajustes»** de web-ui (`FormStyleProvider value="settings"`, una vez, alrededor de la aplicación) cada campo del registro es una fila que dice qué pide: la ayuda del modelo escrita bajo la etiqueta, **«(opcional)»** en un campo que puede quedar vacío —lo dice el modelo, no la pantalla—, y una elección **obligatoria de pocas opciones** se contesta con un solo toque, todas a la vista. Una elección que puede quedar vacía sigue siendo una lista: un control segmentado no se puede vaciar. Cada sección es una tarjeta en el índice de las secciones, y la principal del registro por defecto (`EntityRecord`) lleva nombre cuando hay otras.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

const accountMeta = defineMeta({
  aggregate: "Account",
  identity: "id",
  display: "user",
  fields: {
    id: field.text({ readonly: true }),
    kind: field.choice(["user", "group"], {
      label: { default: "Account type", es: "Tipo de cuenta" },
      labels: { user: "Usuario", group: "Grupo" },
      help: { default: "A group shares its mail.", es: "Una de grupo reparte su correo." },
      required: true,
    }),
    user: field.text({
      label: { default: "User", es: "Usuario" },
      help: { default: "Before the @.", es: "La parte del correo antes de la @." },
      required: true,
    }),
    name: field.text({ label: { default: "Full name", es: "Nombre completo" } }),
    locale: field.choice(["es", "en"], {
      label: { default: "Language", es: "Idioma" },
      labels: { es: "Español", en: "Inglés" },
    }),
  },
});

const accounts = entity("mail:account", { list: "/accounts", save: "PUT /accounts/{id}" });

const ACCOUNTS = [{ id: "a1", kind: "user", user: "info", name: "", locale: null }];

function Account() {
  const account = useRecord(accounts, "a1");
  if (account.record === null) return <p className="text-meta text-muted">…</p>;
  return (
    <Record identity={{ title: "info" }} placement="page">
      <Record.Paper layout="horizontal">
        <FormSection title="Cuenta">
          <RecordField record={account} name="kind" />
          <RecordField record={account} name="user" />
          <RecordField record={account} name="name" />
          <RecordField record={account} name="locale" />
        </FormSection>
      </Record.Paper>
    </Record>
  );
}

export const CadaCampoDiceQuePide: Story = {
  render: () => (
    <FormStyleProvider value="settings">
      <Account />
    </FormStyleProvider>
  ),
  decorators: [
    (Story) => (
      <Escenario
        tables={{ "/accounts": { meta: accountMeta, rows: ACCOUNTS } }}
        entities={[accounts]}
      >
        <Story />
      </Escenario>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The model's help, written out under the label — and still what describes the control.
    const user = await canvas.findByRole("textbox", { name: /Usuario/ });
    await expect(user).toHaveAccessibleDescription("La parte del correo antes de la @.");
    await expect(canvas.getByText("La parte del correo antes de la @.")).toBeVisible();
    // Required by the model: no «(opcional)». The two that may stay empty say so.
    await expect(canvas.getAllByText("(opcional)")).toHaveLength(2);
    // A required choice of two: both in view, one press — not a list to open.
    await expect(canvas.getByRole("radio", { name: "Usuario" })).toBeChecked();
    await expect(canvas.getByRole("radio", { name: "Grupo" })).toBeVisible();
    // One that may stay empty is still a list: a segmented control cannot be emptied.
    await expect(canvas.queryByRole("radio", { name: "Español" })).toBeNull();
  },
};

function Pagos() {
  const transport = useMemo(servidorPagos, []);
  const views = useMemo(
    () => [
      entityView(pagos, { transport, name: "Pagos", meta: pagoMeta }),
      entityView(cuotas, { transport, name: "Cuotas", meta: cuotaMeta }),
    ],
    [transport],
  );
  return (
    <FormStyleProvider value="settings">
      <SincproApp
        transport={transport}
        views={views}
        start={pagos.ref(PAGO)}
        entities={[pagos, cuotas]}
        metas={{ [pagos.key]: pagoMeta, [cuotas.key]: cuotaMeta }}
        currency="BOB"
      />
    </FormStyleProvider>
  );
}

export const CadaSeccionEnElIndice: Story = {
  render: () => <Pagos />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("heading", { name: "Cuota de noviembre" });
    // The payment's own fields and the receipt it holds are two cards, and the index lists
    // both — the main one by its name, which it had none of beside the receipt.
    const index = await canvas.findByRole("navigation", {
      name: "Secciones del formulario",
      hidden: true,
    });
    const links = within(index).getAllByRole("link", { hidden: true });
    await expect(links[0]).toHaveTextContent("Datos generales");
    await expect(links).toHaveLength(2);
  },
};
