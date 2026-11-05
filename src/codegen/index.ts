/**
 * The generator: a bounded context's DTOs, client and entities out of the client contract
 * sincpro_framework exports (PRD_01 phase B). A build step that runs in Node — nothing in
 * `core/`, `react/` or `web/` imports it (`make doctor`), and the package's root entry does not
 * re-export it. `sincpro-web generate` (`cli.ts`) is the same, from a terminal.
 */
export { clientFileOf } from "@sincpro/web-framework/codegen/client";
export { domainFileOf } from "@sincpro/web-framework/codegen/domain";
export { entitiesFileOf } from "@sincpro/web-framework/codegen/entities";
export type {
  Bindings,
  Metamodel,
  Operation,
  RestBinding,
  Schema,
} from "@sincpro/web-framework/codegen/metamodel";
export type { GenerateOptions } from "@sincpro/web-framework/codegen/rest";
