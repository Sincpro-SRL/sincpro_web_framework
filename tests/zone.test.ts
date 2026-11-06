import assert from "node:assert/strict";

import { defineMeta, field, installTimeZone, timeZoneNow } from "@sincpro/client-framework";
import { textOf } from "@sincpro/web-framework";
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
