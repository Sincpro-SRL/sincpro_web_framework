import assert from "node:assert/strict";

import type { AnyRecord, Criteria } from "@sincpro/criteria";
import { memoryTransport, placeOf, stepIn, type Trail } from "@sincpro/web-framework";
import { test } from "vitest";

import { movimientos, TABLAS } from "../stories/support/movimientos";

const transport = memoryTransport(TABLAS);
const question: Criteria = { order: [{ field: "id" }] };
const SIZE = 5;

/** The trail a list leaves when a row of its first page is opened. */
async function firstPage(): Promise<Trail> {
  const page = await transport.list<AnyRecord>(movimientos.list, {
    ...question,
    pagination: { limit: SIZE },
  });
  return {
    route: movimientos.list,
    question,
    key: "id",
    ids: page.rows.map((row) => String(row["id"])),
    offset: 0,
    size: SIZE,
    cursors: [null],
    after: page.cursor,
    total: page.count?.value ?? null,
  };
}

test("a record knows where it stands in the list it was opened from", async () => {
  const trail = await firstPage();
  assert.deepEqual(placeOf(trail, "M-0000003"), { index: 3, total: 200_000 });
  assert.equal(placeOf(trail, "M-0000099"), null, "not on the page: no place");
});

test("inside the page, the neighbour is the next row — no request", async () => {
  const trail = await firstPage();
  const next = await stepIn(transport, trail, "M-0000002", 1);
  assert.equal(next?.id, "M-0000003");
  assert.equal(next?.trail, trail);
});

test("past the edge of the page, the server answers the neighbouring page", async () => {
  const trail = await firstPage();
  const next = await stepIn(transport, trail, "M-0000005", 1);
  assert.equal(next?.id, "M-0000006");
  assert.equal(next?.trail.offset, 5);
  assert.deepEqual(placeOf(next!.trail, "M-0000006"), { index: 6, total: 200_000 });
  // And back across it: the page before, the same size, nothing overlapping.
  const back = await stepIn(transport, next!.trail, "M-0000006", -1);
  assert.equal(back?.id, "M-0000005");
  assert.deepEqual(back?.trail.ids, trail.ids);
  assert.equal(back?.trail.offset, 0);
});

test("at either end of the set there is nothing further", async () => {
  const trail = await firstPage();
  assert.equal(await stepIn(transport, trail, "M-0000001", -1), null);
  assert.equal(await stepIn(transport, { ...trail, after: null }, "M-0000005", 1), null);
});
