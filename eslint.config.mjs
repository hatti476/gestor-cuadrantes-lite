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
    ".next-test/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Artefactos generados por Playwright (reportes HTML, trazas, capturas).
    // Son bundles minificados de terceros: lintarlos solo genera ruido.
    "tests/report/**",
    "tests/report-docker/**",
    "tests/screenshots/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
