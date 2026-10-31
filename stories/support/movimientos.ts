import type { AnyRecord } from "@sincpro/criteria";
import { defineMeta, entity, field } from "@sincpro/web-framework";

/**
 * Two hundred thousand ledger movements — the set the scale stories run on. Generated once per
 * story file; the in-memory server answers over them with the same engine as the real one.
 */
export const movimientoMeta = defineMeta({
  aggregate: "Movimiento",
  identity: "id",
  display: "concept",
  name: { default: "Movimientos" },
  search: ["concept", "id"],
  defaultOrder: "-id",
  fields: {
    id: field.text({ label: "Número", readonly: true }),
    concept: field.text({ label: "Concepto" }),
    account: field.choice(["caja", "banco", "clientes", "proveedores"], {
      label: "Cuenta",
      labels: {
        caja: "Caja",
        banco: "Banco",
        clientes: "Clientes",
        proveedores: "Proveedores",
      },
    }),
    amount: field.number({ label: "Importe", exact: true }),
    posted_on: field.date({ label: "Fecha" }),
  },
});

const CONCEPTOS = ["Cobro", "Pago", "Depósito", "Transferencia", "Ajuste"];
const CUENTAS = ["caja", "banco", "clientes", "proveedores"];
export const MOVIMIENTOS: AnyRecord[] = Array.from({ length: 200_000 }, (_, i) => ({
  id: `M-${String(i + 1).padStart(7, "0")}`,
  concept: `${CONCEPTOS[i % CONCEPTOS.length]} ${i + 1}`,
  account: CUENTAS[i % CUENTAS.length],
  amount: (((i * 7919) % 100_000) / 100).toFixed(2),
  posted_on: `2026-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`,
}));

export const movimientos = entity("contabilidad:movimiento", { list: "/movimientos" });
export const TABLAS = { "/movimientos": { meta: movimientoMeta, rows: MOVIMIENTOS } };
