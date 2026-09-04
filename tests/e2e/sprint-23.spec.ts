import { test, expect } from "@playwright/test";
import { loginAsAdmin, loginAsTech, generateScheduleAndWait, screenshotOnFail } from "./helpers";

test("CP-143 — Generación mensual no deja celdas vacías en el grid @smoke", async ({ page }) => {
  try {
    await loginAsAdmin(page);
    await expect(page).toHaveURL("/");

    await generateScheduleAndWait(page);

    const grid = page.locator('[data-testid="schedule-grid"]');
    await expect(grid).toBeVisible({ timeout: 10_000 });

    const emptyCells = grid.locator('td[data-testid^="cell-"]:not(:has([data-testid^="shift-cell-"]))');
    await expect(emptyCells).toHaveCount(0);
  } catch (error) {
    await screenshotOnFail(page, "CP-143");
    throw error;
  }
});

test("CP-144 — Grid mantiene celdas cuadradas en ultrawide @smoke", async ({ page }) => {
  try {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await loginAsAdmin(page);
    await expect(page).toHaveURL("/");

    await generateScheduleAndWait(page);

    const grid = page.locator('[data-testid="schedule-grid"]');
    const firstCell = grid.locator('td[data-testid^="cell-"]').first();
    await expect(firstCell).toBeVisible({ timeout: 10_000 });

    const compactWidth = await firstCell.boundingBox().then((box) => box?.width ?? 0);
    const compactGridWidth = await grid.boundingBox().then((box) => box?.width ?? 0);

    await page.setViewportSize({ width: 2560, height: 1080 });
    await page.waitForTimeout(500);

    const wideWidth = await firstCell.boundingBox().then((box) => box?.width ?? 0);
    const wideGridWidth = await grid.boundingBox().then((box) => box?.width ?? 0);

    expect(Math.abs(wideWidth - compactWidth)).toBeLessThanOrEqual(1);
    expect(wideGridWidth).toBeLessThan(2560);
    expect(compactGridWidth).toBeLessThan(1920);
  } catch (error) {
    await screenshotOnFail(page, "CP-144");
    throw error;
  }
});

test("CP-145 — ADMIN publica un mes generado @smoke", async ({ page }) => {
  try {
    await loginAsAdmin(page);
    await expect(page).toHaveURL("/");

    await generateScheduleAndWait(page);

    const badge = page.locator('[data-testid="publication-status-badge"]');
    await expect(badge).toHaveText("No publicado");

    const publishResponse = page.waitForResponse((response) => response.url().includes("/api/schedules/publish") && response.status() === 200);
    await page.getByTestId("btn-toggle-publication").click();
    await publishResponse;

    await expect(badge).toHaveText("Publicado");
    await expect(page.getByTestId("btn-toggle-publication")).toHaveText("Despublicar");
  } catch (error) {
    await screenshotOnFail(page, "CP-145");
    throw error;
  }
});

test("CP-146 — TECNICO ve Cuadrante no disponible aún cuando no está publicado @smoke", async ({ page }) => {
  try {
    // Usar contexto de página fresh para evitar estado compartido
    // Navegar a login (esto limpia sesión anterior)
    await page.goto("/login");
    
    // Login como técnico
    await loginAsTech(page);
    await expect(page).toHaveURL("/");

    // Buscar un mes no publicado navegando desde mayo
    // Si mayo está publicado (por CP-145), vamos a junio que no estará publicado
    const unpublishedMsg = page.getByTestId("unpublished-message");
    let found = await unpublishedMsg.isVisible({ timeout: 2_000 }).catch(() => false);

    if (!found) {
      // Navegar a junio
      await page.getByTestId("btn-next-month").click();
      await page.waitForTimeout(500);
      found = await unpublishedMsg.isVisible({ timeout: 5_000 }).catch(() => false);
    }

    // Debe encontrarse un mes no publicado
    expect(found).toBe(true);
    await expect(unpublishedMsg).toBeVisible();
    await expect(page.getByTestId("schedule-grid")).not.toBeVisible();
  } catch (error) {
    await screenshotOnFail(page, "CP-146");
    throw error;
  }
});

test("CP-148 — Cerrar sesión siempre redirige a /login desde cualquier vista", async ({ page }) => {
  try {
    await loginAsAdmin(page);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin/);

    await page.getByRole("button", { name: /cerrar sesión/i }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 12_000 });
    await expect(page.getByRole("button", { name: /entrar/i })).toBeVisible({ timeout: 5_000 });
  } catch (error) {
    await screenshotOnFail(page, "CP-148");
    throw error;
  }
});

