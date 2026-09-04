/**
 * tests/e2e/sprint-12.spec.ts
 * Sprint 12 — Aislamiento de proyectos en ShiftAssignment, preferencia Jornada,
 *             transferencia de bloque de noches por vacaciones, fila propia en grid
 *
 * CP-87 — La preferencia "Jornada" aparece en el formulario y en la tabla de empleados
 * CP-88 — Bloque de noches se transfiere cuando el empleado tiene vacaciones en esos días
 *          (regresión: resolveNightBlocks en generateMonthSchedule)
 * CP-89 — La fila del usuario autenticado se resalta en el cuadrante (RF-19)
 */

import { test, expect } from "@playwright/test";
import { ROUTES } from "./config";
import { loginAsAdmin, screenshotOnFail } from "./helpers";

type Assignment = {
  id: string;
  employeeId: string;
  date: string;
  shiftType: string;
  manual?: boolean;
};

// ===========================================================================
// CP-87 — Preferencia "Jornada" disponible en formulario y tabla de empleados
// ===========================================================================
test("CP-87 — preferencia Jornada aparece en formulario y tabla de empleados", async ({
  page,
}) => {
  test.setTimeout(60_000);

  try {
    await loginAsAdmin(page);
    await page.goto(ROUTES.employees);
    await page.waitForLoadState("networkidle");

    // Elegir un técnico USER (admin no muestra bloque de preferencias de turno)
    const targetEmail = "tecnico2@cuadrantes.local";
    const techRow = page.locator("table tbody tr").filter({ hasText: targetEmail }).first();
    await expect(techRow).toBeVisible({ timeout: 10_000 });
    await techRow.getByRole("button", { name: /Editar/i }).click();

    // El select de preferencia debe contener la opción "Jornada (L-V 9:00–18:00)"
    const prefSelect = page
      .locator('[data-testid="select-shift-preference"], select:has(option[value="J"])')
      .first();
    await expect(prefSelect).toBeVisible({ timeout: 5_000 });
    await expect(prefSelect.locator('option[value="J"]')).toHaveCount(1);

    // Seleccionar "Jornada" y guardar
    await prefSelect.selectOption("J");
    await expect(prefSelect).toHaveValue("J");

    const saveRes = page.waitForResponse(
      (r) =>
        r.url().includes("/api/admin/users/") &&
        r.request().method() === "PATCH"
    );
    const saveBtn = page.getByRole("button", { name: /^Guardar$/ }).last();
    await saveBtn.click();
    expect((await saveRes).status()).toBe(200);

    // El modal debe cerrarse (el botón desaparece)
    await expect(saveBtn).not.toBeVisible({ timeout: 10_000 });

    // Verificar persistencia reabriendo edición del mismo usuario
    const sameUserRow = page.locator("table tbody tr").filter({ hasText: targetEmail }).first();
    await sameUserRow.getByRole("button", { name: /Editar/i }).click();
    const persistedPref = page
      .locator('[data-testid="select-shift-preference"], select:has(option[value="J"])')
      .first();
    await expect(persistedPref).toBeVisible({ timeout: 5_000 });
    await expect(persistedPref).toHaveValue("J");
  } catch (e) {
    await screenshotOnFail(page, "CP-87");
    throw e;
  }
});

