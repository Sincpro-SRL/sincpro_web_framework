import assert from "node:assert/strict";

import type { Bucket } from "@sincpro/criteria";
import {
  installFrameworkCopy,
  pivotOf,
  SPANISH_FRAMEWORK_COPY,
} from "@sincpro/web-framework";
import {
  axisLabels,
  chartFromPivot,
  COUNT_MEASURE,
  installCopy,
  SPANISH_COPY,
} from "@sincpro/web-ui";
import { test } from "vitest";

import { type Factura, facturaMeta } from "../stories/support/ventas";

installFrameworkCopy(SPANISH_FRAMEWORK_COPY);
installCopy(SPANISH_COPY);

/** A group as the engine answers it; what opens it is not read here. */
const bucket = (
  field: string,
  value: string,
  count: number,
  groups: Bucket<Factura>[] = [],
): Bucket<Factura> => ({ field, value, count, measures: {}, criteria: {}, groups });

/** A month bucket the way the engine answers it, crossed by state. */
const month = (value: string, count: number) =>
  bucket("created_at", value, count, [bucket("state", "paid", count)]);

const pivotByMonth = (crossed: Bucket<Factura>[]) =>
  pivotOf<Factura>({
    crossed,
    byColumn: [bucket("state", "paid", 0)],
    rows: { field: "created_at", grain: "month" },
    columns: { field: "state" },
    measures: [],
    meta: facturaMeta,
    locale: "es",
  });

test("a month bucket is keyed by its period and read as the month, not as an instant", () => {
  // «2026-11» read through `textOf` was «31/10/2026 20:00» in La Paz.
  const pivot = pivotByMonth([month("2026-09", 3), month("2026-11", 5)]);

  assert.deepEqual(pivot.rows.keys, [["2026-09"], ["2026-11"]]);
  assert.deepEqual(axisLabels(pivot.rows, ["2026-11"]), ["Noviembre de 2026"]);
  assert.equal(pivot.cell(["2026-11"], ["Pagada"])?.count, 5);
});

test("a date-time bucket is cut by the day the server wrote, never shifted into the browser's zone", () => {
  const pivot = pivotByMonth([month("2026-11-01T00:00:00+00:00", 2)]);

  assert.deepEqual(pivot.rows.keys, [["2026-11"]]);
});

test("a chart by month fills the month nobody counted and writes short ticks", () => {
  const chart = chartFromPivot(pivotByMonth([month("2026-09", 3), month("2026-11", 5)]), {
    measure: COUNT_MEASURE,
  });

  assert.deepEqual(
    chart.categories.map((point) => [point.label, point.tick]),
    [
      ["Septiembre de 2026", "sept"],
      ["Octubre de 2026", "oct"],
      ["Noviembre de 2026", "nov"],
    ],
  );
  assert.deepEqual(
    chart.values.map((row) => row[0]),
    [3, 0, 5],
  );
});

test("a level without a grain still reads its value through the model", () => {
  const pivot = pivotByMonth([month("2026-09", 1)]);

  assert.deepEqual(pivot.columns.keys, [["Pagada"]]);
});
