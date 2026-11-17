import {
  defineMeta,
  entity,
  field,
  type MemoryTable,
  memoryTransport,
  type Transport,
} from "@sincpro/client-framework";
import type { AnyRecord, FieldMeta } from "@sincpro/criteria";
import { presented } from "@sincpro/web-framework";

/**
 * A payments context modelled on quipu's (a reference app on the whole stack, Sincpro-SRL
 * #39): a payment that only Commands move — no `edit`, no `save` —, its state, its amount drawn
 * as money and added up at a list's foot, the receipt it embeds, its dues as an entity of their
 * own with the framework's stamps, and a history that carries an edit. Written by hand, the way
 * sincpro_framework 3.37 publishes it; the field names are Spanish, as quipu's are.
 */

/** An amount the model draws as money and adds up at a list's foot (`Presentation.totals`). */
const amount = (label: string): FieldMeta => ({
  ...field.number({ label, exact: true, widget: "money" }),
  total: "sum",
});

const stamps = {
  created_at: field.datetime({ label: "Creado", readonly: true }),
  created_by: field.text({ label: "Creado por", readonly: true }),
  updated_at: field.datetime({ label: "Actualizado", readonly: true }),
  version: field.integer({ label: "Versión", readonly: true }),
};

export const cuotaMeta = defineMeta({
  aggregate: "Cuota",
  identity: "id",
  display: "periodo",
  name: { default: "Cuotas" },
  defaultOrder: "periodo",
  fields: {
    id: field.text({ label: "ID", readonly: true }),
    pago_id: field.text({ label: "Pago", readonly: true }),
    periodo: field.text({ label: "Mes" }),
    monto: amount("Monto (Bs.)"),
    estado: field.choice(["PENDIENTE", "EN_REVISION", "PAGADA"], {
      label: "Estado",
      labels: { PENDIENTE: "Pendiente", EN_REVISION: "En revisión", PAGADA: "Pagada" },
    }),
    ...stamps,
  },
});

export const reciboMeta = defineMeta({
  aggregate: "Recibo",
  identity: "numero",
  fields: {
    numero: field.text({ label: "N.º de recibo" }),
    emitido_en: field.date({ label: "Emitido" }),
    aprobado_por: field.text({ label: "Aprobado por" }),
  },
});

export const pagoMeta = defineMeta({
  aggregate: "Pago",
  identity: "id",
  display: "concepto",
  name: { default: "Pagos" },
  search: ["concepto", "colegiado"],
  defaultOrder: "-enviado_el",
  fields: {
    id: field.text({ label: "ID", readonly: true }),
    concepto: field.text({ label: "Concepto" }),
    colegiado: field.text({ label: "Colegiado" }),
    estado: field.choice(["EN_REVISION", "VALIDADO", "RECHAZADO"], {
      label: "Estado",
      labels: { EN_REVISION: "En revisión", VALIDADO: "Validado", RECHAZADO: "Rechazado" },
    }),
    monto: amount("Monto (Bs.)"),
    urgente: field.boolean({ label: "Urgente" }),
    enviado_el: field.date({ label: "Enviado el" }),
    recibo: field.embedded(reciboMeta, { label: "Recibo", nullable: true }),
    cuotas: field.one2many("Cuota", { identifiedBy: "pago_id" }, { label: "Cuotas" }),
    ...stamps,
  },
});

export const eventoPagoMeta = defineMeta({
  aggregate: "PagoEvento",
  identity: "id",
  defaultOrder: "-created_at",
  fields: {
    id: field.text({ readonly: true }),
    created_at: field.datetime({ label: "Cuándo" }),
    entity_id: field.text(),
    motivo: field.text({ label: "Motivo" }),
  },
});

export type Pago = {
  id: string;
  concepto: string;
  colegiado: string;
  estado: "EN_REVISION" | "VALIDADO" | "RECHAZADO";
  monto: string;
  urgente: boolean;
  enviado_el: string;
  recibo: { numero: string; emitido_en: string; aprobado_por: string } | null;
  created_at: string;
  created_by: string;
  updated_at: string;
  version: number;
};

export type Cuota = {
  id: string;
  pago_id: string;
  periodo: string;
  monto: string;
  estado: "PENDIENTE" | "EN_REVISION" | "PAGADA";
  created_at: string;
  created_by: string;
  updated_at: string;
  version: number;
};

/**
 * A payment: read, approved or rejected by its Commands, never edited — so its record is drawn
 * read only, whole. Its state is named on the entity (`summary`): `estado` is not one of the
 * English names the convention looks for. Its colours are the application's (`presented`).
 */
