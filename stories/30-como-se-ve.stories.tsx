import {
  EntityList,
  EntityPicker,
  EntityTags,
  presented,
  useListing,
} from "@sincpro/web-framework";
import { Field, Tag } from "@sincpro/web-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Escenario } from "./support/escenario";
import { type Cliente, CLIENTES, clientes, VENTAS } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/30 · Cómo se ve un registro, dicho una vez",
  parameters: {
    docs: {
      description: {
        component:
          "El **nombre** de un registro es del backend (`meta.display`, el `display_name` de Odoo) y sus partes, del resumen (`entity(…, { summary })`). **Cómo se dibuja** se declara una vez, con la entidad: `presented(entidad, { option, row, card })`. Cada tamaño contesta las props de la pieza de web-ui para ese tamaño —la opción de un selector (`PickerItem`), una fila (`RowOf`), una tarjeta (`RecordCard`)— y van **encima** del default: se da sólo lo que cambia. Sin presentación todo queda como estaba.\n\nLa opción se usa en `EntityPicker`, en `EntityTags` (su nombre y su cara) y en ⌘K (su nombre y su detalle, que son texto); la fila, en la cara «filas» de `EntityList` y en la tarjeta del tablero cuando no hay `card`; la tarjeta, en el tablero —abrirla sigue siendo de la lista—.",
      },
    },
  },
  decorators: [
    (Story) => (
      <Escenario tables={VENTAS}>
        <Story />
      </Escenario>
    ),
  ],
};

export default meta;
type Story = StoryObj;

/** The customers, with how each one looks at each size. */
const clientesConCara = presented(clientes, {
  // A choice is told apart by its NIT, found by it, and its city read at a glance.
  option: (c: Cliente) => ({
    meta: `NIT ${c.tax_id}`,
    haystack: c.tax_id,
    aside: <Tag tone="neutral">{c.city}</Tag>,
  }),
  // An inactive customer says so in the row, where the eye goes first.
  row: (c: Cliente) => (c.active ? {} : { tags: <Tag tone="bad">Inactivo</Tag> }),
  // A card says where.
  card: (c: Cliente) => ({ subtitle: c.city }),
});

const GLOBEX = CLIENTES[3]!;
const INACTIVO = CLIENTES.find((c) => !c.active)!;

export const EnElSelector: Story = {
  render: function Render() {
    const [cliente, setCliente] = useState("");
    const [etiquetas, setEtiquetas] = useState<string[]>([]);
    return (
      <div className="grid max-w-md gap-4 p-6">
        <Field label="Cliente">
          <EntityPicker entity={clientesConCara} value={cliente} onChange={setCliente} />
        </Field>
        <Field label="Avisar a">
          <EntityTags entity={clientesConCara} value={etiquetas} onChange={setEtiquetas} />
        </Field>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(await canvas.findByRole("combobox", { name: "Cliente" }));
    // The option says what the entity declared: its NIT where the key used to be, its city aside.
    const globex = await page.findByRole("option", { name: new RegExp(GLOBEX.name) });
    // The popover animates in: the option is in the document before it is shown.
    await waitFor(() =>
      expect(within(globex).getByText(`NIT ${GLOBEX.tax_id}`)).toBeVisible(),
    );
    await expect(within(globex).getByText(GLOBEX.city)).toBeVisible();
    // What the default drew instead — the key beside the name — gave way.
    await expect(within(globex).queryByText(GLOBEX.id)).toBeNull();
    await userEvent.click(globex);
    await expect(await canvas.findByDisplayValue(GLOBEX.name)).toBeVisible();

    // The tags field lists the same datum under the name (web-ui 1.5 `TagOption.meta`)…
    await userEvent.type(canvas.getByLabelText("Avisar a"), GLOBEX.name.slice(0, 3));
    const ofrecido = await page.findByRole("option", { name: new RegExp(GLOBEX.name) });
    await waitFor(() =>
      expect(within(ofrecido).getByText(`NIT ${GLOBEX.tax_id}`)).toBeVisible(),
    );
    await userEvent.click(ofrecido);
    // …and the chip, recognised by its name, does not carry it.
    await userEvent.keyboard("{Escape}");
    await expect(await canvas.findByText(GLOBEX.name)).toBeVisible();
    await waitFor(() => expect(page.queryByText(`NIT ${GLOBEX.tax_id}`)).toBeNull());
  },
};

function Lista({ entity }: { entity: typeof clientes }) {
  const listing = useListing(entity, { paging: "more" });
  const [abierto, setAbierto] = useState("");
  return (
    <div className="grid gap-2">
      <EntityList
        listing={listing}
        views={["rows", "board"]}
        onOpen={(c) => setAbierto(String(c.id))}
      />
      <p aria-label="Abierto">{abierto}</p>
    </div>
  );
}

export const EnLasFilasYElTablero: Story = {
  render: () => <Lista entity={clientesConCara} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText(INACTIVO.name);
    // The row: the default — the name and its facts — and on top what the entity adds.
    await expect(canvas.getAllByText("Inactivo").length).toBeGreaterThan(0);

    await userEvent.click(canvas.getByRole("button", { name: "Tablero" }));
    // The card: the row's name and tags, under the card's own subtitle.
    // A card is pressed by its title; the card is the box around it.
    const titulo = await canvas.findByRole("button", { name: GLOBEX.name });
    const tarjeta = titulo.closest<HTMLElement>(".rounded-box")!;
    await expect(within(tarjeta).getByText(GLOBEX.city)).toBeVisible();
    // Opening it is still the list's: the press rule did not go with the presentation.
    await userEvent.click(titulo);
    await expect(canvas.getByLabelText("Abierto")).toHaveTextContent(GLOBEX.id);
  },
};

export const SinPresentacionQuedaComoEstaba: Story = {
  render: () => <Lista entity={clientes} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText(INACTIVO.name);
    await expect(canvas.queryByText("Inactivo")).toBeNull();
  },
};
