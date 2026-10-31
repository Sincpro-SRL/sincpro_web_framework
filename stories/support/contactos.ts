import { defineMeta, entity, field } from "@sincpro/web-framework";

/**
 * Three entities that say different amounts about themselves, to see one summary drawn over
 * all of them: a contact that has everything under the conventional names (description,
 * state, type, picture, who made and changed it), a product whose picture and state go by
 * names of its own — declared in its `entity()` — and a note that has nothing but a name.
 *
 * The pictures are drawn here (`data:` SVG): a story never waits on the network.
 */

function picture(color: string, letter: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="${color}"/><text x="48" y="62" font-family="sans-serif" font-size="44" fill="white" text-anchor="middle">${letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export type Contacto = {
  id: string;
  name: string;
  description: string;
  type: "company" | "person";
  state: "active" | "prospect" | "blocked";
  image: string;
  email: string;
  city: string;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
};

export const contactoMeta = defineMeta({
  aggregate: "Contacto",
  identity: "id",
  display: "name",
  search: ["name", "email"],
  name: "Contactos",
  fields: {
    id: field.text({ label: "Código", readonly: true }),
    name: field.text({ label: "Nombre", required: true }),
    description: field.text({ label: "Descripción" }),
    type: field.choice(["company", "person"], {
      label: "Tipo",
      labels: { company: "Empresa", person: "Persona" },
    }),
    state: field.choice(["active", "prospect", "blocked"], {
      label: "Estado",
      labels: { active: "Activo", prospect: "Prospecto", blocked: "Bloqueado" },
    }),
    image: field.text({ label: "Foto" }),
    email: field.text({ label: "Correo" }),
    city: field.text({ label: "Ciudad" }),
    created_at: field.datetime({ label: "Creado", readonly: true }),
    created_by: field.text({ label: "Creado por", readonly: true }),
    updated_at: field.datetime({ label: "Actualizado", readonly: true }),
    updated_by: field.text({ label: "Actualizado por", readonly: true }),
  },
});

/** People and companies: a round face, the photo or the initials. */
export const contactos = entity<Contacto>("crm:contacto", {
  list: "/contactos",
  summary: { person: true },
});

export const CONTACTOS: Contacto[] = [
  {
    id: "P-001",
    name: "Distribuidora Andina S.R.L.",
    description: "Distribuidor mayorista de materiales de construcción en el oriente.",
    type: "company",
    state: "active",
    image: picture("#2f6f62", "D"),
    email: "compras@andina.bo",
    city: "Santa Cruz",
    created_at: "2026-03-02T13:20:00Z",
    created_by: "Ana Rojas",
    updated_at: "2026-10-29T16:05:00Z",
    updated_by: "Luis Pérez",
  },
  {
    id: "P-002",
    name: "María Quispe",
    description: "",
    type: "person",
    state: "prospect",
    image: "",
    email: "maria.quispe@correo.bo",
    city: "La Paz",
    created_at: "2026-09-14T10:00:00Z",
    created_by: "Ana Rojas",
    updated_at: "",
    updated_by: "",
  },
];

export type Producto = {
  code: string;
  title: string;
  picture: string;
  availability: "in_stock" | "out";
  notes: string;
};

export const productoMeta = defineMeta({
  aggregate: "Producto",
  identity: "code",
  display: "title",
  search: ["title", "code"],
  name: "Productos",
  fields: {
    code: field.text({ label: "Código", readonly: true }),
    title: field.text({ label: "Producto", required: true }),
    picture: field.text({ label: "Imagen" }),
    availability: field.choice(["in_stock", "out"], {
      label: "Disponibilidad",
      labels: { in_stock: "En stock", out: "Agotado" },
    }),
    notes: field.text({ label: "Notas" }),
  },
});

/** Its picture, state and description go by names of its own: declared once, here. */
export const productos = entity<Producto>("inventario:producto", {
  list: "/productos",
  summary: { image: "picture", state: "availability", description: "notes" },
});

export const PRODUCTOS: Producto[] = [
  {
    code: "CEM-50",
    title: "Cemento 50 kg",
    picture: picture("#8a6d3b", "C"),
    availability: "out",
    notes: "Vuelve a llegar el lunes.",
  },
];

export type Nota = { id: string; name: string };

export const notaMeta = defineMeta({
  aggregate: "Nota",
  identity: "id",
  display: "name",
  name: "Notas",
  fields: {
    id: field.text({ label: "Código", readonly: true }),
    name: field.text({ label: "Nombre" }),
  },
});

export const notas = entity<Nota>("crm:nota", { list: "/notas" });

export const NOTAS: Nota[] = [{ id: "N-001", name: "Llamar el martes" }];

export const CONTACTOS_TABLAS = {
  "/contactos": { meta: contactoMeta, rows: CONTACTOS },
  "/productos": { meta: productoMeta, rows: PRODUCTOS },
  "/notas": { meta: notaMeta, rows: NOTAS },
};
