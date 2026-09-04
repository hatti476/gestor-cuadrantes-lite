import { test, expect } from "@playwright/test";
import {
  generateScheduleAndWait,
  loginAsAdmin,
  openShiftEditorFromEditableCell,
  screenshotOnFail,
} from "./helpers";

// ─── CP-23 — Admin puede cambiar la contraseña de un empleado ─────────────────
test("CP-23 — Admin puede cambiar la contraseña de un empleado", async ({ page }) => {
  test.slow(); // La llamada a la API de cambio de contraseña puede tardar bajo carga
  try {
    await loginAsAdmin(page);
    await page.goto("/employees");
    await expect(page.locator("table").first()).toBeVisible({ timeout: 8_000 });

    // Abrir edición de un técnico TECNICO activo
    const userRow = page
      .locator("table tbody tr")
      .filter({ hasText: "tecnico2@cuadrantes.local" })
      .first();
    await expect(userRow).toBeVisible({ timeout: 8_000 });
    await userRow.getByRole("button", { name: /Editar/i }).click();
    await page.getByRole("button", { name: /Cambiar contraseña/i }).click();

    // Modal de cambio de contraseña
    const newPwdInput = page.locator('input#pwd-new, input[placeholder="Nueva contraseña"]').first();
    const confirmPwdInput = page.locator('input#pwd-confirm, input[placeholder="Confirmar contraseña"]').first();
    await expect(newPwdInput).toBeVisible({ timeout: 5_000 });
    await newPwdInput.fill('NuevaClave1!');
    await confirmPwdInput.fill('NuevaClave1!');
    const updatePwdRes = page.waitForResponse(
      (r) => r.url().includes("/api/admin/users/") && r.request().method() === "PUT"
    );
    await confirmPwdInput.press("Enter");
    expect((await updatePwdRes).status()).toBe(200);

    // El modal debe cerrarse (éxito)
    await expect(newPwdInput).not.toBeVisible({ timeout: 15_000 });
  } catch (e) {
    await screenshotOnFail(page, "CP-23");
    throw e;
  }
});

// ─── CP-24 — Validación de contraseña débil ───────────────────────────────────
test("CP-24 — Cambio de contraseña valida requisitos", async ({ page }) => {
  try {
    await loginAsAdmin(page);
    await page.goto("/employees");
    await expect(page.locator("table").first()).toBeVisible({ timeout: 8_000 });

    // Abrir edición de un técnico TECNICO activo
    const userRow = page
      .locator("table tbody tr")
      .filter({ hasText: "tecnico2@cuadrantes.local" })
      .first();
    await expect(userRow).toBeVisible({ timeout: 8_000 });
    await userRow.getByRole("button", { name: /Editar/i }).click();
    await page.getByRole("button", { name: /Cambiar contraseña/i }).click();
    const newPwdInput = page.locator('input#pwd-new, input[placeholder="Nueva contraseña"]').first();
    const confirmPwdInput = page.locator('input#pwd-confirm, input[placeholder="Confirmar contraseña"]').first();
    await expect(newPwdInput).toBeVisible({ timeout: 5_000 });

    // Introducir contraseña débil (< 8 chars)
    await newPwdInput.fill('abc');
    await confirmPwdInput.fill('abc');
    const weakPwdRes = page.waitForResponse(
      (r) => r.url().includes("/api/admin/users/") && r.request().method() === "PUT"
    );
    await confirmPwdInput.press("Enter");
    expect([400, 422]).toContain((await weakPwdRes).status());

    // Debe aparecer mensaje de error en el modal
    await expect(
      page.locator("p").filter({ hasText: /contraseña inválida|minimo|mínimo/i }).first()
    ).toBeVisible({ timeout: 10_000 });

    // El modal permanece abierto
    await expect(newPwdInput).toBeVisible();
  } catch (e) {
    await screenshotOnFail(page, "CP-24");
    throw e;
  }
});

// ─── CP-25 — Turnos MF/TF/NF en el selector ──────────────────────────────────
test("CP-25 — Turnos MF/TF/NF disponibles en el selector", async ({ page }) => {
  try {
    await loginAsAdmin(page);
    await expect(page.locator("table").first()).toBeVisible({ timeout: 10_000 });
    await page.waitForLoadState("networkidle");

    // Abrir ShiftEditor desde una celda editable para evitar celdas bloqueadas.
    await openShiftEditorFromEditableCell(page);
    await expect(page.locator('[data-testid="shift-editor"]')).toBeVisible({ timeout: 5_000 });

    // Verificar presencia de los 3 tipos especiales
    await expect(page.locator('[data-testid="shift-btn-MF"]')).toBeVisible();
    await expect(page.locator('[data-testid="shift-btn-TF"]')).toBeVisible();
    await expect(page.locator('[data-testid="shift-btn-NF"]')).toBeVisible();

    // Cerrar modal
    await page.keyboard.press("Escape");
  } catch (e) {
    await screenshotOnFail(page, "CP-25");
    throw e;
  }
});

