import { test, expect } from "@playwright/test";
import { loginAsAdmin, loginAsTech, loginAsViewer } from "./helpers";

const MULTI_MONTH_URL = "/multi-month?year=2026&month=5&span=3";

test.describe("@smoke Multi-Month View (Bug 2)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("@smoke AC-06/07/08/10: Carga /multi-month con span=3 → 3 meses visibles", async ({ page }) => {
    await page.goto(MULTI_MONTH_URL);
    await page.waitForLoadState("networkidle");

    const monthHeaders = page.locator("thead tr:first-child th[colspan]");
    await expect(monthHeaders).toHaveCount(3);

    const months = await monthHeaders.allTextContents();
    expect(months).toContain("Abril 2026");
    expect(months).toContain("Mayo 2026");
    expect(months).toContain("Junio 2026");
  });

  test("@smoke AC-10: Cambia span a 6 → 6 meses visibles", async ({ page }) => {
    await page.goto(MULTI_MONTH_URL);
    await page.waitForLoadState("networkidle");

    await page.selectOption("#span-select", "6");
    await page.waitForLoadState("networkidle");

    const monthHeaders = page.locator("thead tr:first-child th[colspan]");
    await expect(monthHeaders).toHaveCount(6);

    const months = await monthHeaders.allTextContents();
    expect(months).toContain("Marzo 2026");
    expect(months).toContain("Abril 2026");
    expect(months).toContain("Mayo 2026");
    expect(months).toContain("Junio 2026");
    expect(months).toContain("Julio 2026");
    expect(months).toContain("Agosto 2026");
  });

  test("@smoke AC-11: Navega a mes distinto via URL params → recarga vista", async ({ page }) => {
    await page.goto(MULTI_MONTH_URL);
    await page.waitForLoadState("networkidle");

    await page.goto("/multi-month?year=2026&month=11&span=3");
    await page.waitForLoadState("networkidle");

    const monthHeaders = page.locator("thead tr:first-child th[colspan]");
    const months = await monthHeaders.allTextContents();
    expect(months).toContain("Octubre 2026");
    expect(months).toContain("Noviembre 2026");
    expect(months).toContain("Diciembre 2026");
  });

  test("@smoke AC-12: Botón 'Volver' navega a home '/'", async ({ page }) => {
    await page.goto(MULTI_MONTH_URL);
    await page.waitForLoadState("networkidle");

    await page.click('[data-testid="btn-back"]');
    await page.waitForURL("/");
    await expect(page).toHaveURL("/");
  });

  test("@smoke AC-13: TECNICO puede ver (read-only)", async ({ page }) => {
    await loginAsTech(page);
    await page.goto(MULTI_MONTH_URL);
    await page.waitForLoadState("networkidle");

    const monthHeaders = page.locator("thead tr:first-child th[colspan]");
    await expect(monthHeaders).toHaveCount(3);
  });

  test("@smoke AC-13: VIEWER puede ver (read-only)", async ({ page }) => {
    await loginAsViewer(page);
    await page.goto(MULTI_MONTH_URL);
    await page.waitForLoadState("networkidle");

    const monthHeaders = page.locator("thead tr:first-child th[colspan]");
    await expect(monthHeaders).toHaveCount(3);
  });

  test("@smoke AC-14: Header sincronizado — sin selector de proyecto", async ({ page }) => {
    await page.goto(MULTI_MONTH_URL);
    await page.waitForLoadState("networkidle");

    const projectSelectors = page.locator("select:has(option[value*='project'])");
    await expect(projectSelectors).toHaveCount(0);
  });
});