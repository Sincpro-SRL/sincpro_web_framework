import {
  defineMeta,
  entity,
  field,
  type Method,
  TransportError,
} from "@sincpro/client-framework";
import type { AnyRecord } from "@sincpro/criteria";

/**
 * A professional college's back office, the way quipu (CAUOR's) reads it: its enrollments, the
 * staff's accounts with the areas each one runs, and its directory — bodies and their members.
 * Small on purpose: each story of quipu's demo (web-framework#43) needs one piece of it.
 */

/** An enrollment: what a person types to find one is a name, an ID card or a course — never
 *  its receipt's fingerprint or the key where the file is stored. */
export const inscripcionMeta = defineMeta({
  aggregate: "Inscripcion",
  name: { default: "Inscripción" },
  identity: "id",
  display: "nombres",
  search: ["nombres", "ci"],
  fields: {
    id: field.text({ label: "ID", readonly: true }),
    nombres: field.text({ label: "Nombres" }),
    ci: field.text({ label: "CI" }),
    curso_titulo: field.text({ label: "Curso" }),
    comprobante: field.text({ label: "Comprobante" }),
    huella_comprobante: field.text({ label: "Huella del comprobante" }),
    tipo_comprobante: field.text({ label: "Tipo del comprobante" }),
  },
});

/** What tells two enrollments of the same person apart is the course. */
export const inscripciones = entity("academia:inscripcion", {
  list: "/inscripciones",
  summary: { description: "curso_titulo" },
});

export function inscripcionesDePrueba(): AnyRecord[] {
  return [
    {
      id: "I-001",
      nombres: "María Fernanda Apaza Quispe",
      ci: "4589123",
      curso_titulo: "Excel para contadores",
      comprobante: "uploads/2026/11/0192f6a8.pdf",
      huella_comprobante: "9f2c1e",
      tipo_comprobante: "application/pdf",
    },
    {
      id: "I-002",
      nombres: "Juan Pablo Mamani",
      ci: "6721450",
      curso_titulo: "Tributación 2026",
      comprobante: "uploads/2026/11/0192f6b1.pdf",
      huella_comprobante: "a13b77",
      tipo_comprobante: "application/pdf",
    },
  ];
}

/** The areas of the back office a staff account runs: several at once. */
const AREAS = ["CONTROL_PAGOS", "TIENDA", "DIRECTORIO"] as const;

export const cuentaMeta = defineMeta({
  aggregate: "Cuenta",
  identity: "id",
  display: "nombre",
  search: ["nombre"],
  fields: {
    id: field.text({ label: "ID", readonly: true }),
    nombre: field.text({ label: "Nombre" }),
    areas: {
      ...field.tags({ label: "Áreas", help: "Lo que la cuenta ve en el panel." }),
      choices: [...AREAS],
      choice_labels: {
        CONTROL_PAGOS: { default: "Control de pagos" },
        TIENDA: { default: "Tienda" },
        DIRECTORIO: { default: "Directorio" },
      },
    },
  },
});

/** A staff account: its areas change only through its Command, which takes what was chosen. */
export const cuentas = entity("auth:cuenta", {
  list: "/cuentas",
  commands: {
    delegar_areas: "POST /cuentas/{id}/areas",
    retirar: "POST /cuentas/{id}/retirar",
  },
});

export const CUENTA = "C-01";

export function cuentasDePrueba(): AnyRecord[] {
  return [
    { id: CUENTA, nombre: "Lucía Choque", areas: ["CONTROL_PAGOS"] },
    // The same person as an enrollment: ⌘K finds both, and each says what it is.
    { id: "C-02", nombre: "María Fernanda Apaza Quispe", areas: ["TIENDA"] },
  ];
}

/** The bodies of the directory, each named by a code a person can read. */
export const organoMeta = defineMeta({
  aggregate: "Organo",
  identity: "id",
  display: "nombre",
  search: ["nombre"],
  fields: {
    id: field.text({ label: "Código", readonly: true }),
    nombre: field.text({ label: "Nombre" }),
  },
});

/** A member of a body: the body is a key alone (`EntityID[Organo]`), no relation beside it. */
export const miembroMeta = defineMeta({
  aggregate: "Miembro",
  identity: "id",
  display: "nombre",
  fields: {
    id: field.text({ label: "ID", readonly: true }),
    nombre: field.text({ label: "Nombre" }),
    cargo: field.text({ label: "Cargo" }),
    organo: { ...field.text({ label: "Órgano" }), relation: "directorio.Organo" },
  },
});

export const organos = entity("directorio:organo", { list: "/organos" });
export const miembros = entity("directorio:miembro", { list: "/miembros" });

export function directorioDePrueba(): { organos: AnyRecord[]; miembros: AnyRecord[] } {
  return {
    organos: [
      { id: "DIRECTORIO", nombre: "Directorio" },
      { id: "CONSEJO_TECNICO", nombre: "Consejo Técnico" },
    ],
    miembros: [
      { id: "M-1", nombre: "Ana Rojas", cargo: "Presidenta", organo: "DIRECTORIO" },
      { id: "M-2", nombre: "Raúl Vargas", cargo: "Vocal", organo: "CONSEJO_TECNICO" },
    ],
  };
}

/** The college's service: what it keeps, and how it answers a Command over an account. */
export function servidorColegio() {
  const directorio = directorioDePrueba();
  const tables = {
    "/inscripciones": { meta: inscripcionMeta, rows: inscripcionesDePrueba() },
    "/cuentas": { meta: cuentaMeta, rows: cuentasDePrueba() },
    "/organos": { meta: organoMeta, rows: directorio.organos },
    "/miembros": { meta: miembroMeta, rows: directorio.miembros },
  };
  /** What the last Command over an account was sent with — what a story reads back. */
  const sent: AnyRecord[] = [];
  function handle(method: Method, route: string, body: unknown): unknown {
    const areas = /^\/cuentas\/([^/]+)\/areas$/.exec(route);
    if (method === "POST" && areas !== null) {
      const asked = body as { areas?: unknown; motivo?: unknown };
      sent.push({ ...(body as AnyRecord) });
      if (!Array.isArray(asked.areas) || asked.areas.length === 0)
        throw new TransportError(route, 422, {
          errors: [],
          extensions: {},
          retryable: false,
          next_step: "fix_request",
          kind: "domain",
          title: "Domain rule",
          detail: "Una cuenta del personal lleva al menos un área.",
        } as never);
      const cuenta = tables["/cuentas"].rows.find((one) => one["id"] === areas[1]);
      if (cuenta !== undefined) cuenta["areas"] = [...asked.areas];
      return {
        id: areas[1],
        areas: asked.areas,
        ...(asked.motivo === undefined ? {} : { motivo: asked.motivo }),
      };
    }
    return undefined;
  }
  return { tables, handle, sent };
}
