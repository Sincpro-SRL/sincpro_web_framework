import assert from "node:assert/strict";

import { configureProcess, memoryTransport, TransportError } from "@sincpro/client-framework";
import { memoryLogger } from "@sincpro/client-framework/testing";
import { FrameworkProvider, useServiceReading } from "@sincpro/web-framework";
import { readOnServer, type ServerRead } from "@sincpro/web-framework/core";
import { renderToString } from "react-dom/server";
import { afterEach, test } from "vitest";

afterEach(() => configureProcess());

/** What a use case answers as it is: a class instance, a date, a function beside its data. */
class Course {
  constructor(
    readonly id: string,
    readonly starts: Date,
  ) {}
  late = () => false;
}

const courses = (city: string) =>
  Promise.resolve({
    city,
    next: [new Course("C-1", new Date("2026-12-01T13:00:00.000Z"))],
  });

test("its answer crosses as plain JSON: data, never instances — a date as its text", async () => {
  const answer = await readOnServer(courses, ["Oruro"]);

  assert.deepEqual(answer, {
    city: "Oruro",
    next: [{ id: "C-1", starts: "2026-12-01T13:00:00.000Z" }],
  });
  assert.equal(Object.getPrototypeOf(answer?.next[0]), Object.prototype);
});

test("a read that fails leaves the page to the browser: nothing, and one line on the log", async () => {
  const logs = memoryLogger();
  configureProcess({ logger: { engine: logs } });
  const broken = (): Promise<string> => Promise.reject(new TypeError("x is undefined"));

  assert.equal(await readOnServer(broken, [], { what: "the front page" }), undefined);

  assert.equal(logs.records.length, 1);
  const [line] = logs.records;
  assert.equal(line?.level, "warn");
  assert.equal(line?.layer, "infrastructure");
  assert.match(line?.message ?? "", /read on the server failed/);
  assert.deepEqual(line?.attributes, {
    what: "the front page",
    "error.type": "TypeError",
    "error.kind": "internal",
    "error.message": "x is undefined",
  });
});

test("a refusal says its kind, never its message; unnamed, the use case's name says what", async () => {
  const logs = memoryLogger();
  configureProcess({ logger: { engine: logs } });
  const course = (id: string): Promise<string> =>
    Promise.reject(new TransportError(`/courses/${id}`, 404, null));

  assert.equal(await readOnServer(course, ["C-404"]), undefined);

  assert.deepEqual(logs.records[0]?.attributes, {
    what: "course",
    "error.type": "TransportError",
    "error.kind": "not_found",
  });
});

test("a use case that throws before it answers is a failure like any other", async () => {
  const logs = memoryLogger();
  configureProcess({ logger: { engine: logs } });
  const throws = (): string => {
    throw new Error("no transport");
  };

  assert.equal(await readOnServer(throws, []), undefined);
  assert.equal(logs.records.length, 1);
});

test("an answer that is nothing stays nothing, without a line", async () => {
  const logs = memoryLogger();
  configureProcess({ logger: { engine: logs } });

  assert.equal(await readOnServer(() => Promise.resolve(undefined), []), undefined);
  assert.equal(await readOnServer(() => null, []), null);
  assert.equal(logs.records.length, 0);
});

test("paired with useServiceReading, the page renders on the server what was read there, once", async () => {
  let asked = 0;
  const balance = (member: { member_id: string }) => {
    asked += 1;
    return Promise.resolve({ member: member.member_id, due: 120 });
  };
  // The page's prop, typed by the use case alone: what `readOnServer` answers for it.
  function Balance({ initial }: { initial?: ServerRead<typeof balance> }) {
    const reading = useServiceReading(balance, [{ member_id: "M-7" }], { initial });
    return <p>{`${reading.status}:${reading.answer?.member}:${reading.answer?.due}`}</p>;
  }

  const initial = await readOnServer(balance, [{ member_id: "M-7" }]);
  const html = renderToString(
    <FrameworkProvider transport={memoryTransport({})} locale="es">
      <Balance initial={initial} />
    </FrameworkProvider>,
  );

  assert.equal(html, "<p>ready:M-7:120</p>");
  assert.equal(asked, 1, "only the server's read: rendering asked nothing");
});
