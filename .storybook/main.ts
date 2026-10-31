import type { StorybookConfig } from "@storybook/react-vite";

/**
 * Context: this Storybook is the package's acceptance suite. Each story is ONE use case of the
 * framework — a list armed from the metadata, a record, a refusal — run against the in-memory
 * server with the same engine sincpro_framework answers with, and each carries a `play` that
 * `make test` runs in a real Chrome (vitest + `@storybook/addon-vitest`). A case the framework
 * cannot do yet shows up here first.
 *
 * The domains it draws are fakes in `stories/support/`: one declared by hand (`ventas`), and
 * one whose definition is copied from a running forge (`forge`), so what a real service sends
 * today is on screen too.
 */
const config: StorybookConfig = {
  stories: ["../stories/*.mdx", "../stories/*.stories.@(ts|tsx)"],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@storybook/addon-vitest",
    "@storybook/addon-mcp",
  ],
  framework: { name: "@storybook/react-vite", options: {} },
};

export default config;
