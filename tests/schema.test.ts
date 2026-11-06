import assert from "node:assert/strict";

import {
  completeMeta,
  metaFromSchema,
  type SchemaComponents,
} from "@sincpro/client-framework";
import type { Meta } from "@sincpro/criteria";
import { installFrameworkCopy, SPANISH_FRAMEWORK_COPY, textOf } from "@sincpro/web-framework";
import { test } from "vitest";

import forge from "../stories/support/forge-openapi.json" with { type: "json" };

installFrameworkCopy(SPANISH_FRAMEWORK_COPY);

const components = forge.components as unknown as SchemaComponents;
const serverSpec = forge.specificationMeta as unknown as Meta;

test("what the server's meta left unknown is completed, the rest is kept as it came", () => {
  assert.equal(serverSpec.fields["language"]?.type, "unknown");
  const spec = completeMeta(serverSpec, metaFromSchema("ProjectSpecification", components));
  assert.deepEqual(spec.fields["language"]?.choices, ["es", "en"]);
  assert.equal(spec.fields["verification_checks"]?.type, "text[]");
  assert.deepEqual(spec.fields["host"], serverSpec.fields["host"]);
  assert.equal(
    textOf(spec, "verification_checks", ["make test", "make lint"]),
    "make test, make lint",
  );
});
