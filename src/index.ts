/**
 * Public entry of @sincpro/web-framework — the web client of sincpro_framework, married to
 * `@sincpro/web-ui` (how it looks) and `@sincpro/web-composer` (where it opens).
 *
 * Inside, three folders with one direction: `core/` is plain logic with no React (tested in
 * Node), `react/` holds state and draws nothing, `web/` draws. `make doctor` keeps the arrows.
 */
export * from "@sincpro/web-framework/core";
export * from "@sincpro/web-framework/react";
export * from "@sincpro/web-framework/web";
