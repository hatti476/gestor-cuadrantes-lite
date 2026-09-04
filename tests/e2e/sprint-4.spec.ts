import { test, expect } from "@playwright/test";
import { USERS, ROUTES } from "./config";
import {
  generateScheduleAndWait,
  loginAsAdmin,
  openShiftEditorFromEditableCell,
  screenshotOnFail,
} from "./helpers";
import { loginAs as loginAsRole } from "./helpers/auth-utils";
import { waitForGenerationComplete, waitForScheduleGrid } from "./helpers/wait-utils";

const { tech: TECH } = USERS;

// ─── CP-30 — Admin puede añadir un festivo ───────────────────────────────────
test("CP-30 — Admin puede añadir un festivo", async ({ page }) => {
  try {
    await loginAsAdmin(page);
    await page.locator('[data-testid="btn-holidays"]').click();
    // La primera carga de /holidays puede compilar el módulo en dev — timeout generoso
    await expect(page).toHaveURL("/holidays", { timeout: 20_000 });

    await page.locator('[data-testid="holiday-date-input"]').fill("2026-12-25");
    await page.locator('[data-testid="holiday-desc-input"]').fill("Navidad (QA)");
    await page.locator('[data-testid="btn-add-holiday"]').click();

    // El festivo aparece en la tabla
    await expect(page.locator("text=Navidad (QA)")).toBeVisible({ timeout: 6_000 });
    // Toast de éxito
    await expect(page.locator('[data-testid="toast"]')).toBeVisible({ timeout: 5_000 });
  } catch (e) {
    await screenshotOnFail(page, "CP-30");
    throw e;
  }
});

// ─── CP-31 — Admin puede eliminar un festivo ─────────────────────────────────
test("CP-31 — Admin puede eliminar un festivo", async ({ page }) => {
  try {
    await loginAsAdmin(page);
    await page.goto("/holidays");

    // Asegurar que hay al menos un festivo (el de CP-30 puede haber quedado)
    // Si no hay, lo añadimos
    const noHolidays = page.locator('[data-testid="no-holidays"]');
    if (await noHolidays.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await page.locator('[data-testid="holiday-date-input"]').fill("2026-11-01");
      await page.locator('[data-testid="holiday-desc-input"]').fill("Todos los Santos (QA)");
      await page.locator('[data-testid="btn-add-holiday"]').click();
      await expect(page.locator("text=Todos los Santos (QA)")).toBeVisible({ timeout: 6_000 });
    }

    // Eliminar el primer botón de eliminar visible
    const deleteBtn = page.locator("button:has-text('Eliminar')").first();
    await deleteBtn.click();

    // El toast de éxito aparece
    await expect(page.locator('[data-testid="toast"]')).toBeVisible({ timeout: 5_000 });
  } catch (e) {
    await screenshotOnFail(page, "CP-31");
    throw e;
  }
});

// ─── CP-32 — La generación respeta festivos (M→MF) ───────────────────────────
test("CP-32 — La generación respeta los festivos (M→MF)", async ({ page }) => {
  test.setTimeout(60_000);
  try {
    await loginAsAdmin(page);

    // Añadir festivo el día 1 de Noviembre 2026
    await page.goto("/holidays");
    const yearSelect = page.locator("select");
    await yearSelect.selectOption("2026");

    // Añadir festivo el 1 de Noviembre
    await page.locator('[data-testid="holiday-date-input"]').fill("2026-11-01");
    await page.locator('[data-testid="holiday-desc-input"]').fill("Festivo test generación");
    await page.locator('[data-testid="btn-add-holiday"]').click();
    await expect(page.locator("text=Festivo test generación")).toBeVisible({ timeout: 6_000 });

    // Ir al cuadrante de Noviembre 2026 (6 nexts desde Mayo)
    await page.goto("/");
    await expect(page.locator("table").first()).toBeVisible({ timeout: 10_000 });
    for (let i = 0; i < 6; i++) {
      await page.locator('[data-testid="btn-next-month"]').click();
      await page.waitForTimeout(400);
    }

    // Generar
    await generateScheduleAndWait(page);
    await expect(page.locator('[data-testid="toast"]').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("table").first()).toBeVisible({ timeout: 10_000 });

    // Verificar que el día 1 tiene MF, TF o NF (festivo) en al menos un empleado
    // (puede ser D si ese empleado descansa, lo cual también es válido)
    const day1Cells = page.locator("table").first().locator("tbody tr").first().locator("td").nth(1);
    await expect(day1Cells).toBeVisible({ timeout: 5_000 });
    // MF, TF, NF o D (válidos todos para un festivo)
    const validOnHoliday = ["MF", "TF", "NF", "D", ""];
    const shiftCell = day1Cells.locator("[data-testid^='shift-cell-']");
    const testId = await shiftCell.getAttribute("data-testid").catch(() => null);
    if (testId) {
      const shiftType = testId.replace("shift-cell-", "");
      expect(validOnHoliday).toContain(shiftType);
    }
  } catch (e) {
    await screenshotOnFail(page, "CP-32");
    throw e;
  }
});

