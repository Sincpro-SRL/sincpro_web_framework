import assert from "node:assert/strict";

import { narrowed } from "@sincpro/web-framework/errors/narrowed";
import { test } from "vitest";

test("an event keeps the person's id and nothing else of them", () => {
  const event = narrowed({
    user: { id: 42, email: "ana@colegio.bo", username: "ana", ip_address: "10.0.0.7" },
    message: "x",
  });
  assert.deepEqual(event, { user: { id: "42" }, message: "x" });
});

test("an event with no id of the person carries no person", () => {
  assert.deepEqual(narrowed({ user: { email: "ana@colegio.bo" }, message: "x" }), {
    message: "x",
  });
  assert.deepEqual(narrowed({ message: "x" }), { message: "x" });
});

test("a request leaves without cookies, headers, body or query", () => {
  const event = narrowed({
    request: {
      url: "https://cauor.bo/cursos?token=secreto",
      cookies: "s=1",
      headers: { authorization: "x" },
      data: { factura: 1 },
      query_string: "token=secreto",
    },
  });
  assert.deepEqual(event, { request: { url: "https://cauor.bo/cursos" } });
});
