import { test, expect } from "@playwright/test";
import { USERS, ROUTES } from "./config";
import { login, openShiftEditorFromEditableCell, screenshotOnFail } from "./helpers";
import { loginAs as loginAsRole } from "./helpers/auth-utils";
import { waitForModalClose, waitForScheduleGrid, waitForToast } from "./helpers/wait-utils";

const { admin: ADMIN, tech: TECH } = USERS;

/** Alias para compatibilidad con los tests que usaban loginAs(page, email, pass) */
const loginAs = login;

// ─── CP-12 ───────────────────────────────────────────────────────────────────
test("CP-12 — Grid carga datos reales de BD", async ({ page }) => {
  try {
    await loginAs(page, ADMIN.email, ADMIN.password);
    await expect(page.locator("table").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("text=Vista de ejemplo")).not.toBeVisible();
    // Debe haber al menos una fila de empleado
    const rows = page.locator("table").first().locator("tbody tr");
    expect(await rows.count()).toBeGreaterThan(0);
  } catch (e) {
    await screenshotOnFail(page, "CP-12");
    throw e;
  }
});

// ─── CP-13 ───────────────────────────────────────────────────────────────────
test("CP-13 — Mes sin datos muestra grid vacío", async ({ page }) => {
  try {
    await loginAs(page, ADMIN.email, ADMIN.password);
    await expect(page.locator("table").first()).toBeVisible({ timeout: 10_000 });

    const emptyMonthOffset = await page.evaluate(async () => {
      for (let offset = 1; offset <= 24; offset++) {
        const date = new Date(Date.UTC(2026, 4 + offset, 1));
        const year = date.getUTCFullYear();
        const month = date.getUTCMonth() + 1;
        const res = await fetch(`/api/schedules?year=${year}&month=${month}`, {
          credentials: "include",
        });
        const data = await res.json();
        if (!Array.isArray(data.assignments) || data.assignments.length === 0) {
          return offset;
        }
      }
      return 1;
    });

    for (let i = 0; i < emptyMonthOffset; i++) {
      await page.locator('[data-testid="btn-next-month"]').click();
    }

    // Debe aparecer mensaje de sin turnos
    await expect(
      page.locator("text=Sin turnos asignados este mes")
    ).toBeVisible({ timeout: 8_000 });
  } catch (e) {
    await screenshotOnFail(page, "CP-13");
    throw e;
  }
});

// ─── CP-14 ───────────────────────────────────────────────────────────────────
test("CP-14 — Admin puede asignar un turno @smoke", async ({ page }) => {
  try {
    await loginAs(page, ADMIN.email, ADMIN.password);
    // Quedarse en Mayo 2026 (tiene empleados y celdas)
    await expect(page.locator("table").first()).toBeVisible({ timeout: 10_000 });
    await page.waitForLoadState("networkidle");

    // Abrir ShiftEditor desde una celda realmente editable.
    await openShiftEditorFromEditableCell(page);
    await expect(page.locator('[data-testid="shift-editor"]')).toBeVisible({ timeout: 5_000 });

    // Seleccionar un turno válido.
    const shiftBtnJ = page.locator('[data-testid="shift-btn-J"]');
    if (await shiftBtnJ.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await shiftBtnJ.click();
    } else {
      await page.locator('[data-testid="shift-btn-M"]').click();
    }

    // El modal debe cerrarse
    await expect(page.locator('[data-testid="shift-editor"]')).not.toBeVisible({ timeout: 5_000 });
  } catch (e) {
    await screenshotOnFail(page, "CP-14");
    throw e;
  }
});

