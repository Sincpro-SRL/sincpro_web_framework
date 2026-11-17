import assert from "node:assert/strict";

import { restTransport } from "@sincpro/client-framework";
import type { AnyRecord, Bucket } from "@sincpro/criteria";
import {
  installFrameworkCopy,
  pilesOf,
  SPANISH_FRAMEWORK_COPY,
} from "@sincpro/web-framework";
import { test } from "vitest";

import { facturaMeta } from "../stories/support/ventas";

installFrameworkCopy(SPANISH_FRAMEWORK_COPY);

/**
 * What sincpro_framework 3.37.2 answers to a Search whose criteria groups (#268): on the SAME
 * route, its groups first — value, count over the whole set, measures, the criteria that opens
 * each, the ids of its first page and the cursor inside it — and beside them the records the
 * store answered (on SQL, the first of every group). Written by hand as the backend writes it,
 * not through the fake: the stories passed against `memoryTransport` while the real backend
 * answered records where «group by» read buckets.
 */
const PAID = { field: "state", operator: "=", value: "paid" };
const DRAFT = { field: "state", operator: "=", value: "draft" };
const GROUPED_ANSWER = {
  groups: [
    {
      field: "state",
      value: "paid",
      count: 187,
      measures: { amount_total: "1204933.00" },
      criteria: { selection: PAID },
      ids: ["F-2026-0003"],
      cursor: "eyJudW1iZXIiOiJGLTIwMjYtMDAwMyJ9",
      groups: [],
    },
    {
      field: "state",
      value: "draft",
      count: 13,
      measures: { amount_total: "20.50" },
      criteria: { selection: DRAFT },
      ids: ["F-2026-0001"],
      cursor: null,
      groups: [],
    },
  ],
  facturas: [
    { number: "F-2026-0003", state: "paid", amount_total: "150.00" },
    { number: "F-2026-0001", state: "draft", amount_total: "20.50" },
  ],
  cursor: null,
  count: { value: 200, exact: true },
  model_version: "v1",
  dropped: [],
};

function backend(asked: string[]): typeof fetch {
  return (async (url: string) => {
    asked.push(decodeURIComponent(String(url)));
    return new Response(JSON.stringify(GROUPED_ANSWER), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
}

test("«group by» over REST reads the groups the backend answers beside the records", async () => {
  const asked: string[] = [];
  const transport = restTransport({ base: "/v1", fetch: backend(asked), document: null });
  // The question `useGroups` asks: the list's own, grouped, one id per group.
  const page = await transport.list<Bucket<AnyRecord>>("/facturas", {
    grouping: {
      group_by: [{ field: "state" }],
      measures: { amount_total: { function: "sum", field: "amount_total" } },
    },
    pagination: { limit: 1 },
  } as never);
  // The same route, the grouping in its criteria.
  assert.equal(asked.length, 1);
  assert.match(asked[0] ?? "", /^\/v1\/facturas\?criteria=.*"group_by"/);
  // The groups — never the records beside them read as if they were groups.
  assert.deepEqual(
    page.rows.map((bucket) => [bucket.value, bucket.count]),
    [
      ["paid", 187],
      ["draft", 13],
    ],
  );
  // As piles, in the model's words, counted over the whole set, each with what it adds up.
  const { piles } = pilesOf(page.rows, [{ field: "state" }], facturaMeta, "es", () => []);
  assert.deepEqual(
    piles.map((pile) => [pile.label, pile.count]),
    [
      ["Pagada", 187],
      ["Borrador", 13],
    ],
  );
  assert.match(piles[0]?.detail ?? "", /^Total 1\.204\.933,00$/);
});
