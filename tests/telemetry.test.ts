import { tracerResource } from "@sincpro/web-framework/telemetry";
import { expect, test } from "vitest";

test("the traces say who sent them with sincpro_framework's keys, read out of the release", () => {
  expect(
    tracerResource({
      endpoint: "https://otlp.test/v1/traces",
      release: "sincpro-forge-web:1.4.0",
      environment: "production",
    }),
  ).toEqual({
    "service.name": "sincpro-forge-web",
    "service.version": "1.4.0",
    release: "sincpro-forge-web:1.4.0",
    "deployment.environment.name": "production",
  });
});

test("a service named apart keeps its name; without a release there is no version to invent", () => {
  expect(
    tracerResource({
      endpoint: "https://otlp.test",
      release: "registry.io/team/app:2.0",
      service: "forge",
    }),
  ).toMatchObject({
    "service.name": "forge",
    "service.version": "2.0",
    release: "registry.io/team/app:2.0",
  });
  expect(tracerResource({ endpoint: "https://otlp.test", service: "forge" })).toEqual({
    "service.name": "forge",
  });
});