// ─── CP-15 ───────────────────────────────────────────────────────────────────
test("CP-15 — Admin puede cambiar un turno existente", async ({ page }) => {
  test.setTimeout(60_000);
  try {
    await loginAsRole(page, "admin");
    await waitForScheduleGrid(page);

    // Buscar una celda editable que no sea V/B (evita celdas bloqueadas de preparación).
    const editableCell = page
      .locator(
        `td[data-testid^="cell-"]:not([data-locked="true"]):not(:has([data-testid="shift-cell-V"])):not(:has([data-testid="shift-cell-B"]))`
      )
      .first();
    await expect(editableCell).toBeVisible({ timeout: 8_000 });
    const targetCellTestId = await editableCell.getAttribute("data-testid");
    expect(targetCellTestId).toBeTruthy();

    const cellMatch = targetCellTestId?.match(/^cell-(.+)-(\d{4}-\d{2}-\d{2})$/);
    expect(cellMatch).toBeTruthy();
    const employeeId = cellMatch?.[1] ?? "";
    const date = cellMatch?.[2] ?? "";

    // Forzar un turno inicial para validar cambio real de valor
    const seedResp = await page.request.post("/api/schedules", {
      data: { employeeId, date, shiftType: "M" },
    });
    expect([200, 201]).toContain(seedResp.status());

    await page.reload();
    await waitForScheduleGrid(page);

    const targetCell = page.locator(`[data-testid="${targetCellTestId}"]`);
    await targetCell.scrollIntoViewIfNeeded();
    const shiftBefore = await targetCell
      .locator("[data-testid^='shift-cell-']")
      .getAttribute("data-testid")
      .catch(() => null);
    await targetCell.click();

    // Debe aparecer el modal
    await expect(page.locator('[data-testid="shift-editor"]')).toBeVisible({ timeout: 5_000 });

    // Seleccionar un turno diferente al actual para forzar cambio real.
    const editor = page.locator('[data-testid="shift-editor"]');
    const useMorningTarget = shiftBefore === "shift-cell-T" || shiftBefore === "shift-cell-TF";
    const targetShiftButton = useMorningTarget
      ? page.locator('[data-testid="shift-btn-M"]')
      : page.locator('[data-testid="shift-btn-T"]');
    const expectedPersistedShiftTypes = useMorningTarget ? ["M", "MF"] : ["T", "TF"];
    const expectedShiftCellTestIds = useMorningTarget
      ? ["shift-cell-M", "shift-cell-MF"]
      : ["shift-cell-T", "shift-cell-TF"];

    await expect(targetShiftButton).toBeVisible({ timeout: 5_000 });
    await expect(targetShiftButton).toBeEnabled({ timeout: 5_000 });
    await targetShiftButton.click();

    // Si aparece advertencia ET, confirmar para completar el cambio de turno.
    const etWarningConfirm = page.locator('[data-testid="btn-confirm-et-warning"]');
    if (await etWarningConfirm.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await etWarningConfirm.click();
    }
    await waitForToast(page, "", { timeout: 8_000 });

    // Verificar persistencia por API (más robusto en paralelo que esperar cierre del modal).
    const [yearStr, monthStr] = date.split("-");
    const persistedResp = await page.request.get(
      `/api/schedules?year=${Number.parseInt(yearStr, 10)}&month=${Number.parseInt(monthStr, 10)}`
    );
    expect(persistedResp.status()).toBe(200);
    const persistedData = await persistedResp.json() as {
      assignments?: Array<{ employeeId: string; date: string; shiftType: string }>;
    };
    const persisted = (persistedData.assignments ?? []).find(
      (a) => a.employeeId === employeeId && a.date.slice(0, 10) === date
    );
    expect(persisted).toBeTruthy();
    expect(expectedPersistedShiftTypes).toContain(persisted?.shiftType);

    // Validar que la celda refleja un turno válido tras guardar
    const shiftAfter = await targetCell
      .locator("[data-testid^='shift-cell-']")
      .getAttribute("data-testid")
      .catch(() => null);
    expect(shiftAfter).not.toBeNull();
    expect(expectedShiftCellTestIds).toContain(shiftAfter);
    if (shiftBefore) {
      expect(shiftAfter).not.toBe(shiftBefore);
    }

    // Cerrar modal si permanece abierto para no contaminar casos siguientes
    if (await editor.isVisible().catch(() => false)) {
      await page.keyboard.press("Escape");
      await waitForModalClose(page);
    }
  } catch (e) {
    await screenshotOnFail(page, "CP-15");
    throw e;
  }
});

