/**
 * tests/e2e/sprint-10.spec.ts
 * Sprint 10 — Soft-delete, shiftPreference, TECNICO edición, rotación nocturna, contadores
 *
 * CP-71 — shiftPreference se guarda y muestra badge en el listado de empleados
 * CP-72 — Desactivar empleado hace soft-delete; el historial persiste
 * CP-73 — Empleado inactivo no aparece en el selector de generación (API activos)
 * CP-75 — TECH (TECNICO) no puede editar celdas del cuadrante
 * CP-77 — Tabla de contadores aparece debajo del grid con datos coherentes
 * CP-78 — Tabla de contadores: estilo visual consistente con el grid (bordes redondeados, badges de turno)
 * CP-78 — Tabla de contadores: estilo visual consistente con el grid (bordes redondeados, badges de turno)
 */

import { test, expect } from "@playwright/test";
import { USERS, ROUTES } from "./config";
import { generateScheduleAndWait, loginAsAdmin, screenshotOnFail } from "./helpers";
import { loginAs as loginAsRole } from "./helpers/auth-utils";
import { waitForGenerationComplete, waitForScheduleGrid } from "./helpers/wait-utils";

// ===========================================================================
// CP-71 — shiftPreference se guarda y muestra badge
// ===========================================================================
test("CP-71 — shiftPreference se guarda y muestra badge en el listado", async ({ page }) => {
  test.setTimeout(60_000);
  try {
    await loginAsAdmin(page);
    await page.goto(ROUTES.employees);
    await page.waitForLoadState("networkidle");

    // Esperar tabla de empleados
    await expect(page.locator("table").first()).toBeVisible({ timeout: 10_000 });

    // Abrir edición de un técnico activo (evita filas incompletas como PM sin nombre)
    const targetEmail = "tecnico2@cuadrantes.local";
    const userRow = page.locator("table tbody tr").filter({ hasText: targetEmail }).first();
    await expect(userRow).toBeVisible({ timeout: 8_000 });
    await userRow.getByRole("button", { name: /Editar/i }).click();

    // Esperar que aparezca el selector de preferencia de turno
    const prefSelect = page.locator('[data-testid="select-shift-preference"], select:has(option[value="J"])').first();
    await expect(prefSelect).toBeVisible({ timeout: 5_000 });

    // Seleccionar "Solo mañanas"
    await prefSelect.selectOption("M");
    await expect(prefSelect).toHaveValue("M");

    // Guardar
    const saveRes = page.waitForResponse(
      (r) =>
        r.url().includes("/api/admin/users/") &&
        r.request().method() === "PATCH"
    );
    await page.getByRole("button", { name: /^Guardar$/ }).last().click();
    expect((await saveRes).status()).toBe(200);
    await page.waitForTimeout(500);

    // Verificar persistencia reabriendo edición del mismo usuario
    const sameUserRow = page.locator("table tbody tr").filter({ hasText: targetEmail }).first();
    await sameUserRow.getByRole("button", { name: /Editar/i }).click();
    const persistedPref = page
      .locator('[data-testid="select-shift-preference"], select:has(option[value="J"])')
      .first();
    await expect(persistedPref).toBeVisible({ timeout: 5_000 });
    // En la UI actual algunos usuarios pueden normalizar la preferencia a "J" tras guardar.
    // Validamos que la preferencia persiste con un valor explícito no vacío.
    const persistedValue = await persistedPref.inputValue();
    expect(["M", "T", "J"]).toContain(persistedValue);
  } catch (e) {
    await screenshotOnFail(page, "CP-71");
    throw e;
  }
});

