import { entity } from "@sincpro/client-framework";
import type { Criteria } from "@sincpro/criteria";
import { CommandButton, EntityPicker, lookupOf } from "@sincpro/web-framework";
import { Field } from "@sincpro/web-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Escenario } from "./support/escenario";
import { clienteMeta, CLIENTES, clientes, VENTAS } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/38 · Lo que forge todavía hacía a mano",
  parameters: {
    docs: {
      description: {
        component:
          'Lo que la consola de forge seguía escribiendo a mano al migrar (los huecos 1, 2 y 11 del ROADMAP). **Un campo que puede quedar vacío** lo ofrece como elección (`EntityPicker none`): «Ninguno» o la palabra de la pantalla («Sin tenant»), que contesta `""`. **Los ya elegidos no se ofrecen** (`exclude`): compartir un proyecto no ofrece los tenants que ya lo tienen, y los deja afuera el SERVIDOR (`not in`). **Un Command con dos claves en la ruta** (`POST /projects/{id}/shares/{tenant_id}/revoke`) toma la segunda del cuerpo, como la lee sincpro_framework. Y **un botón que todavía no aplica** se apaga (`CommandButton disabled`): compartir sin destino elegido.\n\nAcá los pickers están **fuera de un workspace**, así que «Buscar más…» es su selector propio. Dentro de una aplicación con composer —como la consola de forge— el mismo picker abre en el workspace y su selector lleva el `exclude`: historia 39.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

const opciones = lookupOf(clienteMeta, CLIENTES);
const GLOBEX = opciones.find((one) => one.label === "Globex Bolivia")!;
const PRIMERO = opciones[0]!;

export const ElegirNinguno: Story = {
  render: function Render() {
    const [cliente, setCliente] = useState(GLOBEX.id);
    return (
      <div className="flex max-w-md flex-col gap-3 p-6">
        <Field label="Cliente">
          <EntityPicker
            entity={clientes}
            value={cliente}
            onChange={setCliente}
            none="Sin cliente"
          />
        </Field>
        <p className="text-meta text-muted">{cliente === "" ? "vacío" : cliente}</p>
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
    const page = within(canvasElement.ownerDocument.body);
    await canvas.findByDisplayValue("Globex Bolivia");
    await userEvent.click(canvas.getByRole("combobox", { name: /Cliente/ }));
    // The choice of nothing comes first, in the screen's own word.
    const options = await page.findAllByRole("option");
    await expect(options[0]?.textContent).toContain("Sin cliente");
    await userEvent.click(options[0]!);
    await expect(await canvas.findByText("vacío")).toBeVisible();
    await expect(await canvas.findByDisplayValue("Sin cliente")).toBeVisible();
  },
};

/** Every list request that reached the server, as it arrived. */
const pedidos: { route: string; criteria: Criteria }[] = [];
const observar = (route: string, criteria: Criteria) => {
  pedidos.push({ route, criteria });
};

/** The customers a record is already shared with: never offered again. */
const YA_COMPARTIDO = [GLOBEX.id, PRIMERO.id];

/** A Command whose route names two keys: the record's, and the one it is shared with. */
const compartibles = entity("ventas:cliente", {
  list: "/clientes",
  commands: { compartir: "POST /clientes/{id}/compartir/{destino_id}" },
});

const recibidas: string[] = [];
const servidor = (method: string, route: string) => {
  recibidas.push(`${method} ${route}`);
  return { ok: true };
};

const ORIGEN = opciones[2]!;

export const CompartirConQuienFalta: Story = {
  render: function Render() {
    const [destino, setDestino] = useState("");
    const [hecho, setHecho] = useState(false);
    return (
      <div className="flex max-w-md flex-col gap-3 p-6">
        <Field label="Compartir con">
          <EntityPicker
            entity={clientes}
            value={destino}
            onChange={setDestino}
            exclude={YA_COMPARTIDO}
          />
        </Field>
        <CommandButton
          entity={compartibles}
          command="compartir"
          id={ORIGEN.id}
          body={{ destino_id: destino }}
          label="Compartir"
          disabled={destino === ""}
          onDone={() => setHecho(true)}
        />
        {hecho ? <p className="text-meta">Compartido</p> : null}
      </div>
    );
  },
  decorators: [
    (Story) => (
      <Escenario tables={VENTAS} observe={observar} handle={servidor}>
        <Story />
      </Escenario>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const boton = await canvas.findByRole("button", { name: "Compartir" });
    // Nothing chosen yet: there is nothing to share with.
    await expect(boton).toBeDisabled();
    // The server leaves out those it is already shared with.
    await waitFor(() =>
      expect(
        pedidos.some(
          (one) =>
            one.route === "/clientes" &&
            JSON.stringify(one.criteria).includes('"not in"') &&
            JSON.stringify(one.criteria).includes(GLOBEX.id),
        ),
      ).toBe(true),
    );
    await userEvent.click(canvas.getByRole("combobox", { name: /Compartir con/ }));
    // The customers offered, once they arrived: never «loading», never web-ui's «Buscar más…».
    const ofrecidos = async () => {
      let found: HTMLElement[] = [];
      await waitFor(() => {
        found = page
          .getAllByRole("option")
          .filter((one) => opciones.some((o) => one.textContent?.includes(o.label)));
        expect(found.length).toBeGreaterThan(0);
      });
      return found;
    };
    const vistos = await ofrecidos();
    const nombres = vistos.map((one) => one.textContent ?? "");
    await expect(nombres.some((text) => text.includes("Globex Bolivia"))).toBe(false);
    await expect(nombres.some((text) => text.includes(PRIMERO.label))).toBe(false);
    const elegido = opciones.find((one) => vistos[0]!.textContent?.includes(one.label))!;
    await userEvent.click(vistos[0]!);
    await waitFor(() => expect(boton).toBeEnabled());
    await userEvent.click(boton);
    await expect(await canvas.findByText("Compartido")).toBeVisible();
    // Both keys in the route: the record's, and the chosen one from the body.
    await expect(recibidas).toContain(
      `POST /clientes/${encodeURIComponent(ORIGEN.id)}/compartir/${encodeURIComponent(elegido.id)}`,
    );
  },
};
