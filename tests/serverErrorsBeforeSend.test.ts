import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import {
  registerServerErrors,
  reportRequestError,
} from "@sincpro/web-framework/errors/server";
import { afterAll, beforeAll, test } from "vitest";

/**
 * `beforeSend`: the application's last word, after the reporter narrowed the event. A file of
 * its own — what it registers is the process's, once (`serverErrors.test.ts` registers without it).
 */

function glitchtip(): Promise<{ server: Server; dsn: string; values: string[] }> {
  const values: string[] = [];
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk: Buffer) => (body += chunk.toString()));
    request.on("end", () => {
      for (const match of body.matchAll(/"value":"([^"]*)"/g)) values.push(match[1] ?? "");
      response.writeHead(200, { "content-type": "application/json" }).end("{}");
    });
  });
  return new Promise((ready) =>
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      ready({ server, dsn: `http://public@127.0.0.1:${port}/1`, values });
    }),
  );
}

let fake: Awaited<ReturnType<typeof glitchtip>>;
beforeAll(async () => (fake = await glitchtip()));
afterAll(async () => {
  delete (globalThis as Record<symbol, unknown>)[
    Symbol.for("@sincpro/web-framework/errors/server")
  ];
  await new Promise((closed) => fake.server.close(closed));
});

test("an event the application's beforeSend drops is never sent; the rest are, already narrowed", async () => {
  const seen: unknown[] = [];
  const reporting = await registerServerErrors({
    dsn: fake.dsn,
    beforeSend: (event) => {
      seen.push(event.user);
      const value = (event["exception"] as { values?: { value?: string }[] } | undefined)
        ?.values?.[0]?.value;
      return value === "not for GlitchTip" ? null : event;
    },
  });
  assert.ok(reporting);
  reportRequestError(new Error("not for GlitchTip"), { path: "/" });
  reportRequestError(new Error("for GlitchTip"), { path: "/" });
  assert.ok(await reporting.flush(2000));
  assert.deepEqual(fake.values, ["for GlitchTip"]);
  assert.deepEqual(
    seen,
    [undefined, undefined],
    "beforeSend sees the event without the person",
  );
});
