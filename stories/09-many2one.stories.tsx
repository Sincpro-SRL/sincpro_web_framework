import { EntityPicker, lookupOf } from "@sincpro/web-framework";
import { Field } from "@sincpro/web-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, within } from "storybook/test";

import { Escenario } from "./support/escenario";
import { clienteMeta, CLIENTES, clientes, VENTAS } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/09 · Elegir un registro: el many2one",
  parameters: {
    docs: {
      description: {
        component:
          "`EntityPicker` es el many2one: el `Picker` de web-ui alimentado por `useLookup` — cada registro como una opción con su `display` y su clave al lado, de a una página. «Abrir» y «buscar en todo» son del composer (`api.open`, `api.pick`) y los pasa la pantalla.\n\n**Hueco conocido**: el `Picker` de web-ui filtra lo que ya tiene y no sabe pedir más por texto, así que lo tipeado acota la página cargada; con miles de registros, «buscar en todo» abre la lista entera. Un `Picker` que busque en el servidor es de web-ui.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

const GLOBEX = lookupOf(clienteMeta, CLIENTES).find((one) => one.label === "Globex Bolivia")!;

export const ElClienteDeUnaFactura: Story = {
  render: function Render() {
    const [cliente, setCliente] = useState(GLOBEX.id);
    return (
      <div className="max-w-md p-6">
        <Field label="Cliente">
          <EntityPicker entity={clientes} value={cliente} onChange={setCliente} />
        </Field>
      </div>
    );
  },
  decorators: [
    (Story) => (
      <Escenario tables={VENTAS}>
        <Story />
      </Escenario>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The chosen record reads in the field itself — an input's value, not a text node.
    await expect(await canvas.findByDisplayValue("Globex Bolivia")).toBeVisible();
  },
};
