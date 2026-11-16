import assert from "node:assert/strict";

import { defineMeta, field, installTimeZone, timeZoneNow } from "@sincpro/client-framework";
import {
  dayTextOf,
  instantTextOf,
  moneyTextOf,
  numberTextOf,
  textOf,
} from "@sincpro/web-framework";
import { afterEach, test } from "vitest";

// The conversions themselves (`wallTimeOf`, `instantOf`, daylight saving) are
// @sincpro/client-framework's and tested there; what is this package's is how a value READS.

afterEach(() => installTimeZone(undefined));

test("a date and time reads in the installed zone; a calendar day is never moved", () => {
  const meta = defineMeta({
    aggregate: "Cita",
    identity: "id",
    fields: {
      id: field.text({ label: "Cita" }),
      at: field.datetime({ label: "Hora" }),
      day: field.date({ label: "Día" }),
    },
  });
  installTimeZone("America/La_Paz");
  assert.equal(timeZoneNow(), "America/La_Paz");
  assert.match(textOf(meta, "at", "2026-03-12T14:30:00Z", "es") ?? "", /10:30/);
  installTimeZone("Europe/Madrid");
  assert.match(textOf(meta, "at", "2026-03-12T14:30:00Z", "es") ?? "", /15:30/);
  assert.match(textOf(meta, "day", "2026-03-12", "es") ?? "", /12/);
});

test("a value a screen holds outside a model reads as a field of its type would", () => {
  installTimeZone("America/La_Paz");
  // An instant on the installed zone's wall clock, a day never moved.
  assert.match(instantTextOf("2026-03-12T14:30:00Z", "es") ?? "", /10:30/);
  assert.match(dayTextOf("2026-03-12", "es") ?? "", /12/);
  // A decimal as text keeps its digits; a money is rounded to its currency, with its symbol.
  assert.equal(numberTextOf("1150.50", "es-BO"), "1.150,50");
  assert.match(
    moneyTextOf({ amount: "1150.5", currency: "BOB" }, "es-BO") ?? "",
    /1\.150,50/,
  );
  // Nothing to read is nothing, never «NaN» or «Invalid Date».
  assert.equal(numberTextOf("", "es"), null);
  assert.equal(dayTextOf(null, "es"), null);
  assert.equal(moneyTextOf("12", "es"), null);
});
