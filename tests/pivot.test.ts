import assert from "node:assert/strict";

import type { AnyRecord, Bucket } from "@sincpro/criteria";
import {
  installFrameworkCopy,
  pivotOf,
  SPANISH_FRAMEWORK_COPY,
} from "@sincpro/web-framework";
import { axisLabels, chartFromPivot, installCopy, SPANISH_COPY } from "@sincpro/web-ui";
import { test } from "vitest";

import { facturaMeta } from "../stories/support/ventas";

installFrameworkCopy(SPANISH_FRAMEWORK_COPY);
installCopy(SPANISH_COPY);

/** A bucket as the server counts it: a month cut by its grain is the period, «2026-09». */
function bucket(
  field: string,
  value: unknown,
  count: number,
  groups: Bucket<AnyRecord>[] = [],
): Bucket<AnyRecord> {
  return {
    field,
    value,
    count,
    measures: { amount_total: String(count * 10) },
    groups,
  } as never;
}

// Invoices by month × state: September and November, none in October, two without a date.
const crossed = [
  bucket("invoice_date", "2026-09", 3, [
    bucket("state", "paid", 2),
    bucket("state", "draft", 1),
  ]),
  bucket("invoice_date", "2026-11", 4, [bucket("state", "paid", 4)]),
  bucket("invoice_date", null, 2, [bucket("state", "draft", 2)]),
];
const byColumn = [bucket("state", "paid", 6), bucket("state", "draft", 3)];

const pivot = pivotOf({
  crossed,
  byColumn,
  rows: { field: "invoice_date", grain: "month" },
  columns: { field: "state" },
  measures: ["amount_total"],
  meta: facturaMeta,
  locale: "es",
});

test("a level cut by a grain is keyed by its period, and web-ui reads it as a month", () => {
  // The period, never the field's value read as an instant («31/08/2026 20:00» in La Paz).
  assert.deepEqual(pivot.rows.keys, [["2026-09"], ["2026-11"], [""]]);
  assert.deepEqual(
    pivot.rows.keys.map((key) => axisLabels(pivot.rows, key).join("")),
    ["Septiembre de 2026", "Noviembre de 2026", "sin fecha"],
  );
  // A level without a grain still reads as its value says it.
  assert.deepEqual(pivot.columns.keys, [["Pagada"], ["Borrador"]]);
  assert.equal(pivot.cell(["2026-09"], ["Pagada"])?.count, 2);
  assert.equal(pivot.rowTotal?.([""])?.count, 2);
});

test("a chart over a pivot by month fills the months nothing fell in, the undated last", () => {
  const chart = chartFromPivot(pivot);
  assert.deepEqual(
    chart.categories.map((one) => one.label),
    ["Septiembre de 2026", "Octubre de 2026", "Noviembre de 2026", "sin fecha"],
  );
  // October is a month with nothing, not a missing one.
  assert.deepEqual(chart.categories[1]?.key, ["2026-10"]);
});

test("a measure reads short under a chart's tick, and says whether it adds up", () => {
  const [total] = pivot.measures;
  // «Total» is a number the model sums (`measuresOf`'s default): to the million, and additive.
  // (`Intl` puts a no-break space before the unit: `\s`.)
  assert.match(total?.formatShort?.(1204933) ?? "", /^1,2\sM$/);
  assert.equal(total?.additive, true);
  // An average is not a sum: a chart must not add two of them into «otros».
  const averaged = {
    ...facturaMeta,
    fields: {
      ...facturaMeta.fields,
      amount_total: { ...facturaMeta.fields["amount_total"]!, total: "avg" },
    },
  };
  const [average] = pivotOf({
    crossed,
    byColumn,
    rows: { field: "invoice_date", grain: "month" },
    columns: { field: "state" },
    measures: ["amount_total"],
    meta: averaged as never,
    locale: "es",
  }).measures;
  assert.equal(average?.additive, false);
});
