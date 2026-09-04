/**
 * Sprint 6 — E2E: Multiproyecto y roles
 *
 * CP-43 — Admin (ADMIN) ve badge "ADMIN" en el header
 * CP-44 — Técnico (TECNICO) ve badge "TECNICO" en el header
 * CP-45 — ADMIN puede crear un empleado con rol TECNICO
 * CP-46 — ADMIN puede crear un empleado con rol ADMIN
 */

import { test, expect } from "@playwright/test";
import { USERS } from "./config";
import { login, screenshotOnFail } from "./helpers";

const { admin: ADMIN, tech: TECH } = USERS;

// ===========================================================================
// CP-43 — ADMIN ve su badge con texto "Admin"
// ===========================================================================
test("CP-43 — ADMIN ve badge Admin en header", async ({ page }) => {
  try {
    await login(page, ADMIN.email, ADMIN.password);

    await expect(page).toHaveURL("/");
    // El badge del header muestra "Admin" (CSS uppercase lo muestra en mayúsculas)
    await expect(
      page.locator("header span").filter({ hasText: /^Admin$/ })
    ).toBeVisible();
  } catch (e) {
    await screenshotOnFail(page, "CP-43");
    throw e;
  }
});

// ===========================================================================
// CP-44 — TECNICO ve su badge con texto "Técnico"
// ===========================================================================
test("CP-44 — TECNICO ve badge Técnico en header", async ({ page }) => {
  try {
    await login(page, TECH.email, TECH.password);

    await expect(page).toHaveURL("/");
    await expect(
      page.locator("header span").filter({ hasText: /^Técnico$/ })
    ).toBeVisible();
  } catch (e) {
    await screenshotOnFail(page, "CP-44");
    throw e;
  }
});

// ===========================================================================
// CP-45 — ADMIN puede crear empleado con rol TECNICO
// ===========================================================================
test("CP-45 — ADMIN crea empleado con rol TECNICO", async ({ page }) => {
  const ts = Date.now();
  const email = `sprint6-user-${ts}@cuadrantes.local`;
  const name = `Técnico Sprint6 ${ts}`;

  try {
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/employees");
    await expect(page.locator("table").first()).toBeVisible({ timeout: 8_000 });

    await page.locator("button").filter({ hasText: /Nuevo (empleado|usuario)|Añadir|Crear/i }).first().click();
    const nameInput = page.locator("input#emp-name, input[placeholder='Nombre completo']").first();
    const emailInput = page.locator("input#emp-email, input[type='email']").first();
    const passwordInput = page.locator("input#emp-password, input[type='password']").first();
    const roleSelect = page.locator("select#emp-role, [data-testid='select-global-role']").first();
    await expect(nameInput).toBeVisible({ timeout: 5_000 });

    await nameInput.fill(name);
    await emailInput.fill(email);
    await passwordInput.fill("Sprint6User1!");

    await roleSelect.selectOption("TECNICO");
    await expect(roleSelect).toHaveValue("TECNICO");

    await page.locator('button[type="submit"]').click();

    await expect(page.locator(`text=${name}`)).toBeVisible({ timeout: 8_000 });
  } catch (e) {
    await screenshotOnFail(page, "CP-45");
    throw e;
  }
});

// ===========================================================================
// CP-46 — ADMIN puede crear empleado con rol ADMIN
// ===========================================================================
test.skip("CP-46 — ADMIN crea empleado con rol ADMIN (obsoleto: API solo permite TECNICO)", async () => {});