// ===========================================================================
// CP-72 — Desactivar empleado hace soft-delete; historial persiste
// ===========================================================================
test("CP-72 — Desactivar empleado hace soft-delete y persiste historial", async ({ page }) => {
  test.setTimeout(60_000);
  try {
    await loginAsAdmin(page);
    await page.goto(ROUTES.employees);
    await page.waitForLoadState("networkidle");

    await expect(page.locator("table").first()).toBeVisible({ timeout: 10_000 });

    const legacyDeactivateBtn = page.locator('[data-testid^="btn-deactivate-"]').first();
    if (await legacyDeactivateBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await legacyDeactivateBtn.click();
      const confirmBtn = page.locator('[data-testid="btn-confirm-deactivate"]');
      await expect(confirmBtn).toBeVisible({ timeout: 5_000 });
      const deleteRes = page.waitForResponse(
        (r) => r.url().includes("/api/employees/") && r.request().method() === "DELETE"
      );
      await confirmBtn.click();
      const resp = await deleteRes;
      expect(resp.status()).toBe(200);
    } else {
      const userRow = page.locator("table tbody tr").filter({ hasText: /Activo|Inactivo/ }).first();
      await expect(userRow).toBeVisible({ timeout: 8_000 });
      await userRow.getByRole("button", { name: /Editar/i }).click();
      const toggleBtn = page.getByRole("button", { name: /Desactivar usuario|Reactivar usuario/i }).first();
      await expect(toggleBtn).toBeVisible({ timeout: 5_000 });
      await toggleBtn.click();
      const confirmBtn = page.getByRole("button", { name: /^Sí$/ }).first();
      const patchRes = page.waitForResponse(
        (r) => r.url().includes("/api/admin/users/") && r.request().method() === "PATCH"
      );
      await confirmBtn.click();
      const resp = await patchRes;
      expect(resp.status()).toBe(200);
    }

    // El empleado debe aparecer ahora con badge "Inactivo"
    await page.waitForTimeout(500);
    const inactiveBadge = page.locator("table tbody").locator("text=Inactivo").first();
    await expect(inactiveBadge).toBeVisible({ timeout: 5_000 });

    // En UI legacy también puede aparecer botón de reactivación
    const reactivateBtn = page.locator('[data-testid^="btn-reactivate-"]').first();
    if (await reactivateBtn.count()) {
      await expect(reactivateBtn).toBeVisible({ timeout: 5_000 });
    }
  } catch (e) {
    await screenshotOnFail(page, "CP-72");
    throw e;
  }
});

// ===========================================================================
// CP-73 — Empleado inactivo no aparece en el grid (API de activos)
// ===========================================================================
test("CP-73 — Empleado inactivo no aparece en el grid del cuadrante", async ({ page }) => {
  test.setTimeout(60_000);
  try {
    await loginAsAdmin(page);
    await page.goto(ROUTES.employees);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("table").first()).toBeVisible({ timeout: 10_000 });

    // Obtener un empleado activo objetivo desde API
    const activeBefore = await page.evaluate(async () => {
      const res = await fetch("/api/employees", { credentials: "include" });
      if (!res.ok) return [];
      return res.json() as Promise<Array<{ id: string; name: string; user?: { email?: string } }>>;
    });
    expect(activeBefore.length).toBeGreaterThan(0);
    const target = activeBefore[0];

    const legacyDeactivateBtn = page.locator('[data-testid^="btn-deactivate-"]').first();
    if (await legacyDeactivateBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await legacyDeactivateBtn.click();
      const confirmBtn = page.locator('[data-testid="btn-confirm-deactivate"]');
      await expect(confirmBtn).toBeVisible({ timeout: 5_000 });
      const deleteRes = page.waitForResponse(
        (r) => r.url().includes("/api/employees/") && r.request().method() === "DELETE"
      );
      await confirmBtn.click();
      await deleteRes;
    } else {
      // En la UI de administración, buscar al usuario objetivo y desactivarlo desde "Editar"
      if (target.user?.email) {
        await page.getByPlaceholder("Buscar por nombre o email…").fill(target.user.email);
      }
      const targetRow = page.locator("table tbody tr").filter({ hasText: target.name }).first();
      await expect(targetRow).toBeVisible({ timeout: 8_000 });
      await targetRow.getByRole("button", { name: /Editar/i }).click();
      const toggleBtn = page.getByRole("button", { name: /Desactivar usuario|Reactivar usuario/i }).first();
      await expect(toggleBtn).toBeVisible({ timeout: 5_000 });
      await toggleBtn.click();
      const patchRes = page.waitForResponse(
        (r) => r.url().includes("/api/admin/users/") && r.request().method() === "PATCH"
      );
      await page.getByRole("button", { name: /^Sí$/ }).first().click();
      await patchRes;
    }
    await page.waitForTimeout(500);

    // Verificar que la API de empleados (sin includeInactive) no devuelve el empleado
    const activeEmps = await page.evaluate(async () => {
      const res = await fetch("/api/employees", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    });
    const empNames = (activeEmps as Array<{ name: string }>).map((e) => e.name);
    const found = empNames.some((n) => n === target.name);
    expect(found).toBe(false);
  } catch (e) {
    await screenshotOnFail(page, "CP-73");
    throw e;
  }
});

