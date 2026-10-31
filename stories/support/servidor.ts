import type { AnyRecord } from "@sincpro/criteria";
import {
  defineMeta,
  type Draft,
  field,
  type Method,
  TransportError,
} from "@sincpro/web-framework";

import { type Factura, FACTURAS, VENTAS } from "./ventas";

/**
 * The sales service the use cases run against — what a sincpro_framework service does, in
 * memory: a save checks the version it was read at (409 when someone saved first), a Command
 * may be run dry (`dry_run: true` answers what it would do), a `Preview` says what the record
 * becomes, a draft is kept per record with its own version, and every change leaves a business
 * event in `/ventas-events` with its label.
 *
 * Each call to `servidorVentas()` starts from fresh copies: one story's writes never leak into
 * another's.
 */
export const eventoMeta = defineMeta({
  aggregate: "VentaEvento",
  identity: "id",
  defaultOrder: "-created_at",
  fields: {
    id: field.text({ readonly: true }),
    created_at: field.datetime({ label: "Cuándo" }),
    entity_type: field.text(),
    entity_id: field.text(),
    from_state: field.text({ label: "Antes" }),
    to_state: field.text({ label: "Ahora" }),
    by: field.text({ label: "Quién" }),
  },
});

const ESTADO: Record<Factura["state"], string> = {
  draft: "Borrador",
  posted: "Publicada",
  paid: "Pagada",
  cancelled: "Anulada",
};

const refuse = (route: string, status: number, problem: Record<string, unknown>) =>
  new TransportError(route, status, {
    errors: [],
    extensions: {},
    retryable: false,
    next_step: "fix_request",
    ...problem,
  } as never);

export function servidorVentas() {
  const facturas: Factura[] = structuredClone(FACTURAS);
  const eventos: AnyRecord[] = facturas.map((f) => ({
    id: `ev-${f.number}-0`,
    created_at: f.created_at,
    entity_type: "Factura",
    entity_id: f.number,
    label: { default: "Invoice created", es: "Factura creada" },
    by: "ana@sincpro.com.bo",
  }));
  const drafts = new Map<string, Draft>();
  let seq = 0;

  const find = (route: string, number: string) => {
    const found = facturas.find((f) => f.number === number);
    if (found === undefined)
      throw refuse(route, 404, {
        kind: "not_found",
        reason: "AGGREGATE_NOT_FOUND",
        detail: `${number} no existe.`,
      });
    return found;
  };

  const event = (f: Factura, es: string, from?: Factura["state"]) =>
    eventos.push({
      id: `ev-${f.number}-${++seq}`,
      created_at: new Date(Date.UTC(2026, 9, 31, 12, seq)).toISOString(),
      entity_type: "Factura",
      entity_id: f.number,
      label: { default: es, es },
      ...(from === undefined ? {} : { from_state: ESTADO[from], to_state: ESTADO[f.state] }),
      by: "ana@sincpro.com.bo",
    });

  function handle(method: Method, route: string, body: unknown): unknown {
    const sent = (body ?? {}) as AnyRecord;
    const [, , number, action] = route.split("/");

    if (method === "POST" && route === "/facturas/preview") {
      const values = sent["values"] as AnyRecord;
      const card = values["payment"] === "card";
      return {
        values: {},
        fields: { card_reference: { required: card, visible: card } },
        advice:
          typeof values["notes"] === "string" && values["notes"].length > 80
            ? [{ field: "notes", text: "La nota es larga: va impresa en la factura." }]
            : [],
      };
    }

    const f = find(route, decodeURIComponent(number ?? ""));

    if (method === "PUT" && action === "draft") {
      const kept = drafts.get(f.number);
      if ((kept?.version ?? 0) !== sent["expected"])
        throw refuse(route, 409, {
          kind: "conflict",
          reason: "DRAFT_CONFLICT",
          detail: "Otra pestaña guardó el borrador antes.",
        });
      const next: Draft = {
        values: sent["values"] as AnyRecord,
        version: (kept?.version ?? 0) + 1,
        origin_version: f.version,
      };
      drafts.set(f.number, next);
      return next;
    }

    if (method === "PUT" && action === undefined) {
      if (sent["version"] !== f.version)
        throw refuse(route, 409, {
          kind: "conflict",
          reason: "STALE_AGGREGATE",
          title: "Alguien lo guardó antes",
          detail: `${f.number} cambió después de que lo abriste.`,
        });
      const { version: _, ...values } = sent;
      if (Number(values["discount"] ?? 0) > 50)
        throw refuse(route, 422, {
          kind: "invalid",
          reason: "VALIDATION",
          title: "La factura no se guardó",
          errors: [{ pointer: "/discount", detail: "El descuento no puede pasar del 50 %." }],
        });
      if (
        f.payment === "card" &&
        values["payment"] === undefined &&
        values["card_reference"] === ""
      )
        throw refuse(route, 422, {
          kind: "invalid",
          reason: "VALIDATION",
          errors: [
            { pointer: "/card_reference", detail: "Falta la referencia de la tarjeta." },
          ],
        });
      Object.assign(f, values, { version: f.version + 1 });
      drafts.delete(f.number);
      event(f, "Factura editada");
      return { number: f.number, version: f.version };
    }

    if (method === "POST" && action === "confirm") {
      if (f.state !== "draft")
        throw refuse(route, 422, {
          kind: "domain",
          reason: "NOT_DRAFT",
          title: "Ya está confirmada",
          detail: `${f.number} está ${ESTADO[f.state].toLowerCase()}.`,
        });
      const from = f.state;
      f.state = "posted";
      f.version += 1;
      event(f, "Factura confirmada", from);
      return { number: f.number, state: f.state };
    }

    if (method === "POST" && action === "cancel") {
      if (sent["dry_run"] === true)
        return {
          text: `${f.number} queda anulada: su total de Bs. ${f.amount_total} sale del libro de ventas. La factura y su historial se conservan.`,
          data: { number: f.number, amount_total: f.amount_total },
        };
      const from = f.state;
      f.state = "cancelled";
      f.version += 1;
      event(f, "Factura anulada", from);
      return { number: f.number, state: f.state };
    }

    throw refuse(route, 404, {
      kind: "not_found",
      reason: "ROUTE_NOT_FOUND",
      detail: `Nada contesta ${method} ${route}.`,
    });
  }

  return {
    tables: {
      ...VENTAS,
      "/facturas": { meta: VENTAS["/facturas"].meta, rows: facturas },
      "/ventas-events": { meta: eventoMeta, rows: eventos },
    },
    handle,
    draft: (route: string) =>
      drafts.get(decodeURIComponent(route.split("/")[2] ?? "")) ?? null,
    /** Someone else saves it: what makes the next save from a screen a conflict. */
    alguienGuarda: (number: string) => {
      const f = facturas.find((one) => one.number === number);
      if (f) f.version += 1;
    },
    keepDraft: (number: string, values: AnyRecord) =>
      drafts.set(number, { values, version: 1, origin_version: 1 }),
  };
}
