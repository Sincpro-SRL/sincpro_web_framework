import assert from "node:assert/strict";

import { defineMeta, field } from "@sincpro/client-framework";
import {
  installTimeZone,
  instantOf,
  textOf,
  timeZoneNow,
  wallTimeOf,
} from "@sincpro/web-framework";
import { afterEach, test } from "vitest";

afterEach(() => installTimeZone(undefined));

test("an instant reads on the wall clock of the zone, and a wall time goes back to it", () => {
  // La Paz is UTC−4 all year.
  assert.equal(wallTimeOf("2026-03-12T14:30:00Z", "America/La_Paz"), "2026-03-12T10:30");
  assert.equal(instantOf("2026-03-12T10:30", "America/La_Paz"), "2026-03-12T14:30:00.000Z");
  // Past midnight on the wall clock is the day before in UTC, and back.
  assert.equal(wallTimeOf("2026-03-13T02:00:00Z", "America/La_Paz"), "2026-03-12T22:00");
  assert.equal(instantOf("2026-03-12T22:00", "America/La_Paz"), "2026-03-13T02:00:00.000Z");
});

test("the offset is the one of THAT day: daylight saving on either side of the change", () => {
  // New York: UTC−5 in winter, UTC−4 from 8 March 2026.
  assert.equal(instantOf("2026-03-07T09:00", "America/New_York"), "2026-03-07T14:00:00.000Z");
  assert.equal(instantOf("2026-03-09T09:00", "America/New_York"), "2026-03-09T13:00:00.000Z");
  assert.equal(wallTimeOf("2026-07-01T13:00:00Z", "America/New_York"), "2026-07-01T09:00");
});

test("what is not an instant or a wall time is nothing, never an error", () => {
  assert.equal(wallTimeOf("mañana", "America/La_Paz"), null);
  assert.equal(instantOf("10:30", "America/La_Paz"), null);
});

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