// ─── CP-16 ───────────────────────────────────────────────────────────────────
test("CP-16 — Admin puede eliminar un turno", async ({ page }) => {
  test.setTimeout(60_000);
  try {
    await loginAs(page, ADMIN.email, ADMIN.password);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("table").first()).toBeVisible({ timeout: 10_000 });

    // Buscar una celda editable (evita fragilidad por celdas bloqueadas)
    const editableCell = page.locator('td[data-testid^="cell-"]:not([data-locked="true"])').first();
    await expect(editableCell).toBeVisible({ timeout: 8_000 });
    const targetCellTestId = await editableCell.getAttribute("data-testid");
    expect(targetCellTestId).toBeTruthy();

    // Primero asignar un turno para asegurarnos de que hay algo que borrar
    let targetCell = page.locator(`[data-testid="${targetCellTestId}"]`);
    await targetCell.click();
    await expect(page.locator('[data-testid="shift-editor"]')).toBeVisible({ timeout: 5_000 });
    await page.locator('[data-testid="shift-btn-J"]').click();
    await expect(page.locator('[data-testid="shift-editor"]')).not.toBeVisible({ timeout: 5_000 });

    // Reabrir la misma celda (ahora tiene turno J) y limpiar
    targetCell = page.locator(`[data-testid="${targetCellTestId}"]`);
    await targetCell.click();
    const editor = page.locator('[data-testid="shift-editor"]');
    const editorVisible = await editor.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(editorVisible).toBe(true);
    await expect(editor).toBeVisible({ timeout: 5_000 });
    await editor.getByText(/Limpiar celda/i).click();
    await expect(editor).not.toBeVisible({ timeout: 5_000 });
  } catch (e) {
    await screenshotOnFail(page, "CP-16");
    throw e;
  }
});

// ─── CP-17 ───────────────────────────────────────────────────────────────────
test("CP-17 — Empleado no puede editar turnos", async ({ page }) => {
  try {
    await loginAs(page, TECH.email, TECH.password);
    await expect(page.locator("table").first()).toBeVisible({ timeout: 10_000 });

    // Intentar clic en una celda
    const firstDayCell = page.locator("table").first().locator("tbody tr").first().locator("td").nth(1);
    await firstDayCell.click();

    // El modal NO debe aparecer
    await expect(page.locator('[data-testid="shift-editor"]')).not.toBeVisible({ timeout: 3_000 });
  } catch (e) {
    await screenshotOnFail(page, "CP-17");
    throw e;
  }
});

// ─── CP-18 ───────────────────────────────────────────────────────────────────
test("CP-18 — API rechaza escritura sin rol ADMIN", async ({ request }) => {
  // POST sin autenticación debe devolver 401 o 403
  const response = await request.post("/api/schedules", {
    data: {
      employeeId: "any-id",
      date: "2026-05-10T00:00:00.000Z",
      shiftType: "M",
    },
  });
  expect([401, 403]).toContain(response.status());
});

// ─── CP-19 ───────────────────────────────────────────────────────────────────
test("CP-19 — Listado de empleados visible para ADMIN", async ({ page }) => {
  try {
    await loginAs(page, ADMIN.email, ADMIN.password);
    await page.goto(ROUTES.employees);
    await expect(page.locator("table").first()).toBeVisible({ timeout: 8_000 });

    // Al menos 1 fila de empleado
    const rows = page.locator("table").first().locator("tbody tr");
    expect(await rows.count()).toBeGreaterThan(0);

    // El admin debe aparecer en la tabla (buscar dentro de la tabla para evitar ambigüedad con el header)
    await expect(page.locator('table').first().getByText(ADMIN.email)).toBeVisible({ timeout: 5_000 });
  } catch (e) {
    await screenshotOnFail(page, "CP-19");
    throw e;
  }
});