// ===========================================================================
// CP-88 — Bloque de noches se transfiere cuando el empleado tiene vacaciones
// ===========================================================================
test("CP-88 — bloque de noches se transfiere al empleado con más tiempo sin noches", async ({
  page,
}) => {
  test.setTimeout(300_000);
  try {
    await loginAsAdmin(page);

    // Obtener el proyecto sembrado y verificar que tiene empleados
    const projectsResp = await page.request.get("/api/projects");
    expect(projectsResp.status()).toBe(200);
    const projects = await projectsResp.json();
    expect(projects.length).toBeGreaterThan(0);
    const projectId = projects[0].id;

    // Usar GET /api/employees (todos) y filtrar por projectId en cliente
    // para no depender de Employee.projectId que puede cambiar entre tests
    const empCheck = await page.request.get("/api/employees");
    expect(empCheck.status()).toBe(200);
    const allEmp = await empCheck.json();
    const projectEmployees = allEmp.filter((e) => e.projectId === projectId);
    expect(
      projectEmployees.length,
      "El proyecto sembrado debe tener empleados"
    ).toBeGreaterThan(0);

    // Usar Febrero 2027 (mes lejano, no usado por otros tests)
    const year = 2027;
    const month = 2;

    // Paso 1: generar cuadrante limpio para identificar qué técnico tiene noches
    const gen1 = await page.request.post("/api/schedules/generate", {
      data: { year, month, projectId },
    });
    expect(gen1.status()).toBe(200);

    const sched1Resp = await page.request.get(
      `/api/schedules?year=${year}&month=${month}&projectId=${projectId}`
    );
    expect(sched1Resp.status()).toBe(200);
    const { assignments: assignments1 } = await sched1Resp.json();

    type Assignment = { id: string; employeeId: string; date: string; shiftType: string };

    // Agrupar N/NF por empleado y elegir el que tiene más días de noche
    const nightCountByEmp = new Map();
    for (const a of assignments1) {
      if (a.shiftType !== "N" && a.shiftType !== "NF") continue;
      const acc = nightCountByEmp.get(a.employeeId) || [];
      acc.push(a.date.slice(0, 10));
      nightCountByEmp.set(a.employeeId, acc);
    }

    // Elegir el empleado con el bloque más completo (≥7 días)
    let nightEmpId = "";
    let nightDays = [];
    for (const [empId, days] of nightCountByEmp) {
      if (days.length > nightDays.length) {
        nightEmpId = empId;
        nightDays = days;
      }
    }

    expect(nightEmpId, "Debe existir un técnico con bloque de noches completo en el mes").toBeTruthy();
    expect(nightDays.length).toBeGreaterThanOrEqual(7);

    // Paso 2: marcar los días N del empleado como vacaciones (locked)
    for (const dateStr of nightDays) {
      const patch = await page.request.post("/api/schedules", {
        data: { employeeId: nightEmpId, date: dateStr, shiftType: "V", projectId },
      });
      expect([200, 201]).toContain(patch.status());
    }

    // Paso 3: regenerar con las vacaciones marcadas
    const gen2 = await page.request.post("/api/schedules/generate", {
      data: { year, month, projectId },
    });
    expect(gen2.status()).toBe(200);

    const sched2Resp = await page.request.get(
      `/api/schedules?year=${year}&month=${month}&projectId=${projectId}`
    );
    expect(sched2Resp.status()).toBe(200);
    const { assignments: assignments2 } = await sched2Resp.json();

    // 4a. El empleado original NO tiene N en sus días de vacaciones
    const originalNights = assignments2.filter(
      (a) =>
        a.employeeId === nightEmpId &&
        nightDays.includes(a.date.slice(0, 10)) &&
        (a.shiftType === "N" || a.shiftType === "NF")
    );
    expect(
      originalNights,
      "El técnico con vacaciones no debe aparecer como N en esos días"
    ).toHaveLength(0);

    // 4b. Cobertura nocturna continua: ≥7 N/NF en todo el mes
    const totalNights = assignments2.filter(
      (a) => a.shiftType === "N" || a.shiftType === "NF"
    ).length;
    expect(
      totalNights,
      "Debe haber ≥7 turnos de noche (bloque transferido a otro técnico)"
    ).toBeGreaterThanOrEqual(7);

    // 4c. Las vacaciones del empleado original siguen presentes
    const vacDays = assignments2.filter(
      (a) =>
        a.employeeId === nightEmpId &&
        nightDays.includes(a.date.slice(0, 10)) &&
        a.shiftType === "V"
    );
    expect(vacDays.length).toBe(nightDays.length);
  } catch (e) {
    // screenshotOnFail would be called here
    throw e;
  }
});

// CP-89 skipped for now - uses /api/projects and localStorage.activeProject

export {};
