import {
  defineMeta,
  entity,
  field,
  type MemoryTable,
  type Method,
} from "@sincpro/client-framework";
import type { AnyRecord } from "@sincpro/criteria";

import { type Producto, productoMeta, productos } from "./contactos";

/**
 * An order whose lines name a PRODUCT — a many2one inside a line, the way an ERP line is: the
 * key that is written (`product_code`) and the relation it is read by (`product`), with the
 * product's own model inside. What a line of `ventas` (a product as text) could not show.
 */

export type LineaPedido = {
  id?: string;
  product_code: string;
  product: { code: string; title: string } | null;
  quantity: number;
};

export type Pedido = {
  number: string;
  lines: { items: LineaPedido[]; count: { value: number; exact: boolean }; cursor: null };
  version: number;
};

export const lineaPedidoMeta = defineMeta({
  aggregate: "LineaPedido",
  identity: "id",
  display: "product_code",
  name: "Líneas",
  fields: {
    id: field.text({ label: "Línea", readonly: true }),
    product_code: field.text({ label: "Producto", required: true }),
    product: field.many2one(
      "Producto",
      { identifiedBy: "product_code", definition: productoMeta },
      { label: "Producto" },
    ),
    quantity: field.integer({ label: "Cantidad", default: 1 }),
  },
});

export const pedidoMeta = defineMeta({
  aggregate: "Pedido",
  identity: "number",
  display: "number",
  name: "Pedidos",
  fields: {
    number: field.text({ label: "Número", readonly: true }),
    lines: field.one2many(
      "LineaPedido",
      { identifiedBy: "order_number", definition: lineaPedidoMeta },
      { label: "Líneas" },
    ),
    version: field.integer({ label: "Versión", readonly: true }),
  },
});

export const pedidos = entity<Pedido>("ventas:pedido", {
  list: "/pedidos",
  save: "PUT /pedidos/{id}",
});

export { productos };

const PRODUCTOS: Producto[] = [
  ["CEM-50", "Cemento 50 kg"],
  ["FIE-12", "Fierro 12 mm"],
  ["PIN-LX", "Pintura látex"],
].map(([code, title]) => ({
  code: code!,
  title: title!,
  picture: "",
  availability: "in_stock",
  notes: "",
}));

export const PEDIDO = "P-0001";

/**
 * The service in memory: the order with one line, the products to choose from, and the save
 * that writes the lines as sincpro_framework does — whole, in order, a new one getting its id.
 */
export function servidorPedidos() {
  const pedido: Pedido = {
    number: PEDIDO,
    lines: {
      items: [
        {
          id: "PL-1",
          product_code: "CEM-50",
          product: { code: "CEM-50", title: "Cemento 50 kg" },
          quantity: 4,
        },
      ],
      count: { value: 1, exact: true },
      cursor: null,
    },
    version: 1,
  };
  let minted = 1;
  const tables: Record<string, MemoryTable> = {
    "/pedidos": { meta: pedidoMeta, rows: [pedido] as unknown as AnyRecord[] },
    "/productos": { meta: productoMeta, rows: PRODUCTOS as unknown as AnyRecord[] },
  };
  function handle(method: Method, route: string, body: unknown): unknown {
    if (method !== "PUT" || route !== `/pedidos/${PEDIDO}`) return undefined;
    const sent = body as { lines?: LineaPedido[] };
    const lines = sent.lines ?? pedido.lines.items;
    const items = lines.map((line) => ({ ...line, id: line.id ?? `PL-${++minted}` }));
    pedido.lines = { items, count: { value: items.length, exact: true }, cursor: null };
    pedido.version += 1;
    return { number: pedido.number, version: pedido.version };
  }

  return { tables, handle };
}
