import assert from "node:assert/strict";

import { defineMeta, field } from "@sincpro/client-framework";
import { creationOf, defaultsOf } from "@sincpro/web-framework";
import { test } from "vitest";

import { facturaMeta } from "../stories/support/ventas";

test("a new record starts from the defaults the model publishes, and nothing else", () => {
  assert.deepEqual(defaultsOf(facturaMeta), {
    state: "draft",
    payment: "cash",
    discount: "0",
    urgent: false,
  });
  assert.deepEqual(defaultsOf(null), {});
});

test("a create sends what the caller may write: no read-only field, no empty one", () => {
  const sent = creationOf(facturaMeta, {
    ...defaultsOf(facturaMeta),
    customer_id: "C-004",
    notes: "",
    number: "F-9",
  });
  assert.deepEqual(sent, {
    payment: "cash",
    discount: "0",
    urgent: false,
    customer_id: "C-004",
  });
});

test("a create sends what was written, even what a condition locks afterwards", () => {
  const meta = defineMeta({
    aggregate: "Tenant",
    identity: "slug",
    display: "name",
    fields: {
      // Written once, when the tenant is created; read-only once it is stored.
      slug: field.text({
        label: "Slug",
        readonlyWhen: { field: "version", operator: ">", value: 0 },
      }),
      // Chosen first, locked once there are lines: still the record's currency.
      currency: field.text({
        label: "Moneda",
        readonlyWhen: { field: "has_lines", operator: "=", value: true },
      }),
      has_lines: field.boolean({ label: "Con líneas" }),
      name: field.text({ label: "Nombre" }),
      number: field.text({ label: "Número", readonly: true }),
    },
  });
  assert.deepEqual(
    creationOf(meta, {
      slug: "acme",
      currency: "BOB",
      has_lines: true,
      name: "Acme",
      number: "T-1",
    }),
    { slug: "acme", currency: "BOB", has_lines: true, name: "Acme" },
  );
});
