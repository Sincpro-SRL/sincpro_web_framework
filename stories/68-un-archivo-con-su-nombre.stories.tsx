import { defineMeta, entity, field } from "@sincpro/client-framework";
import { EntityList, RecordField, useListing, useRecord } from "@sincpro/web-framework";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { Escenario } from "./support/escenario";

const meta: Meta = {
  title: "Casos de uso/68 · Un archivo con su nombre",
  parameters: {
    docs: {
      description: {
        component:
          "sincpro_framework guarda un archivo de un registro como `StoredFile` —la clave de sus bytes, el **nombre con que se mandó**, su tipo y su tamaño— y lo publica con el widget `file`, o `image` cuando su presentación lo dice; una foto trae además sus tamaños (`thumb` para una lista, `view` para un registro), y cada uno su enlace. Sin código de la pantalla, una lista lo dibuja como **un valor**: la miniatura y el nombre de verdad, el nombre lo baja (`FileValue` de web-ui) — nunca la clave `publico/contenido/01a1ece….jpg`. Un registro lo dibuja igual, con su tipo y su tamaño, no como una sección de sus partes.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

/* A group photo and its thumbnail, inline so the story renders offline. */
const svg = (fill: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${fill}"/><circle cx="32" cy="36" r="10" fill="hsl(40 40% 85%)"/></svg>`,
  )}`;
const FOTO = svg("hsl(225 45% 25%)");
const MINIATURA = svg("hsl(225 45% 35%)");
const PDF = `data:text/plain;charset=utf-8,${encodeURIComponent("Reglamento de ejemplo")}`;

/** sincpro_framework's `StoredFile`, as its contract publishes it. */
const archivoMeta = defineMeta({
  aggregate: "StoredFile",
  identity: "key",
  fields: {
    key: field.text({ label: "Clave" }),
    name: field.text({ label: "Nombre" }),
    content_type: field.text({ label: "Tipo" }),
    size: field.integer({ label: "Tamaño" }),
  },
});

const organoMeta = defineMeta({
  aggregate: "Organo",
  identity: "id",
  display: "nombre",
  name: { default: "Órganos" },
  fields: {
    id: field.text({ label: "ID", readonly: true }),
    nombre: field.text({ label: "Órgano" }),
    foto: {
      ...field.embedded(archivoMeta, { label: "Foto general", nullable: true }),
      widget: "image",
    },
    reglamento: {
      ...field.embedded(archivoMeta, { label: "Reglamento", nullable: true }),
      widget: "file",
    },
  },
});

const ORGANOS = [
  {
    id: "o1",
    nombre: "Directorio",
    foto: {
      key: "publico/contenido/01a1ece4998f.jpg",
      name: "Directorio 2026–2028.jpg",
      content_type: "image/jpeg",
      size: 412_000,
      width: 4032,
      height: 3024,
      url: FOTO,
      renditions: [
        {
          name: "thumb",
          key: "publico/contenido/01a1ece4998f@thumb.webp",
          content_type: "image/webp",
          size: 9_800,
          width: 320,
          height: 240,
          url: MINIATURA,
        },
      ],
    },
    reglamento: {
      key: "privado/reglamentos/01a1ed.pdf",
      name: "Reglamento del Directorio.pdf",
      content_type: "application/pdf",
      size: 184_320,
      url: PDF,
    },
  },
  { id: "o2", nombre: "Consejo Técnico", foto: null, reglamento: null },
];

const organos = entity("contenido:organo", { list: "/organos" });
const TABLES = { "/organos": { meta: organoMeta, rows: ORGANOS } };

function Organos() {
  const listing = useListing(organos);
  return <EntityList listing={listing} search={false} />;
}

function Directorio() {
  const organo = useRecord(organos, "o1");
  if (organo.record === null) return <p className="text-meta text-muted">…</p>;
  return (
    <div className="flex max-w-xl flex-col gap-3 p-6">
      <RecordField record={organo} name="foto" />
      <RecordField record={organo} name="reglamento" />
    </div>
  );
}

export const EnUnaLista: Story = {
  render: () => <Organos />,
  decorators: [
    (Story) => (
      <Escenario tables={TABLES} entities={[organos]}>
        <Story />
      </Escenario>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The photo is its real name, a download that keeps it — and its thumbnail, not the original.
    const foto = await canvas.findByRole("link", { name: "Directorio 2026–2028.jpg" });
    await expect(foto).toHaveAttribute("download", "Directorio 2026–2028.jpg");
    const cell = foto.closest('[data-ui="file-value"]') as HTMLElement;
    await expect(cell.querySelector("img")?.getAttribute("src")).toBe(MINIATURA);
    // A document by its name too; never a storage key, never its JSON.
    await expect(
      canvas.getByRole("link", { name: "Reglamento del Directorio.pdf" }),
    ).toBeVisible();
    await expect(canvas.queryByText(/publico\/contenido|"key"/)).toBeNull();
  },
};

export const EnElRegistro: Story = {
  render: () => <Directorio />,
  decorators: [
    (Story) => (
      <Escenario tables={TABLES} entities={[organos]}>
        <Story />
      </Escenario>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // One value per field — the name, its type and size —, not a section of its parts.
    await expect(
      await canvas.findByRole("link", { name: "Reglamento del Directorio.pdf" }),
    ).toBeVisible();
    await expect(canvas.getByText("PDF")).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: "Directorio 2026–2028.jpg" }),
    ).toBeVisible();
    await expect(canvas.queryByText("Clave")).toBeNull();
  },
};
