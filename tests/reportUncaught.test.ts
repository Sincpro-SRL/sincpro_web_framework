import assert from "node:assert/strict";

import {
  BoundedContext,
  Command,
  configureProcess,
  servicesWith,
} from "@sincpro/client-framework";
import { memoryReporter } from "@sincpro/client-framework/testing";
import { reportUncaught } from "@sincpro/web-framework/errors";
import { afterAll, beforeEach, test } from "vitest";

/** A browser's `window`, as far as these events go. */
const window = new EventTarget();
const reporter = memoryReporter();
const global = globalThis as { window?: EventTarget };

function thrown(error: unknown): Event {
  return Object.assign(new Event("error"), { error });
}
function unhandled(reason: unknown): Event {
  return Object.assign(new Event("unhandledrejection"), { reason });
}

const { Feature } = servicesWith<Record<never, never>, Record<string, never>>();
class CommandBreak extends Command<void> {}
class Break extends Feature<CommandBreak, void> {
  execute(): Promise<void> {
    throw new Error("the use case broke");
  }
}
const shopBoundedContext = new BoundedContext("shop");
shopBoundedContext.feature(CommandBreak, { name: "Break" })(Break);

beforeEach(() => {
  configureProcess({ reporter });
  reporter.reports.length = 0;
});
afterAll(() => {
  delete global.window;
  configureProcess();
});

test("on the server — no window — it listens to nothing", () => {
  delete global.window;
  const stop = reportUncaught();
  window.dispatchEvent(thrown(new Error("not heard")));
  stop();
  assert.equal(reporter.reports.length, 0);
});

test("an error nobody caught and a promise nobody waited for are reported, each saying which", () => {
  global.window = window;
  const stop = reportUncaught();
  assert.equal(reportUncaught(), stop, "called again, the same listeners");

  window.dispatchEvent(thrown(new Error("a click handler broke")));
  window.dispatchEvent(unhandled(new Error("a promise nobody waited for")));
  assert.deepEqual(
    reporter.reports.map((one) => [one.about.useCase, (one.error as Error).message]),
    [
      ["uncaught error", "a click handler broke"],
      ["unhandled rejection", "a promise nobody waited for"],
    ],
  );
  stop();
});

test("what is not a fault, or has nothing to find it by, is not reported", () => {
  global.window = window;
  const stop = reportUncaught();
  // A script of another origin: «Script error.», no error.
  window.dispatchEvent(Object.assign(new Event("error"), { message: "Script error." }));
  // A request the screen stopped waiting for.
  window.dispatchEvent(
    unhandled(new DOMException("The user aborted a request.", "AbortError")),
  );
  assert.deepEqual(reporter.reports, []);
  stop();
});

test("a use case's failure that also went unhandled is reported once — the use case's", async () => {
  global.window = window;
  const stop = reportUncaught();
  const failure: unknown = await shopBoundedContext.execute(new CommandBreak()).then(
    () => assert.fail("it broke"),
    (error: unknown) => error,
  );
  window.dispatchEvent(unhandled(failure));
  assert.deepEqual(
    reporter.reports.map((one) => one.about.useCase),
    ["shop.Break"],
  );
  stop();
});

test("stopped, it hears nothing — until it is asked to listen again", () => {
  global.window = window;
  reportUncaught()();
  window.dispatchEvent(thrown(new Error("after stopping")));
  assert.equal(reporter.reports.length, 0);
  const stop = reportUncaught();
  window.dispatchEvent(thrown(new Error("listening again")));
  assert.equal(reporter.reports.length, 1);
  stop();
});