// ─── CP-26 — Generación automática del cuadrante ─────────────────────────────
test("CP-26 — Admin puede generar el cuadrante automáticamente @smoke", async ({ page }) => {
  try {
    await loginAsAdmin(page);
    await expect(page.locator("table").first()).toBeVisible({ timeout: 10_000 });

    // Ir a Octubre 2026 (5 nexts, seguro sin datos al inicio del sprint)
    for (let i = 0; i < 5; i++) {
      await page.locator('[data-testid="btn-next-month"]').click();
      await page.waitForTimeout(600);
    }
    await page.waitForTimeout(1_000);

    // Pulsar "Generar cuadrante" (funciona tanto si está vacío como si ya tiene datos)
    await generateScheduleAndWait(page);

    // El grid debe mostrar la tabla con empleados tras completar la generación
    await expect(page.locator("table").first()).toBeVisible({ timeout: 8_000 });
    const rows = page.locator("table").first().locator("tbody tr");
    expect(await rows.count()).toBeGreaterThan(0);
  } catch (e) {
    await screenshotOnFail(page, "CP-26");
    throw e;
  }
});

// ─── CP-27 — La generación no sobreescribe turnos manuales ───────────────────
test("CP-27 — La generación respeta los turnos manuales", async ({ page }) => {
  try {
    await loginAsAdmin(page);
    await expect(page.locator("table").first()).toBeVisible({ timeout: 10_000 });

    // Ir a Septiembre 2026 (4 nexts desde Mayo)
    for (let i = 0; i < 4; i++) {
      await page.locator('[data-testid="btn-next-month"]').click();
      await page.waitForTimeout(600);
    }

    // Generar primero para que haya tabla con celdas
    await generateScheduleAndWait(page);
    await expect(page.locator('[data-testid="toast"]').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("table").first()).toBeVisible({ timeout: 8_000 });
    await page.waitForTimeout(500);

    // Asignar manualmente turno V (vacaciones) en día 1 del primer empleado
    const targetCell = page.locator("table").first().locator("tbody tr").first().locator("td").nth(1);
    await targetCell.click();
    await expect(page.locator('[data-testid="shift-editor"]')).toBeVisible({ timeout: 5_000 });
    await page.locator('[data-testid="shift-btn-V"]').click();
    await expect(page.locator('[data-testid="shift-editor"]')).not.toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(500);

    // Generar de nuevo
    await generateScheduleAndWait(page);
    // Usar .first() para evitar strict mode si hay varios toasts visibles
    await expect(page.locator('[data-testid="toast"]').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("table").first()).toBeVisible({ timeout: 8_000 });

    // La celda día 1 primer empleado debe seguir siendo V
    await expect(
      page.locator("table").first().locator("tbody tr").first().locator("td").nth(1).locator('[data-testid="shift-cell-V"]')
    ).toBeVisible({ timeout: 5_000 });
  } catch (e) {
    await screenshotOnFail(page, "CP-27");
    throw e;
  }
});

// ─── CP-28 — Botón Imprimir existe y es clicable ────────────────────────────
test("CP-28 — Botón Imprimir está disponible en el cuadrante", async ({ page }) => {
  try {
    await loginAsAdmin(page);
    await expect(page.locator("table").first()).toBeVisible({ timeout: 10_000 });

    // El botón Imprimir debe estar visible
    const printBtn = page.locator('[data-testid="btn-print"]');
    await expect(printBtn).toBeVisible({ timeout: 5_000 });

    // Interceptamos window.print para verificar que se llama (sin abrir diálogo real)
    await page.evaluate(() => {
      (window as unknown as { _printCalled: boolean })._printCalled = false;
      window.print = () => { (window as unknown as { _printCalled: boolean })._printCalled = true; };
    });
    await printBtn.click();
    const printCalled = await page.evaluate(() => (window as unknown as { _printCalled: boolean })._printCalled);
    expect(printCalled).toBe(true);
  } catch (e) {
    await screenshotOnFail(page, "CP-28");
    throw e;
  }
});

// ─── CP-29 — El contador muestra MF, TF y NF ─────────────────────────────────
test("CP-29 — El contador muestra los turnos especiales MF, TF y NF", async ({ page }) => {
  try {
    await loginAsAdmin(page);
    const countersTable = page.locator('[data-testid="counters-table"]');
    await expect(countersTable).toBeVisible({ timeout: 10_000 });

    for (const shiftType of ["MF", "TF", "NF"]) {
      await expect(countersTable.getByText(shiftType, { exact: true })).toBeVisible();
      await expect(countersTable.locator(`td[data-testid$="-${shiftType}"]`).first()).toBeVisible();
    }
  } catch (e) {
    await screenshotOnFail(page, "CP-29");
    throw e;
  }
});
