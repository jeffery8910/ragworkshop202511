import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Project-specific ignores:
    "node_modules/**",
    "public/**/*.min.js",
    "public/**/*.min.mjs",
  ]),
  // Allow CommonJS scripts (node ./scripts/*.js) without TS import restrictions.
  {
    files: ["scripts/**/*.js", "scripts/**/*.cjs", "scripts/**/*.mjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Workshop repo: keep lint practical (avoid blocking builds on `any` and minor style issues).
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "prefer-const": "off",
      "react/no-unescaped-entities": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "off",
    },
  },
  // Non-TS files in repo root (debug helpers, etc.) commonly use CommonJS.
  {
    files: ["**/*.js", "**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;
