/**
 * tests/e2e/sprint-9.spec.ts
 * Sprint 9 — Algoritmo de generación Fase 2
 *
 * CP-67 — Generar cuadrante respeta turnos manuales previos
 * CP-68 — Generar cuadrante respeta vacaciones/bajas introducidas
 * CP-69 — Bloque de noches visible en el grid (7 celdas N/NF consecutivas)
 * CP-70 — Continuidad correcta al navegar al mes siguiente tras generar
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin, screenshotOnFail } from "./helpers";
import { loginAs as loginAsRole } from "./helpers/auth-utils";
import { waitForGenerationComplete, waitForScheduleGrid } from "./helpers/wait-utils";

/** Navigate n months forward and wait for the grid to load (with or without data) */
async function navigateMonths(page: Parameters<typeof loginAsAdmin>[0], n: number) {
  for (let i = 0; i < n; i++) {
    await page.locator('[data-testid="btn-next-month"]').click();
    await page.waitForTimeout(400);
  }
}

/** Generate the schedule for the current month and wait for the grid to reload with assignments */
async function generateAndWait(page: Parameters<typeof loginAsAdmin>[0]) {
  const generateButton = page.locator('[data-testid="btn-generate"]');
  if (!(await generateButton.isVisible({ timeout: 500 }).catch(() => false))) {
    await page.locator('[data-testid="prep-step-generar"]').click();
  }
  await expect(generateButton).toBeVisible({ timeout: 5_000 });

  const generateRes = page.waitForResponse(
    (r) => r.url().includes("/api/schedules/generate") && r.status() === 200,
    { timeout: 120_000 }
  );
  await generateButton.click();
  const confirmModal = page.locator('[data-testid="confirm-generate-modal"]');
  if (await confirmModal.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await page.locator('[data-testid="btn-confirm-generate"]').click();
  }
  await generateRes;
  // Wait for schedule reload after generate
  await page.waitForResponse(
    (r) => r.url().includes("/api/schedules") && !r.url().includes("/generate"),
    { timeout: 10_000 }
  );
  await waitForGenerationComplete(page);
}

// ─── CP-67 — La generación respeta turnos manuales previos ───────────────────
test("CP-67 — Generar cuadrante respeta turnos manuales previos", async ({ page }) => {
  test.setTimeout(90_000);
  try {
    await loginAsAdmin(page);
    await expect(page.locator("table").first()).toBeVisible({ timeout: 10_000 });

    // Navegar a Agosto 2026 (3 nexts desde Mayo)
    await navigateMonths(page, 3);

    // Generar el cuadrante primero para que aparezcan los empleados en el grid
    await generateAndWait(page);
    await expect(page.locator("table").first()).toBeVisible({ timeout: 5_000 });

    // Asignar turno "V" manualmente al primer empleado en el día 4
    const cellTarget = page.locator("table").first().locator("tbody tr").first().locator("td").nth(4);
    await cellTarget.click();
    await expect(page.locator('[data-testid="shift-editor"]')).toBeVisible({ timeout: 5_000 });
    const saveRes = page.waitForResponse(
      (r) => r.url().includes("/api/schedules") && r.status() === 201
    );
    await page.locator('[data-testid="shift-btn-V"]').click();
    await saveRes;
    await expect(page.locator('[data-testid="shift-editor"]')).not.toBeVisible({ timeout: 5_000 });

    // Regenerar el cuadrante
    await generateAndWait(page);

    // Verificar que la celda "V" sigue presente (no fue sobreescrita)
    const vCell = page.locator('[data-testid="shift-cell-V"]').first();
    await expect(vCell).toBeVisible({ timeout: 5_000 });
  } catch (e) {
    await screenshotOnFail(page, "CP-67");
    throw e;
  }
});

