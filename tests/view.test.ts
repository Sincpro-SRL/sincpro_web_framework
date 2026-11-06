import assert from "node:assert/strict";

import { type Transport } from "@sincpro/client-framework";
import type { ViewProps } from "@sincpro/web-composer";
import { entityView } from "@sincpro/web-framework";
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
