/**
 * The time zone a date and time is read and written in — and the two conversions a form needs:
 * the server's instant to the wall clock of that zone, and back.
 *
 * Context: sincpro_framework sends a `datetime` as an instant (`2026-03-12T14:30:00Z`); a person
 * reads and types the wall clock of where the business is (10:30 in La Paz). Which zone that is
 * belongs to whoever is above the screens — the application, the company the user works in —
 * so it is installed once, like the framework's words (`FrameworkProvider timeZone`), and every
 * date and time follows it. Without it, the runtime's. A date with no time (`date`) is a day of
 * the calendar, not an instant: it is never converted.
 */

let installed: string | undefined;

/** Install the time zone dates and times are read and written in (IANA: `"America/La_Paz"`);
 *  `undefined` goes back to the runtime's. */
export function installTimeZone(timeZone: string | undefined): void {
  installed = timeZone;
}

/** The time zone in use. */
export function timeZoneNow(): string {
  return installed ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
}

const clocks = new Map<string, Intl.DateTimeFormat>();

/** One formatter per zone, kept: building one costs far more than using it. */
function clockOf(timeZone: string): Intl.DateTimeFormat {
  let clock = clocks.get(timeZone);
  if (clock === undefined) {
    clock = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    clocks.set(timeZone, clock);
  }
  return clock;
}

/** The wall clock of `timeZone` at `at` (ms), as the fields of a UTC date: what to compare. */
function wallAt(at: number, timeZone: string): number {
  const parts = Object.fromEntries(
    clockOf(timeZone)
      .formatToParts(new Date(at))
      .map((part) => [part.type, part.value]),
  );
  return Date.UTC(
    Number(parts["year"]),
    Number(parts["month"]) - 1,
    Number(parts["day"]),
    Number(parts["hour"]),
    Number(parts["minute"]),
    Number(parts["second"]),
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

/** `"2026-03-12T14:30:00Z"` → `"2026-03-12T10:30"` in `America/La_Paz`: the wall clock there,
 *  as a date-and-time control reads it. `null` when it is not an instant. */
export function wallTimeOf(instant: string, timeZone: string): string | null {
  const at = Date.parse(instant);
  if (Number.isNaN(at)) return null;
  const wall = new Date(wallAt(at, timeZone));
  return (
    `${wall.getUTCFullYear()}-${pad(wall.getUTCMonth() + 1)}-${pad(wall.getUTCDate())}` +
    `T${pad(wall.getUTCHours())}:${pad(wall.getUTCMinutes())}`
  );
}

/**
 * `"2026-03-12T10:30"` on the wall clock of `timeZone` → the instant, `"2026-03-12T14:30:00.000Z"`.
 * `null` when it is not a wall time.
 *
 * Context: the offset depends on the instant (daylight saving), so it is asked twice: at the
 * first guess, and again at the answer when the guess fell on the other side of a change.
 */
export function instantOf(wall: string, timeZone: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(wall);
  if (match === null) return null;
  const [, year, month, day, hour, minute] = match.map(Number) as number[];
  const guess = Date.UTC(year!, month! - 1, day!, hour!, minute!);
  const first = guess - (wallAt(guess, timeZone) - guess);
  const second = guess - (wallAt(first, timeZone) - first);
  return new Date(second).toISOString();
}