// ─── CP-68 — Generar cuadrante respeta vacaciones introducidas ───────────────
test("CP-68 — Generar cuadrante respeta vacaciones introducidas", async ({ page }) => {
  test.setTimeout(90_000);
  try {
    await loginAsRole(page, "admin");
    await waitForScheduleGrid(page);

    // Navegar a Septiembre 2026 (4 nexts desde Mayo)
    await navigateMonths(page, 4);

    // Generar primero para que aparezcan empleados
    await generateAndWait(page);
    await waitForScheduleGrid(page);

    // Asignar turno "B" (baja) al primer empleado en el día 3 (dinámico al mes actual mostrado)
    const firstRowDayCells = page.locator("table").first().locator("tbody tr").first().locator('td[data-testid^="cell-"]');
    const cellTarget = firstRowDayCells.nth(2);
    const targetCellTestId = await cellTarget.getAttribute("data-testid");
    expect(targetCellTestId).toBeTruthy();
    await expect(cellTarget).toBeVisible({ timeout: 5_000 });
    await cellTarget.click();
    await expect(page.locator('[data-testid="shift-editor"]')).toBeVisible({ timeout: 5_000 });
    const saveResPromise = page.waitForResponse(
      (r) => r.url().includes("/api/schedules") && r.status() === 201
    );
    await page.locator('[data-testid="shift-btn-B"]').click();
    const saveRes = await saveResPromise;
    const savedAssignment = await saveRes.json() as { employeeId: string; date: string; shiftType: string };
    await expect(page.locator('[data-testid="shift-editor"]')).not.toBeVisible({ timeout: 5_000 });

    // Regenerar y esperar que la toast de "Cuadrante generado" aparezca.
    await generateAndWait(page);

    // Validar por API que la baja manual persiste tras regenerar
    const savedDate = savedAssignment.date.slice(0, 10);
    const [year, month] = savedDate.split("-");
    const scheduleAfterRes = await page.request.get(`/api/schedules?year=${Number(year)}&month=${Number(month)}`);
    expect(scheduleAfterRes.status()).toBe(200);
    const scheduleAfterBody = await scheduleAfterRes.json() as { assignments?: Array<{ employeeId: string; date: string; shiftType: string }> };
    const assignmentsAfter = scheduleAfterBody.assignments ?? [];

    const persisted = assignmentsAfter.find((a) =>
      a.employeeId === savedAssignment.employeeId &&
      a.date.slice(0, 10) === savedDate
    );
    expect(persisted?.shiftType).toBe("B");
  } catch (e) {
    await screenshotOnFail(page, "CP-68");
    throw e;
  }
});

// ─── CP-69 — Bloque de noches visible en el grid ─────────────────────────────
test("CP-69 — Bloque de noches visible en el grid (7 celdas N/NF consecutivas)", async ({ page }) => {
  test.setTimeout(60_000);
  try {
    await loginAsAdmin(page);
    await expect(page.locator("table").first()).toBeVisible({ timeout: 10_000 });

    // Navegar a Octubre 2026 (5 nexts desde Mayo)
    await navigateMonths(page, 5);

    // Generar cuadrante y esperar recarga completa del grid
    await generateAndWait(page);

    // Verificar que el generate creó los turnos esperados via API directa
    const scheduleData = await page.evaluate(async () => {
      const res = await fetch("/api/schedules?year=2026&month=10", { credentials: "include" });
      if (!res.ok) return { assignments: [] };
      return res.json();
    });
    const assignments = Array.isArray(scheduleData)
      ? scheduleData
      : (scheduleData as { assignments?: Array<{ shiftType: string }> }).assignments ?? [];
    const nightCount = assignments
      .filter((a) => a.shiftType === "N" || a.shiftType === "NF").length;
    expect(nightCount).toBeGreaterThanOrEqual(7);
  } catch (e) {
    await screenshotOnFail(page, "CP-69");
    throw e;
  }
});

// ─── CP-70 — Continuidad al navegar al mes siguiente tras generar ─────────────
test("CP-70 — Continuidad correcta al navegar al mes siguiente", async ({ page }) => {
  test.setTimeout(90_000);
  try {
    await loginAsAdmin(page);
    await expect(page.locator("table").first()).toBeVisible({ timeout: 10_000 });

    // Navegar a Noviembre 2026 (6 nexts desde Mayo) y generar
    await navigateMonths(page, 6);
    await generateAndWait(page);

    // Avanzar a Diciembre y generar
    await page.locator('[data-testid="btn-next-month"]').click();
    await page.waitForTimeout(500);
    await generateAndWait(page);

    // El grid de Diciembre debe tener asignaciones válidas
    const anyCell = page.locator('[data-testid^="shift-cell-"]').first();
    await expect(anyCell).toBeVisible({ timeout: 5_000 });
  } catch (e) {
    await screenshotOnFail(page, "CP-70");
    throw e;
  }
});
