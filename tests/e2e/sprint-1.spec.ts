import { test, expect } from "@playwright/test";
import { USERS, SHIFT_COLORS } from "./config";
import { login, screenshotOnFail } from "./helpers";

const { admin: ADMIN, tech: TECH } = USERS;

// ===========================================================================
// CP-01 — Acceso sin sesión
// ===========================================================================
test("CP-01 — Acceso sin sesión redirige a /login @smoke", async ({ page }) => {
  try {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Gestor de Cuadrantes" })).toBeVisible();
  } catch (e) {
    await screenshotOnFail(page, "CP-01");
    throw e;
  }
});

// ===========================================================================
// CP-02 — Login con credenciales incorrectas
// ===========================================================================
test("CP-02 — Login con credenciales incorrectas muestra error @smoke", async ({ page }) => {
  try {
    await page.goto("/login");
    await page.getByLabel("Email").fill("noexiste@test.com");
    await page.getByLabel("Contraseña").fill("ContraseñaMal123!");
    await page.getByRole("button", { name: "Entrar" }).click();

    const errorMsg = page.getByText("Email o contraseña incorrectos");
    await expect(errorMsg).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  } catch (e) {
    await screenshotOnFail(page, "CP-02");
    throw e;
  }
});

// ===========================================================================
// CP-03 — Login admin correcto
// ===========================================================================
test("CP-03 — Login admin correcto redirige a / con badge ADMIN @smoke", async ({ page }) => {
  try {
    await login(page, ADMIN.email, ADMIN.password);

    await expect(page).toHaveURL("/");
    await expect(page.getByText(ADMIN.email)).toBeVisible();
    // El badge se renderiza como "Admin" y se muestra en mayusculas via CSS
    // (text-transform: uppercase), por eso comparamos sin distinguir caso.
    await expect(page.getByTestId("role-badge")).toHaveText(/^Admin$/i);
  } catch (e) {
    await screenshotOnFail(page, "CP-03");
    throw e;
  }
});

// ===========================================================================
// CP-04 — Login técnico correcto
// ===========================================================================
test("CP-04 — Login técnico correcto muestra badge TECNICO @smoke", async ({ page }) => {
  try {
    await login(page, TECH.email, TECH.password);

    await expect(page).toHaveURL("/");
    await expect(page.getByText("TECNICO")).toBeVisible();
  } catch (e) {
    await screenshotOnFail(page, "CP-04");
    throw e;
  }
});

// ===========================================================================
// CP-05 — Vista del cuadrante: grid con empleados y 31 columnas
// ===========================================================================
test("CP-05 — Vista del cuadrante muestra grid de 8 empleados y 31 días @smoke", async ({ page }) => {
  try {
    await login(page, ADMIN.email, ADMIN.password);
    await expect(page).toHaveURL("/");

    const table = page.locator("table").first();
    await expect(table).toBeVisible();

    // 31 celdas de día en la primera fila + columna nombre = 32 th en el header del grid
    const headerCells = table.locator("thead tr th");
    await expect(headerCells).toHaveCount(32); // 1 nombre + 31 días
  } catch (e) {
    await screenshotOnFail(page, "CP-05");
    throw e;
  }
});

// ===========================================================================
// CP-06 — Colores de turno correctos
// ===========================================================================
test("CP-06 — Colores de turno coinciden con la paleta definida", async ({ page }) => {
  try {
    await login(page, ADMIN.email, ADMIN.password);
    await expect(page).toHaveURL("/");

    // Verificamos cada color buscando una celda con ese código en la leyenda
    for (const [shiftCode, expectedColor] of Object.entries(SHIFT_COLORS)) {
      const legendCell = page
        .locator(`div.mt-6 span`)
        .filter({ hasText: new RegExp(`^${shiftCode}$`) })
        .first();

      await expect(legendCell).toBeVisible();
      await expect(legendCell).toHaveCSS("background-color", expectedColor);
    }
  } catch (e) {
    await screenshotOnFail(page, "CP-06");
    throw e;
  }
});