export const pagos = presented(
  entity<Pago>("pagos:pago", {
    list: "/pagos",
    history: "/pagos/{id}/events",
    summary: { state: "estado" },
  }),
  {
    tones: { estado: { EN_REVISION: "warn", VALIDADO: "good", RECHAZADO: "bad" } },
    facts: { pago_aprobado: "good", pago_rechazado: "bad" },
  },
);

export const cuotas = presented(
  entity<Cuota>("pagos:cuota", { list: "/cuotas", summary: { state: "estado" } }),
  { tones: { estado: { PENDIENTE: "warn", EN_REVISION: "info", PAGADA: "good" } } },
);

/** The payment every story opens: approved, with its receipt, three dues and its history. */
export const PAGO = "P-0001";

const UUID = (n: number) => `0192f6a8-7c3e-7b21-9a4d-${String(n).padStart(12, "0")}`;

const ESTADOS: readonly Pago["estado"][] = ["EN_REVISION", "VALIDADO", "RECHAZADO"];

/** Sixty payments: more than a page, so a list's foot adds up only the page it holds. */
export function pagosDePrueba(): Pago[] {
  return Array.from({ length: 60 }, (_, i) => {
    const day = String((i % 28) + 1).padStart(2, "0");
    return {
      id: `P-${String(i + 1).padStart(4, "0")}`,
      concepto: i === 0 ? "Cuota de noviembre" : `Cuota ${i + 1}`,
      colegiado: i === 0 ? "Ana Rojas" : `Colegiado ${i + 1}`,
      estado: i === 0 ? "VALIDADO" : (ESTADOS[i % ESTADOS.length] ?? "EN_REVISION"),
      monto: i === 0 ? "25" : String(10 + i),
      urgente: i % 4 === 0,
      // The payment every story opens is the latest sent: first in the list's order.
      enviado_el: i === 0 ? "2026-11-30" : `2026-11-${day}`,
      recibo:
        i === 0
          ? { numero: "0042", emitido_en: "2026-11-16", aprobado_por: "Juan Paz" }
          : null,
      created_at: `2026-11-${day}T12:00:00Z`,
      created_by: "ana",
      updated_at: `2026-11-${day}T13:00:00Z`,
      version: 1,
    };
  });
}

function cuotasDePrueba(): Cuota[] {
  return (["Septiembre", "Octubre", "Noviembre"] as const).map((periodo, i) => ({
    id: UUID(i + 1),
    pago_id: PAGO,
    periodo,
    monto: "25",
    estado: i < 2 ? "PAGADA" : "EN_REVISION",
    created_at: "2026-11-01T12:00:00Z",
    created_by: "ana",
    updated_at: "2026-11-01T12:00:00Z",
    version: 1,
  }));
}

/** What happened to the payment: an edit — each field before and after, in the words it had
 *  then —, and its approval, a fact of quipu's own. */
const HISTORIA: readonly AnyRecord[] = [
  {
    id: "e2",
    name: "quipu.pagos.v1.pago_aprobado",
    created_at: "2026-11-16T19:36:00Z",
    entity_id: PAGO,
    actor: "juan",
    label: { default: "Approved", es: "Se aprobó el pago" },
  },
  {
    id: "e1",
    name: "ddd.entity.v1.updated",
    created_at: "2026-11-15T14:00:00Z",
    entity_id: PAGO,
    actor: "ana",
    label: { default: "Updated", es: "Se actualizó" },
    changes: { concepto: ["Cuota", "Cuota de noviembre"], monto: ["20", "25"] },
    field_labels: { concepto: { default: "Concept", es: "Concepto" } },
  },
];

const EVENTS = "/pagos/{id}/events";
const OF_ONE = /^\/pagos\/([^/{}]+)\/events$/;

/** The payments service: its payments, their dues and each payment's facts. */
export function servidorPagos(): Transport {
  const tables = new Proxy(
    {
      "/pagos": { meta: pagoMeta, rows: pagosDePrueba() },
      "/cuotas": { meta: cuotaMeta, rows: cuotasDePrueba() },
      [EVENTS]: { meta: eventoPagoMeta, rows: [] },
    } as Record<string, MemoryTable>,
    {
      get(listed, route): MemoryTable | undefined {
        const id = typeof route === "string" ? OF_ONE.exec(route)?.[1] : undefined;
        if (id === undefined) return Reflect.get(listed, route) as MemoryTable | undefined;
        const rows = HISTORIA.filter((one) => one["entity_id"] === decodeURIComponent(id));
        return { meta: eventoPagoMeta, rows: [...rows] };
      },
    },
  );
  return memoryTransport(tables, { latency: 30 });
}
