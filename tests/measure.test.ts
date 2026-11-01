import assert from "node:assert/strict";

import type { AnyRecord, Bucket } from "@sincpro/criteria";
import { detailOf, measuresOf, memoryTransport, sumsOf } from "@sincpro/web-framework";
import { test } from "vitest";

import { clienteMeta, facturaMeta, FACTURAS, VENTAS } from "../stories/support/ventas";

test("what adds up by default is the figure a record computes, not what a person types", () => {
  // `amount_total` is a read-only exact amount; `discount` (a %) is typed: never summed.
  assert.deepEqual(sumsOf(facturaMeta), ["amount_total"]);
  assert.deepEqual(sumsOf(clienteMeta), [], "a credit limit is typed, not computed");
  assert.deepEqual(sumsOf(null), []);
});

test("the server adds each group up over every row of it, not the page", async () => {
  const transport = memoryTransport(VENTAS);
  const page = await transport.list<Bucket<AnyRecord>>("/facturas", {
    grouping: { group_by: [{ field: "state" }], measures: measuresOf(["amount_total"]) },
    pagination: { limit: 1 },
    meta: false,
  } as never);
  const paid = page.rows.find((bucket) => bucket.value === "paid");
  const expected = FACTURAS.filter((one) => one.state === "paid").reduce(
    (sum, one) => sum + Number(one.amount_total),
    0,
  );
  assert.equal(Number(paid?.measures?.["amount_total"]), expected);
});

test("a group's measures read in the model's words and the value's format", () => {
  assert.equal(detailOf(facturaMeta, { amount_total: "1611.00" }, "es"), "Total 1611,00");
  assert.equal(detailOf(facturaMeta, undefined), undefined);
  assert.equal(detailOf(facturaMeta, { amount_total: null }), undefined);
});