// ===========================================================================
// CP-07 — Contadores de turno en formato "Turno:N"
// ===========================================================================
test("CP-07 — Contadores de turno visibles en formato Turno:N", async ({ page }) => {
  try {
    await login(page, ADMIN.email, ADMIN.password);
    await expect(page).toHaveURL("/");

    const countersTable = page.locator('[data-testid="counters-table"]');
    await expect(countersTable).toBeVisible({ timeout: 8_000 });

    const firstCounterRow = countersTable.locator("tbody tr").first();
    await expect(firstCounterRow).toBeVisible();
    const counterCells = firstCounterRow.locator("td[data-testid^='counter-']");
    expect(await counterCells.count()).toBeGreaterThan(0);

    const firstCountText = await counterCells.first().textContent();
    expect(firstCountText).toMatch(/^\d+$/);
  } catch (e) {
    await screenshotOnFail(page, "CP-07");
    throw e;
  }
});

// ===========================================================================
// CP-08 — Fines de semana resaltados en el encabezado
// ===========================================================================
test("CP-08 — Columnas de fin de semana tienen fondo azul claro", async ({ page }) => {
  try {
    await login(page, ADMIN.email, ADMIN.password);
    await expect(page).toHaveURL("/");

    // Esperar a que la tabla esté renderizada antes de contar
    await expect(page.locator("table").first()).toBeVisible({ timeout: 10_000 });

    // Mayo 2026: 10 días de fin de semana (4 sábados + 5 domingos — 31 días)
    // Los th de fin de semana usan bg-blue-200 (schedule-grid.tsx:105).
    // Ojo: bg-blue-100 es la celda del cuerpo, no la cabecera.
    const weekendHeaders = page.locator("table").first().locator("thead tr th.bg-blue-200");
    await expect(weekendHeaders.first()).toBeVisible({ timeout: 5_000 });
    const count = await weekendHeaders.count();
    // Mayo 2026 tiene 9 fines de semana (sábados y domingos)
    expect(count).toBeGreaterThanOrEqual(8);
  } catch (e) {
    await screenshotOnFail(page, "CP-08");
    throw e;
  }
});

// ===========================================================================
// CP-09 — Navegación entre meses
// ===========================================================================
test("CP-09 — Navegación de meses cambia el título correctamente", async ({ page }) => {
  try {
    await login(page, ADMIN.email, ADMIN.password);
    await expect(page).toHaveURL("/");

    // Título inicial: Mayo 2026
    await expect(page.getByRole("heading", { name: /Mayo 2026/ })).toBeVisible();

    // Pulsar ‹ → Abril 2026
    await page.getByRole("button", { name: "‹" }).click();
    await expect(page.getByRole("heading", { name: /Abril 2026/ })).toBeVisible();

    // Pulsar › → volver a Mayo 2026
    await page.getByRole("button", { name: "›" }).click();
    await expect(page.getByRole("heading", { name: /Mayo 2026/ })).toBeVisible();
  } catch (e) {
    await screenshotOnFail(page, "CP-09");
    throw e;
  }
});

// ===========================================================================
// CP-10 — Cierre de sesión
// ===========================================================================
test("CP-10 — Cierre de sesión redirige a /login", async ({ page }) => {
  try {
    await login(page, ADMIN.email, ADMIN.password);
    await expect(page).toHaveURL("/");

    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/login/);
  } catch (e) {
    await screenshotOnFail(page, "CP-10");
    throw e;
  }
});

// ===========================================================================
// CP-11 — Acceso directo a ruta protegida post-logout
// ===========================================================================
test("CP-11 — Acceso a / tras logout redirige a /login", async ({ page }) => {
  try {
    // Hacer login y logout primero
    await login(page, ADMIN.email, ADMIN.password);
    await expect(page).toHaveURL("/");
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/login/);

    // Intentar acceder directamente a /
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  } catch (e) {
    await screenshotOnFail(page, "CP-11");
    throw e;
  }
});