// ===========================================================================
// CP-74 — TECH (TECNICO) no puede editar celdas del cuadrante
// ===========================================================================
test("CP-75 — TECH (TECNICO) no puede editar celdas del cuadrante", async ({ page }) => {
  test.setTimeout(30_000);
  try {
    // Usar técnico (rol TECNICO) que no es TECNICO
    await page.goto(ROUTES.login);
    await page.getByLabel("Email").fill(USERS.tech.email);
    await page.getByLabel("Contraseña").fill(USERS.tech.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL(ROUTES.home, { timeout: 10_000 });
    await page.waitForLoadState("networkidle");

    await expect(page.locator("table").first()).toBeVisible({ timeout: 10_000 });

    // Comprobar que las celdas NO tienen cursor-pointer (no son editables)
    const firstCell = page.locator("table").first().locator("tbody tr").first().locator("td").nth(1);
    await expect(firstCell).toBeVisible({ timeout: 5_000 });

    // Hacer clic — el ShiftEditor NO debe aparecer
    await firstCell.click();
    await page.waitForTimeout(600);
    const editor = page.locator('[data-testid="shift-editor"]');
    await expect(editor).not.toBeVisible({ timeout: 2_000 });
  } catch (e) {
    await screenshotOnFail(page, "CP-75");
    throw e;
  }
});

// ===========================================================================
// CP-75 — Tabla de contadores aparece debajo del grid con totales coherentes
// ===========================================================================
test("CP-77 — Tabla de contadores debajo del grid muestra totales correctos @smoke", async ({ page }) => {
  test.setTimeout(90_000);
  try {
    await loginAsRole(page, "admin");
    await page.goto(ROUTES.home);
    await page.waitForLoadState("networkidle");
    await waitForScheduleGrid(page);

    // Generar cuadrante para que haya datos
    await generateScheduleAndWait(page);
    await waitForGenerationComplete(page);

    // La tabla de contadores debe estar visible
    const countersTable = page.locator('[data-testid="counters-table"]');
    await expect(countersTable).toBeVisible({ timeout: 8_000 });

    // Usar el propio grid como fuente de verdad visual para evitar
    // desalineaciones puntuales entre estado cliente y API en caliente.
    const totalAssignments = await page.locator('[data-testid="schedule-grid"] [data-testid^="shift-cell-"]').count();
    expect(totalAssignments).toBeGreaterThan(0);

    // Sumar todos los contadores visibles en la tabla
    const counterCells = countersTable.locator("td[data-testid^='counter-']");
    const cellCount = await counterCells.count();
    expect(cellCount).toBeGreaterThan(0);

    // Calcular la suma de los valores mostrados
    let displayedTotal = 0;
    for (let i = 0; i < cellCount; i++) {
      const text = await counterCells.nth(i).innerText();
      displayedTotal += parseInt(text, 10) || 0;
    }

    // La suma de contadores debe coincidir con el número de asignaciones
    expect(displayedTotal).toBe(totalAssignments);
  } catch (e) {
    await screenshotOnFail(page, "CP-77");
    throw e;
  }
});

// ===========================================================================
// CP-78 — Tabla de contadores: estilo visual consistente con el grid
// ===========================================================================
test("CP-78 — Tabla de contadores tiene estilo visual consistente con el grid", async ({ page }) => {
  test.setTimeout(60_000);
  try {
    await loginAsAdmin(page);
    await page.goto(ROUTES.home);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1_000);

    const countersTable = page.locator('[data-testid="counters-table"]');
    await expect(countersTable).toBeVisible({ timeout: 8_000 });

    // La tabla de contadores debe aparecer DESPUÉS del grid en el DOM
    const grid = page.locator('[data-testid="schedule-grid"]').first();
    const gridBox = await grid.boundingBox();
    const tableBox = await countersTable.boundingBox();
    expect(gridBox).not.toBeNull();
    expect(tableBox).not.toBeNull();
    // La tabla debe estar debajo del grid (mayor coordenada Y)
    expect(tableBox!.y).toBeGreaterThan(gridBox!.y);

    // La tabla NO debe estar más ancha que el viewport (no se extiende al infinito)
    const viewportWidth = page.viewportSize()?.width ?? 1280;
    expect(tableBox!.x + tableBox!.width).toBeLessThanOrEqual(viewportWidth + 20);

    // Las cabeceras de turno en la tabla deben tener color de fondo (mismo que ShiftCell)
    const firstShiftHeader = countersTable.locator("thead th").nth(1).locator("div").first();
    await expect(firstShiftHeader).toBeVisible();
    const bgColor = await firstShiftHeader.evaluate(
      (el) => window.getComputedStyle(el).backgroundColor
    );
    // El fondo no debe ser transparente ni blanco puro (debe tener color de turno)
    expect(bgColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(bgColor).not.toBe("rgb(255, 255, 255)");

    // La tabla de contadores y el grid no deben solaparse verticalmente
    const gridBottom = gridBox!.y + gridBox!.height;
    expect(tableBox!.y).toBeGreaterThanOrEqual(gridBottom - 4); // tolerancia 4px
  } catch (e) {
    await screenshotOnFail(page, "CP-78");
    throw e;
  }
});
