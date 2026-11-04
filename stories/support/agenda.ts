import type { AnyRecord } from "@sincpro/criteria";
import {
  defineMeta,
  entity,
  field,
  type MemoryTable,
  type Method,
} from "@sincpro/web-framework";

/**
 * An appointment at an instant: what the server keeps is UTC (`2026-03-12T14:30:00Z`), what a
 * person reads and types is the wall clock of where the business is.
 */

export type Cita = { id: string; title: string; at: string; version: number };

export const citaMeta = defineMeta({
  aggregate: "Cita",
  identity: "id",
  display: "title",
  name: "Citas",
  fields: {
    id: field.text({ label: "Cita", readonly: true }),
    title: field.text({ label: "Asunto" }),
    at: field.datetime({ label: "Hora" }),
    version: field.integer({ label: "Versión", readonly: true }),
  },
});

export const citas = entity<Cita>("agenda:cita", { list: "/citas", save: "PUT /citas/{id}" });

export const CITA = "CT-1";
/** 14:30 UTC: 10:30 in La Paz, 15:30 in Madrid. */
export const A_LAS = "2026-03-12T14:30:00.000Z";

/** The service in memory: one appointment, and the save that keeps what it was sent. */
export function servidorAgenda(onSaved: (at: string) => void) {
  const cita: Cita = { id: CITA, title: "Revisión del contrato", at: A_LAS, version: 1 };
  const tables: Record<string, MemoryTable> = {
    "/citas": { meta: citaMeta, rows: [cita] as unknown as AnyRecord[] },
  };
  function handle(method: Method, route: string, body: unknown): unknown {
    if (method !== "PUT" || route !== `/citas/${CITA}`) return undefined;
    const sent = body as Partial<Cita>;
    if (sent.at !== undefined) {
      cita.at = sent.at;
      onSaved(sent.at);
    }
    cita.version += 1;
    return { id: cita.id, version: cita.version };
  }
  return { tables, handle };
}
