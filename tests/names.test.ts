import assert from "node:assert/strict";

import {
  entity,
  memoryTransport,
  metaStore,
  type Transport,
} from "@sincpro/client-framework";
import type { Criteria } from "@sincpro/criteria";
import { nameBook } from "@sincpro/web-framework/core/names";
import { test } from "vitest";

import { servidorVentas } from "../stories/support/servidor";
import { clientes } from "../stories/support/ventas";

/** The sales server, every page it is asked counted with its question. */
function counted(around: (transport: Transport) => Transport = (one) => one) {
  const servidor = servidorVentas();
  const asked: { route: string; criteria: Criteria }[] = [];
  const transport = around(
    memoryTransport(servidor.tables, {
      handle: servidor.handle,
      observe: (route, criteria) => void asked.push({ route, criteria }),
    }),
  );
  return { names: nameBook(transport, metaStore(), [clientes]), asked, servidor };
}

const [first, second, third] = ["C-001", "C-002", "C-003"];

test("every name asked in the same moment goes in ONE request per entity", async () => {
  const { names, asked } = counted();
  const named = await Promise.all(
    [first, second, third].map((id) => names.nameOf(clientes, id!)),
  );
  assert.equal(asked.length, 1, "one page for the three keys");
  assert.deepEqual(asked[0]?.criteria.selection, {
    field: "id",
    operator: "in",
    value: [first, second, third],
  });
  assert.ok(named.every((name) => typeof name === "string" && name !== ""));
});

test("a name already asked is shared; a write to its entity asks again", async () => {
  const { names, asked } = counted();
  await names.nameOf(clientes, first!);
  await names.nameOf(clientes, first!);
  assert.equal(asked.length, 1);
  names.changed({ method: "PUT", route: `/clientes/${first}/edit` });
  await names.nameOf(clientes, first!);
  assert.equal(asked.length, 2, "a rename may have changed it");
  names.changed({ method: "POST", route: "/facturas/F-1/confirm" });
  await names.nameOf(clientes, first!);
  assert.equal(asked.length, 2, "another entity's write changes no client's name");
});

test("an entity listed only under a record stays unnamed, and nothing is asked", async () => {
  const { names, asked } = counted();
  const members = entity("ventas:member", { list: "/tenants/{tenant_id}/members" });
  assert.equal(await names.nameOf(members, "ana"), undefined);
  assert.equal(asked.length, 0);
});

test("a request that fails is not kept: the next place asks again", async () => {
  let failing = true;
  const { names, asked } = counted((inner) => ({
    ...inner,
    list: (route, criteria, signal, options) => {
      if (failing) {
        failing = false;
        asked.push({ route, criteria: criteria as Criteria });
        return Promise.reject(new Error("the network went away"));
      }
      return inner.list(route, criteria, signal, options);
    },
  }));
  assert.equal(await names.nameOf(clientes, first!), undefined);
  assert.ok(await names.nameOf(clientes, first!));
  assert.equal(asked.length, 2);
});
