import assert from "node:assert/strict";

import { scopeNameOf, scopeOfRef, type Transport } from "@sincpro/client-framework";
import type { ViewProps } from "@sincpro/web-composer";
import { entityView, trashOf } from "@sincpro/web-framework";
import { test } from "vitest";

import { facturaMeta, facturas } from "../stories/support/ventas";

function asking() {
  const asked: string[] = [];
  const transport: Transport = {
    list: async (route) => {
      asked.push(route);
      return { rows: [], meta: facturaMeta } as never;
    },
    one: async () => ({ record: {} }) as never,
    send: async () => ({}) as never,
  };
  return { transport, asked };
}

test("⌘K searches the scope the view declares, not the bare list", async () => {
  const { transport, asked } = asking();
  const view = entityView(facturas, {
    transport,
    name: "Facturas",
    meta: facturaMeta,
    search: { params: { company: "acme" } },
  });
  await view.search?.("F-2026");
  assert.deepEqual(asked, ["/facturas?company=acme"]);
});

test("the screens arrive when the view first opens, once", async () => {
  const { transport } = asking();
  let loads = 0;
  const Screen = (_: ViewProps) => null;
  const view = entityView(facturas, {
    transport,
    name: "Facturas",
    load: async () => {
      loads += 1;
      return { list: Screen };
    },
  });
  assert.equal(loads, 0, "declaring the view loads nothing");
  const first = await view.load();
  const again = await view.load();
  assert.equal(loads, 1);
  assert.equal(first, again, "the same component: a second open does not remount it");
});

test("a chunk that failed to arrive is asked again", async () => {
  const { transport } = asking();
  let loads = 0;
  const view = entityView(facturas, {
    transport,
    name: "Facturas",
    load: async () => {
      loads += 1;
      if (loads === 1) throw new Error("offline");
      return {};
    },
  });
  await assert.rejects(view.load());
  await view.load();
  assert.equal(loads, 2);
});

test("what a reference reads as before its view names it", () => {
  const { transport } = asking();
  const view = entityView(facturas, { transport, name: "Facturas", meta: facturaMeta });
  const title = view.title!;
  // The list is the view's name; under a named cut, whose it is.
  assert.equal(title(facturas.ref()), "Facturas");
  const cut = { field: "customer_id", operator: "=", value: "C-004" } as const;
  assert.equal(title(facturas.listRef(cut, "Globex Bolivia")), "Facturas · Globex Bolivia");
  assert.equal(title(facturas.listRef(cut)), "Facturas");
  // A record: its key when a person reads it, the view's name when it is a machine's.
  assert.equal(title(facturas.ref("F-2026-0004")), "F-2026-0004");
  assert.equal(title(facturas.ref("0192f5e0a1b27c3d8e4f5a6b7c8d9e0f")), "Facturas");
});

test("a list opened under a cut carries the cut and its name", () => {
  const cut = { field: "customer_id", operator: "=", value: "C-004" } as const;
  const ref = facturas.listRef(cut, "Globex Bolivia");
  assert.equal(ref.id, undefined);
  assert.deepEqual(scopeOfRef(ref), cut);
  assert.equal(scopeNameOf(ref), "Globex Bolivia");
  assert.equal(scopeNameOf(facturas.listRef(cut)), undefined);
});

test("an entity's trash is its own list under archived_at not null, offering restore", () => {
  const trash = trashOf(facturas);
  assert.equal(trash.trash, true);
  assert.equal(trash.entity, facturas);
  assert.equal(trash.key, "ventas:factura-trash");
  assert.deepEqual(trash.scope?.selection, {
    field: "archived_at",
    operator: "is null",
    value: false,
  });
  assert.equal(trashOf(facturas, { title: "Anuladas" }).title, "Anuladas");
});
