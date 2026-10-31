import assert from "node:assert/strict";

import type { Meta } from "@sincpro/criteria";
import {
  completeMeta,
  installFrameworkCopy,
  metaFromSchema,
  type SchemaComponents,
  SPANISH_FRAMEWORK_COPY,
  textOf,
} from "@sincpro/web-framework";
import { test } from "vitest";

import forge from "../stories/support/forge-openapi.json" with { type: "json" };

installFrameworkCopy(SPANISH_FRAMEWORK_COPY);

const components = forge.components as unknown as SchemaComponents;
const serverSpec = forge.specificationMeta as unknown as Meta;

test("a value object's enums and lists come out of the schema", () => {
  const spec = metaFromSchema("ProjectSpecification", components);
  assert.deepEqual(spec.fields["language"]?.choices, ["es", "en"]);
  assert.equal(spec.fields["verification_checks"]?.type, "text[]");
  assert.equal(spec.fields["engineer_review"]?.type, "boolean");
  assert.equal(spec.fields["preparation"]?.kind, "embedded");
});

test("a command's form: what is required, what has a default, what it is called", () => {
  const register = metaFromSchema("CommandRegisterProject", components);
  assert.equal(register.fields["project_id"]?.required, true);
  assert.equal(register.fields["tenant_id"]?.required, false);
  assert.equal(register.fields["tenant_id"]?.default, "");
  assert.deepEqual(register.fields["project_id"]?.label, { default: "Project Id" });
  assert.equal(register.fields["project_repositories"]?.many, true);
  assert.equal(register.fields["project_repositories"]?.kind, "embedded");
});

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

test("a reference the document does not hold is unknown, never a crash", () => {
  const spec = metaFromSchema("ArtifactTransfer", components);
  assert.equal(spec.fields["source"]?.type, "unknown");
  assert.equal(spec.fields["destination"]?.type, "text");
});
