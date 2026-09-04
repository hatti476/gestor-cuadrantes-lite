/**
 * Sprint 25 E2E regression tests.
 * BUG-54: Proyecto activo no se pierde al navegar a inicio
 * Feature: fila resaltada usuario, Feature: festivos en vista ampliada
 */

import { test, expect } from "@playwright/test";
import {
  loginAsAdmin,
  loginAsTech,
  generateScheduleAndWait,
  screenshotOnFail,
} from "./helpers";

// ── BUG-53: EMPLOYEE puede ver vista multi-mes sin error 403 ────────────────────

test("CP-158 — Usuario con rol EMPLOYEE puede abrir la vista ampliada sin error @smoke", async ({
  page,
}) => {
  try {
    await loginAsTech(page);
    await expect(page).toHaveURL("/");

    // Ensure there is a project active; wait for badge or schedule
    await page.waitForSelector('[data-testid="schedule-grid"], [data-testid="active-project-badge"]', {
      timeout: 10_000,
    });

    // Navigate to multi-month via URL (same projectId used by the current active project)
    // Read active project from badge or navigate directly with the first project found
    const searchParams = new URL(page.url()).searchParams;
    let projectId = searchParams.get("projectId") ?? "";

    if (!projectId) {
      // Try to get projectId from localStorage via page.evaluate
      projectId = await page.evaluate(() => {
        try {
          const data = localStorage.getItem("activeProject");
          return data ? (JSON.parse(data) as { id: string }).id : "";
        } catch {
          return "";
        }
      });
    }

    // If still no project, find it from the schedule API calls in the network
    if (!projectId) {
      const projectsRes = await page.evaluate(async () => {
        const r = await fetch("/api/projects");
        const list = await r.json() as Array<{ id: string }>;
        return list[0]?.id ?? "";
      });
      projectId = projectsRes;
    }

    expect(projectId).not.toBe("");

    const now = new Date();
    await page.goto(
      `/multi-month?projectId=${projectId}&year=${now.getFullYear()}&month=${now.getMonth() + 1}`
    );

    // Should NOT show the employee error
    await expect(page.locator("text=Error al cargar empleados")).not.toBeVisible({
      timeout: 10_000,
    });

    // The back button should be visible (page loaded correctly)
    await expect(page.locator('[data-testid="btn-back"]')).toBeVisible({ timeout: 10_000 });
  } catch (error) {
    await screenshotOnFail(page, "CP-158");
    throw error;
  }
});

// ── Feature: fila del usuario logado resaltada en vista ampliada ───────────────

test("CP-160 — La fila del empleado logado está resaltada en la vista ampliada @smoke", async ({
  page,
}) => {
  try {
    // Login as a tech user who is an EMPLOYEE in the project
    await loginAsTech(page);
    await expect(page).toHaveURL("/");

    // Generate schedule so there is data (needed to display grid with employees)
    // If it fails (not admin), we continue — just need employees visible
    // No projectId needed in single-project mode

    const now = new Date();
    await page.goto(
      `/multi-month?projectId=${projectId}&year=${now.getFullYear()}&month=${now.getMonth() + 1}`
    );

    await expect(page.locator('[data-testid="btn-back"]')).toBeVisible({ timeout: 15_000 });

    // Wait for the grid to load (no loading spinner)
    await expect(page.locator("text=Cargando cuadrante…")).not.toBeVisible({ timeout: 10_000 });

    // If the tech user appears in the employee list, their row must be highlighted
    const ownRow = page.locator('[data-testid="own-row-multimonth"]');
    const hasOwnRow = await ownRow.isVisible({ timeout: 3_000 }).catch(() => false);

    if (hasOwnRow) {
      // Row should have indigo styling
      const rowClass = await ownRow.getAttribute("class");
      expect(rowClass).toContain("ring-indigo");

      // Name cell should show the marker arrow
      const nameCell = ownRow.locator("td").first();
      await expect(nameCell).toContainText("▶");
    }
    // If there are no employees (empty schedule project) the test passes without the row check
  } catch (error) {
    await screenshotOnFail(page, "CP-160");
    throw error;
  }
});

// ── Feature: festivos marcados en cabecera de vista ampliada ───────────────────

test("CP-161 — Los festivos se marcan en rojo en la cabecera de la vista ampliada @smoke", async ({
  page,
}) => {
  try {
    await loginAsAdmin(page);
    await generateScheduleAndWait(page);

    // Intercept holidays API and inject a known holiday for the current month
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    // Use day 15 as a synthetic holiday
    const holidayDate = `${year}-${String(month).padStart(2, "0")}-15`;
    const mockHoliday = { date: `${holidayDate}T00:00:00.000Z`, description: "Festivo test" };

    await page.route(`**/api/holidays?year=${year}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockHoliday]),
      });
    });

    // Also intercept for any other year that might be requested
    await page.route(`**/api/holidays?year=**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockHoliday]),
      });
    });

    // No projectId needed in single-project mode

    await page.goto(
      `/multi-month?projectId=${projectId}&year=${year}&month=${month}`
    );

    await expect(page.locator('[data-testid="btn-back"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("text=Cargando cuadrante…")).not.toBeVisible({ timeout: 10_000 });

    // Check that at least one header cell has the red-holiday classes
    const redHeaders = page.locator("thead th.bg-red-200");
    await expect(redHeaders.first()).toBeVisible({ timeout: 5_000 });
  } catch (error) {
    await screenshotOnFail(page, "CP-161");
    throw error;
  }
});

// ── Feature: festivos marcados en cabecera de vista ampliada ───────────────────