// ─── CP-33 — Exportar CSV descarga el fichero ────────────────────────────────
test("CP-33 — Exportar CSV descarga el fichero correcto", async ({ page }) => {
  try {
    await loginAsAdmin(page);
    await expect(page.locator("table").first()).toBeVisible({ timeout: 10_000 });

    // Interceptar la descarga
    const downloadPromise = page.waitForEvent("download", { timeout: 8_000 });
    await page.locator('[data-testid="btn-export-csv"]').click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/cuadrante-2026-\d{2}\.csv/);
  } catch (e) {
    await screenshotOnFail(page, "CP-33");
    throw e;
  }
});

// ─── CP-34 — Historial registra cambios de turno ─────────────────────────────
test("CP-34 — Historial registra cambios de turno", async ({ page }) => {
  test.setTimeout(45_000);
  try {
    await loginAsAdmin(page);
    await expect(page.locator("table").first()).toBeVisible({ timeout: 10_000 });
    await page.waitForLoadState("networkidle");
    // Esperar que el cuadrante cargue: al menos 1 fila con empleado
    await expect(page.locator("table").first().locator("tbody tr").first().locator("td").first()).not.toBeEmpty({ timeout: 8_000 });

    // Abrir editor desde una celda editable para evitar celdas bloqueadas.
    await openShiftEditorFromEditableCell(page);
    await expect(page.locator('[data-testid="shift-editor"]')).toBeVisible({ timeout: 5_000 });
    // Esperar respuesta del servidor antes de navegar
    const saveResponse = page.waitForResponse((r) => r.url().includes("/api/schedules") && r.status() === 201);
    await page.locator('[data-testid="shift-btn-V"]').click();
    const savedRes = await saveResponse;
    const savedData = await savedRes.json();
    const savedEmployeeId = savedData.employeeId;
    await expect(page.locator('[data-testid="shift-editor"]')).not.toBeVisible({ timeout: 5_000 });

    // Validar historial por API (más estable que depender del botón en UI)
    const historyResp = await page.request.get(`/api/schedules?year=2027&month=2`);
    expect(historyResp.status()).toBe(200);
    expect(beforeResponse.status()).toBe(200);
    const beforeData = (await historyResp.json()) as {
      assignments?: Array<{ employeeId: string; date: string; shiftType: string }>;
    };
    const assignmentsBefore = beforeData.assignments ?? [];

    const nightOnEve = assignmentsBefore.find(
      (assignment) => assignment.date.slice(0, 10) === "2027-02-15" && assignment.shiftType === "N"
    );
    expect(nightOnEve).toBeTruthy();

    // Añadir festivo el día 16 de Febrero 2027 (idempotente)
    const addHoliday = await page.request.post("/api/holidays", {
      data: { date: "2027-02-16", description: "Festivo CP-37" },
    });
    expect([200, 201, 409]).toContain(addHoliday.status());

    // Recargar cuadrante y validar que el turno N de la víspera pasó a NF
    await page.reload();
    await waitForScheduleGrid(page);

        const afterResponse = await page.request.get(
      `/api/schedules?year=2027&month=2`);
    expect(afterResponse.status()).toBe(200);
    const afterData = (await afterResponse.json()) as {
      assignments?: Array<{ employeeId: string; date: string; shiftType: string }>;
    };
    const assignmentsAfter = afterData.assignments ?? [];

    const eveAfter = assignmentsAfter.find(
      (assignment) =>
        assignment.employeeId === nightOnEve?.employeeId &&
        assignment.date.slice(0, 10) === "2027-02-15"
    );
    expect(eveAfter?.shiftType).toBe("NF");
  } catch (e) {
    await screenshotOnFail(page, "CP-37");
    throw e;
  }
});

