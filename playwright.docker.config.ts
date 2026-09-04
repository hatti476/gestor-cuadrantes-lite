import { defineConfig, devices } from "@playwright/test";
import * as dotenv from "dotenv";

// Credenciales de los tests (USERS en tests/e2e/config.ts las lee de aqui).
// Sin esta linea, ADMIN_EMAIL/ADMIN_PASSWORD llegan vacios y el login falla.
dotenv.config({ path: ".env.test" });

// El contenedor usa /app/prisma/dev.db, que via bind mount es prisma/dev.db en
// el host. globalSetup debe sembrar ESA base de datos, no una test.db aparte:
// de lo contrario los tests validan datos que la app nunca ve.
process.env.E2E_DATABASE_URL = "file:./dev.db";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./tests/screenshots",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"], ["html", { outputFolder: "tests/report-docker", open: "never" }]],

  // Usar globalSetup para preparar BD de tests
  globalSetup: "./tests/e2e/global-setup.ts",

  use: {
    baseURL: "http://localhost:3000", // Docker container
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    navigationTimeout: 45_000,
  },

  // NO webServer - usamos el contenedor Docker existente
  // webServer: { ... },

  projects: [
    {
      name: "chromium-docker",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});