// ─── CP-20 ───────────────────────────────────────────────────────────────────
test("CP-20 — Empleado no puede acceder a /employees", async ({ page }) => {
  try {
    await loginAs(page, TECH.email, TECH.password);
    await page.goto(ROUTES.employees);
    // Esperar el redirect cliente-side (router.replace("/")) hasta 8s
    await page.waitForURL((u) => !u.toString().includes("/employees"), { timeout: 8_000 }).catch(() => {});

    // Debe redirigir a / o mostrar acceso denegado
    const url = page.url();
    const isRedirected = !url.includes("/employees");
    const hasForbidden = await page.locator("text=403").isVisible().catch(() => false);
    const hasAccessDenied = await page.locator("text=Acceso denegado").isVisible().catch(() => false);
    expect(isRedirected || hasForbidden || hasAccessDenied).toBe(true);
  } catch (e) {
    await screenshotOnFail(page, "CP-20");
    throw e;
  }
});

// ─── CP-21 ───────────────────────────────────────────────────────────────────
test("CP-21 — Admin puede crear un empleado", async ({ page }) => {
  const timestamp = Date.now();
  const newEmail = `nuevo_${timestamp}@test.local`;
  const newName = `Test Employee ${timestamp}`;

  try {
    await loginAs(page, ADMIN.email, ADMIN.password);
    await page.goto(ROUTES.employees);
    await expect(page.locator("table").first()).toBeVisible({ timeout: 8_000 });

    // Pulsar botón de crear
    await page.locator("button").filter({ hasText: /Nuevo (empleado|usuario)|Añadir|Crear/i }).first().click();

    // Rellenar formulario
    const nameInput = page.locator('input#emp-name, input[placeholder="Nombre completo"]').first();
    const emailInput = page.locator('input#emp-email, input[type="email"]').first();
    const passwordInput = page.locator('input#emp-password, input[type="password"]').first();
    await expect(nameInput).toBeVisible({ timeout: 5_000 });
    await nameInput.fill(newName);
    await emailInput.fill(newEmail);
    await passwordInput.fill('NuevoPass1!');

    await page.locator('button[type="submit"]').click();

    // El empleado debe aparecer en la tabla
    await expect(page.locator(`text=${newName}`)).toBeVisible({ timeout: 8_000 });
  } catch (e) {
    await screenshotOnFail(page, "CP-21");
    throw e;
  }
});

// ─── CP-22 ───────────────────────────────────────────────────────────────────
test("CP-22 — Admin puede editar un empleado", async ({ page }) => {
  const suffix = Date.now();
  const updatedName = `Tecnico Editado ${suffix}`;

  try {
    await loginAs(page, ADMIN.email, ADMIN.password);
    await page.goto(ROUTES.employees);
    await expect(page.locator("table").first()).toBeVisible({ timeout: 8_000 });

    // Pulsar "Editar" en una fila TECNICO (con nombre editable)
    const userRow = page.locator("table tbody tr").filter({ hasText: "TECNICO" }).first();
    await expect(userRow).toBeVisible({ timeout: 8_000 });
    await userRow.getByRole("button", { name: /Editar/i }).click();

    // Modal de edición
    const nameInput = page.locator('input#emp-name, input[placeholder="Nombre completo"]').first();
    await expect(nameInput).toBeVisible({ timeout: 5_000 });
    await nameInput.fill(updatedName);
    await page.locator('button[type="submit"]').click();

    // El nombre actualizado debe aparecer en la tabla
    await expect(page.locator(`text=${updatedName}`)).toBeVisible({ timeout: 8_000 });
  } catch (e) {
    await screenshotOnFail(page, "CP-22");
    throw e;
  }
});
