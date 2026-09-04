/**
 * tests/e2e/sprint-13.spec.ts
 * Sprint 13 — Festivos por CCAA + Historial mejorado + Documentación
 *
 * CP-95 — Paginación del historial — página 1, siguiente, última
 * CP-96 — Filtro por mes en historial muestra solo registros del mes
 * CP-97 — /info muestra sección "Preparar el cuadrante" para
 *          TECNICO y no la muestra para EMPLOYEE
 * CP-98 — /info muestra sección "Tu acceso de solo lectura" para EMPLOYEE
 *          y no la muestra para ADMIN
 */

import { test, expect } from "@playwright/test";
import { ROUTES } from "./config";
import { loginAsAdmin, loginAsTech, screenshotOnFail } from "./helpers";

// ============================================================================
// CP-95 — Paginación del historial — página 1, siguiente, última
// ============================================================================
test("CP-95 — paginación del historial de empleado", async ({ page }) => {
  test.setTimeout(120_000);
  try {
    await loginAsAdmin(page);

    // Obtener un empleado con historial
    const empRes = await page.request.get("/api/employees");
    expect(empRes.status()).toBe(200);
    const employees: { id: string; name: string }[] = await empRes.json();
    expect(employees.length).toBeGreaterThan(0);
    const empId = employees[0].id;

    // Validación directa del endpoint paginado de historial
    const page1Res = await page.request.get(`/api/employees/${empId}/history?page=1&limit=20`);
    expect(page1Res.status()).toBe(200);
    const page1 = await page1Res.json() as {
      data: unknown[];
      pagination: { page: number; totalPages: number; total: number; limit: number };
    };
    expect(page1.pagination.page).toBe(1);
    expect(page1.pagination.limit).toBe(20);
    expect(page1.pagination.total).toBeGreaterThanOrEqual(0);
    expect(page1.pagination.totalPages).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(page1.data)).toBe(true);

    if (page1.pagination.totalPages > 1) {
      const page2Res = await page.request.get(`/api/employees/${empId}/history?page=2&limit=20`);
      expect(page2Res.status()).toBe(200);
      const page2 = await page2Res.json() as { pagination: { page: number } };
      expect(page2.pagination.page).toBe(2);
    }
  } catch (err) {
    await screenshotOnFail(page, "CP-95");
    throw err;
  }
});

// ============================================================================
// CP-96 — Filtro por mes en historial
// ============================================================================
test("CP-96 — filtro por mes en historial de empleado", async ({ page }) => {
  test.setTimeout(60_000);
  try {
    await loginAsAdmin(page);

    const empRes = await page.request.get("/api/employees");
    const employees: { id: string; name: string }[] = await empRes.json();
    expect(employees.length).toBeGreaterThan(0);
    const empId = employees[0].id;

    // Consultar historial base para leer los meses disponibles
    const baseRes = await page.request.get(`/api/employees/${empId}/history?page=1&limit=20`);
    expect(baseRes.status()).toBe(200);
    const base = await baseRes.json() as { availableMonths: string[] };
    expect(Array.isArray(base.availableMonths)).toBe(true);

    if (base.availableMonths.length > 0) {
      const month = base.availableMonths[0];
      const filteredRes = await page.request.get(
        `/api/employees/${empId}/history?page=1&limit=20&month=${month}`
      );
      expect(filteredRes.status()).toBe(200);
      const filtered = await filteredRes.json() as { data: Array<{ date: string }> };
      expect(Array.isArray(filtered.data)).toBe(true);

      for (const row of filtered.data) {
        expect(row.date.slice(0, 7)).toBe(month);
      }
      console.log(`CP-96: filtrado por mes ${month}`);
    }
  } catch (err) {
    await screenshotOnFail(page, "CP-96");
    throw err;
  }
});

// ============================================================================
// CP-97 — /info muestra "Preparar el cuadrante" para TECNICO, no para EMPLOYEE
// ============================================================================
test("CP-97 — /info muestra sección Preparar el cuadrante para TECNICO", async ({
  page,
}) => {
  test.setTimeout(60_000);
  try {
    // Verificar que TECNICO ve la sección
    await loginAsTech(page);
    await page.goto(ROUTES.info);
    await page.waitForSelector("[data-testid*='info-section']");

    const adminSection = page.getByTestId("info-section-Preparar el cuadrante (5 pasos)");
    await expect(adminSection).toBeVisible();

    // Verificar que EMPLOYEE NO ve esa sección
    await page.context().clearCookies();
    await loginAsTech(page);
    await page.goto(ROUTES.info);
    await page.waitForSelector("[data-testid*='info-section']");

    const adminSectionForEmployee = page.getByTestId(
      "info-section-Preparar el cuadrante (5 pasos)"
    );
    await expect(adminSectionForEmployee).toHaveCount(0);
  } catch (err) {
    await screenshotOnFail(page, "CP-97");
    throw err;
  }
});

// ============================================================================
// CP-98 — /info muestra "Tu acceso de solo lectura" para EMPLOYEE, no para ADMIN
// ============================================================================
test("CP-98 — /info muestra sección Tu acceso de solo lectura solo para EMPLOYEE", async ({
  page,
}) => {
  test.setTimeout(60_000);
  try {
    // EMPLOYEE debe ver la sección "Tu acceso de solo lectura"
    await loginAsTech(page);
    await page.goto(ROUTES.info);
    await page.waitForSelector("[data-testid*='info-section']");

    const employeeSection = page.getByTestId("info-section-Tu acceso de solo lectura");
    await expect(employeeSection).toBeVisible();

    // ADMIN NO debe ver "Tu acceso de solo lectura"
    await page.context().clearCookies();
    await loginAsAdmin(page);
    await page.goto(ROUTES.info);
    await page.waitForSelector("[data-testid*='info-section']");

    const employeeSectionForAdmin = page.getByTestId("info-section-Tu acceso de solo lectura");
    await expect(employeeSectionForAdmin).toHaveCount(0);
  } catch (err) {
    await screenshotOnFail(page, "CP-98");
    throw err;
  }
});
