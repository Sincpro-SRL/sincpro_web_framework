import {
  cardOf,
  type Entity,
  relationOf,
  useListing,
  useSummaryOf,
} from "@sincpro/web-framework";
import { RecordCard, RelationValue, Skeleton } from "@sincpro/web-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { contactos, CONTACTOS_TABLAS, notas, productos } from "./support/contactos";
import { Escenario } from "./support/escenario";

const meta: Meta = {
  title: "Casos de uso/24 · Un registro, en cada tamaño",
  parameters: {
    docs: {
      description: {
        component:
          "Todo registro de cualquier entidad dice lo mismo de sí: su **nombre** y, si los tiene, una **descripción**, un **estado**, un **tipo**, una **imagen** y **quién lo creó y lo cambió**. `summaryOf` lo lee de la metadata —el nombre es su `display`; lo demás, el campo que la entidad declara en `entity(…, { summary })` o, si no, el nombre de costumbre (`description`, `state`, `image`, `created_at`…)— y `cardOf` / `relationOf` lo vuelven las props de la tarjeta y del enlace de web-ui.\n\nLo que el registro no tiene **no se dibuja**: sin foto no hay imagen, sin estado no hay etiqueta, sin cambios no hay pie. Una persona o empresa (`person: true`) tiene cara: la foto o sus iniciales.",
      },
    },
  },
  decorators: [
    (Story) => (
      <Escenario tables={CONTACTOS_TABLAS} latency={40}>
        <Story />
      </Escenario>
    ),
  ],
};
export default meta;
type Story = StoryObj;

/** Every record of an entity, in the two sizes: its card, and its name as a many2one shows it. */
function Tamaños({ entity }: { entity: Entity }) {
  const listing = useListing(entity);
  const summarize = useSummaryOf(entity);
  if (listing.status === "loading") return <Skeleton rows={2} label="Cargando" />;
  return (
    <>
      {listing.rows.map((row) => {
        const summary = summarize(row, listing.meta);
        return (
          <section key={summary.id} aria-label={summary.name} className="grid gap-3">
            <RecordCard {...cardOf(summary)} />
            <RelationValue {...relationOf(summary)} />
          </section>
        );
      })}
    </>
  );
}

export const CadaEntidadDiceLoQueTiene: Story = {
  render: () => (
    <div className="grid max-w-3xl grid-cols-2 gap-6 p-6">
      <Tamaños entity={contactos} />
      <Tamaños entity={productos} />
      <Tamaños entity={notas} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Everything, under the conventional names.
    const andina = within(
      await canvas.findByRole("region", { name: /Distribuidora Andina/ }),
    );
    // What it is: under the card's title, and beside the name of the link.
    await expect(andina.getAllByText("Empresa")).toHaveLength(2);
    await expect(andina.getByText("Activo")).toBeVisible();
    await expect(andina.getByText(/Distribuidor mayorista/)).toBeVisible();
    await expect(andina.getByText(/^Actualizado el .+ por Luis Pérez$/)).toBeVisible();
    await expect(
      andina.getAllByRole("img", { name: /Distribuidora Andina/ })[0],
    ).toBeVisible();

    // A person without a photo, a description or a change: her initials, «Creado», nothing else.
    const maria = within(await canvas.findByRole("region", { name: "María Quispe" }));
    await expect(maria.getByText("Prospecto")).toBeVisible();
    await expect(maria.getByText(/^Creado el .+ por Ana Rojas$/)).toBeVisible();
    await expect(maria.queryByText(/^Actualizado/)).toBeNull();
    await expect(maria.queryByRole("img", { name: "María Quispe" })).toBeNull();

    // Names of its own, declared once in `entity()`: picture, availability, notes.
    const cemento = within(await canvas.findByRole("region", { name: "Cemento 50 kg" }));
    await expect(cemento.getByText("Agotado")).toBeVisible();
    await expect(cemento.getByText("Vuelve a llegar el lunes.")).toBeVisible();
    await expect(cemento.getAllByRole("img", { name: "Cemento 50 kg" })[0]).toBeVisible();

    // Only a name: only the name — no tag, no description, no footer, no picture.
    const nota = await canvas.findByRole("region", { name: "Llamar el martes" });
    await expect(within(nota).queryByText(/^(Creado|Actualizado)/)).toBeNull();
    await expect(within(nota).queryAllByRole("img")).toHaveLength(0);
    // Beside the link, its code: what tells two notes of the same name apart.
    await expect(within(nota).getByText("N-001")).toBeVisible();
  },
};