// ─── CP-38 — Cabecera roja en días festivos con día de la semana visible ──────
test("CP-38 — El grid muestra cabecera roja con letra del día en festivos", async ({ page }) => {
  try {
    await loginAsRole(page, "super_admin");

    // Asegurar festivo en noviembre para que exista al menos una cabecera en rojo.
    const holidayDate = "2026-11-03";
    const addHoliday = await page.request.post("/api/holidays", {
      data: { date: holidayDate, description: "Festivo CP-38" },
    });
    expect([200, 201, 409]).toContain(addHoliday.status());
    const holidaysResp = await page.request.get("/api/holidays?year=2026");
    expect(holidaysResp.status()).toBe(200);
    const holidays = await holidaysResp.json() as Array<{ date: string; description: string }>;
    expect(holidays.some((h) => h.date.slice(0, 10) === holidayDate)).toBe(true);

    // Ir a Noviembre 2026 de forma determinista.
    await waitForScheduleGrid(page);
    const monthTitle = page.locator("h2").first();
    for (let i = 0; i < 18; i++) {
      const title = (await monthTitle.innerText()).trim();
      if (title === "Noviembre 2026") {
        break;
      }
      await page.locator('[data-testid="btn-next-month"]').click();
      await page.waitForTimeout(250);
    }
    await expect(monthTitle).toHaveText("Noviembre 2026", { timeout: 8_000 });
    await page.waitForLoadState("networkidle");
    await waitForScheduleGrid(page);

    // Debe existir al menos una cabecera marcada como festiva (fondo rojo).
    const headers = page.locator("table thead tr th");
    const headerCount = await headers.count();
    let firstHolidayHeaderIndex = -1;
    for (let i = 1; i < headerCount; i++) {
      const classes = await headers.nth(i).getAttribute("class");
      if ((classes ?? "").match(/bg-red-(100|200)/)) {
        firstHolidayHeaderIndex = i;
        break;
      }
    }
    expect(firstHolidayHeaderIndex).toBeGreaterThan(0);

    // La cabecera festiva debe mostrar la letra del día de la semana (no "F")
    const holidayHeader = headers.nth(firstHolidayHeaderIndex);
    const dayLetter = await holidayHeader.locator("div").nth(1).innerText();
    expect(["L", "M", "X", "J", "V", "S", "D"]).toContain(dayLetter.trim());
  } catch (e) {
    await screenshotOnFail(page, "CP-38");
    throw e;
  }
});

// ─── CP-39 — Popover con nombre del festivo al pulsar la cabecera ─────────────
test("CP-39 — Pulsar la cabecera de un festivo muestra su nombre en un popover", async ({ page }) => {
  try {
    await loginAsAdmin(page);

    // Asegurar un festivo conocido en Noviembre 2026 para evitar dependencias de otros casos.
    const ensureHolidayRes = await page.request.post("/api/holidays", {
      data: { date: "2026-11-01", description: "Festivo popover CP-39" },
    });
    expect([201, 409]).toContain(ensureHolidayRes.status());

    // Ir a Noviembre 2026
    await expect(page.locator("table").first()).toBeVisible({ timeout: 10_000 });
    for (let i = 0; i < 6; i++) {
      await page.locator('[data-testid="btn-next-month"]').click();
      await page.waitForTimeout(400);
    }
    await expect(page.locator("table").first()).toBeVisible({ timeout: 8_000 });

    await page.waitForTimeout(500); // dar tiempo a que carguen los festivos

    // Pulsar cabecera del día 1 (nth(0)=Empleado, nth(1)=día 1).
    const holidayHeader = page.locator("table thead tr th").nth(1);
    await holidayHeader.click();

    // El popover debe aparecer con el texto "Festivo"
    const holidayPopoverTitle = page.locator("div:text('🎉 Festivo')");
    await expect(holidayPopoverTitle).toBeVisible({ timeout: 4_000 });
    const holidayPopoverDesc = holidayPopoverTitle.locator("..").locator("div").nth(1);
    await expect(holidayPopoverDesc).not.toBeEmpty();
  } catch (e) {
    await screenshotOnFail(page, "CP-39");
    throw e;
  }
});
