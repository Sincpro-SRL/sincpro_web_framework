import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "**/storybook-static/**"] },
  js.configs.recommended,
  tseslint.configs.recommended,
  prettier,
  {
    plugins: { "simple-import-sort": simpleImportSort, "react-hooks": reactHooks },
    rules: {
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      // The same rule tsc applies with noUnusedParameters: a leading `_` says "unused on
      // purpose" — a slot marker component that only declares its props, a key dropped
      // from a rest spread.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    // A story's `render()` is a component Storybook mounts — hooks there are its documented
    // pattern, not a call from a plain function.
    files: ["stories/**/*.tsx"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
);
