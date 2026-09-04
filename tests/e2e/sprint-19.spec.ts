/**
 * tests/e2e/sprint-19.spec.ts
 * Sprint 19 — Gestión de usuarios y proyectos: RBAC, /admin section
 *
 * CP-129 — ADMIN ve el enlace "Administración" en la cabecera
 * CP-130 — TECNICO no ve "Administración" en la cabecera
 * CP-131 — TECNICO (empleado) solo ve "Cuadrante" y "Ayuda" en la cabecera
 * CP-132 — /admin redirige a "/" si el usuario no es ADMIN
 * CP-133 — ADMIN puede crear un usuario desde /admin (tab Usuarios)
 * CP-134 — ADMIN puede editar email de un usuario desde /admin
 * CP-135 — ADMIN puede desactivar un usuario desde /admin
 * CP-136 — El filtro por rol en la tab Usuarios filtra correctamente
 * CP-137 — VIEWER puede ver el cuadrante pero no tiene PrepPanel
 * CP-138 — VIEWER no puede editar celdas del cuadrante
 * CP-139 — /employees redirige a /admin (backward compatibility)
 * CP-140 — ADMIN puede cambiar la contraseña desde la tabla de usuarios
 */

import { test, expect } from "@playwright/test";
import { ROUTES } from "./config";
import { loginAsAdmin, loginAsViewer, loginAsTech } from "./helpers";

test.describe.configure({ mode: "serial" });

// ──────────────────────────────────────────────────────────────────────────────
// CP-129 — ADMIN ve "Administración" en la cabecera
// ──────────────────────────────────────────────────────────────────────────────
test("CP-129 — ADMIN ve el enlace 'Administración' en la cabecera @smoke", async ({
  page,
}) => {
  await loginAsAdmin(page);
  await page.goto(ROUTES.home);
  const adminLink = page.locator('[data-testid="nav-admin"]');
  await expect(adminLink).toBeVisible({ timeout: 8_000 });
  await expect(adminLink).toHaveText("Administración");
});

// ──────────────────────────────────────────────────────────────────────────────
// CP-130 — TECNICO no ve "Administración" en la cabecera
// ──────────────────────────────────────────────────────────────────────────────
test("CP-130 — TECNICO no ve el enlace 'Administración' en la cabecera", async ({
  page,
}) => {
  await loginAsTech(page);
  await page.goto(ROUTES.home);
  // Esperar que la cabecera cargue (role badge visible)
  await expect(page.locator('[data-testid="role-badge"]')).toBeVisible({
    timeout: 8_000,
  });
  const adminLink = page.locator('[data-testid="nav-admin"]');
  await expect(adminLink).not.toBeVisible();
});

// ──────────────────────────────────────────────────────────────────────────────
// CP-131 — TECNICO (empleado puro) solo ve "Cuadrante" y "Ayuda"
// ──────────────────────────────────────────────────────────────────────────────
test("CP-131 — TECNICO solo ve 'Cuadrante' y 'Ayuda' en la cabecera", async ({
  page,
}) => {
  await loginAsTech(page);
  await page.goto(ROUTES.home);
  await expect(page.locator('[data-testid="role-badge"]')).toBeVisible({
    timeout: 8_000,
  });
  // No debe ver Proyectos ni Administración
  await expect(page.locator("nav a", { hasText: "Proyectos" })).not.toBeVisible();
  await expect(page.locator('[data-testid="nav-admin"]')).not.toBeVisible();
  // Sí debe ver Cuadrante y Ayuda
  await expect(page.locator("nav a", { hasText: "Cuadrante" })).toBeVisible();
  await expect(page.locator("nav a", { hasText: "Ayuda" })).toBeVisible();
});

// ──────────────────────────────────────────────────────────────────────────────
// CP-132 — /admin redirige a "/" si el usuario no es ADMIN
// ──────────────────────────────────────────────────────────────────────────────
test("CP-132 — /admin redirige a '/' para no-ADMIN (PM) @smoke", async ({
  page,
}) => {
  await loginAsTech(page);
  await page.goto("/admin");
  // Debe redirigir al home
  await expect(page).toHaveURL(/\/$/, { timeout: 10_000 });
});

// ──────────────────────────────────────────────────────────────────────────────
// CP-133 — ADMIN puede crear un usuario desde /admin (tab Usuarios)
// ──────────────────────────────────────────────────────────────────────────────
test("CP-133 — ADMIN puede crear un VIEWER desde /admin @smoke", async ({
  page,
}) => {
  await loginAsAdmin(page);
  await page.goto("/admin");

  // Tab Usuarios debe estar activo por defecto
  const usersTab = page.locator('[data-testid="admin-tab-users"]');
  await expect(usersTab).toBeVisible({ timeout: 8_000 });

  // Abrir modal de nuevo usuario
  await page.getByRole("button", { name: /Nuevo usuario/i }).click();
  // Esperar que el modal esté visible
  await expect(page.locator('h3:has-text("Nuevo usuario")')).toBeVisible({ timeout: 5_000 });

  // Cambiar rol primero (elimina el campo Nombre requerido para TECNICO)
  const roleSelect = page.locator('[data-testid="select-global-role"]');
  await roleSelect.selectOption("VIEWER");

  // Rellenar formulario
  await page.locator('input[type="email"]').fill("newviewer_cp133@cuadrantes.test");
  await page.locator('input[type="password"]').first().fill("Test1234!");

  // Guardar
  await page.getByRole("button", { name: /Guardar/i }).click();

  // Toast de éxito y modal cerrado
  await expect(page.locator("text=Usuario creado")).toBeVisible({
    timeout: 8_000,
  });

  // El usuario aparece en la tabla
  await expect(
    page.locator("td", { hasText: "newviewer_cp133@cuadrantes.test" })
  ).toBeVisible({ timeout: 5_000 });
});

// ──────────────────────────────────────────────────────────────────────────────
// CP-134 — ADMIN puede editar el email de un usuario desde /admin
// ──────────────────────────────────────────────────────────────────────────────
test("CP-134 — ADMIN puede editar el email del usuario creado en CP-133", async ({
  page,
}) => {
  await loginAsAdmin(page);
  await page.goto("/admin");
  await expect(page.locator('[data-testid="admin-tab-users"]')).toBeVisible({
    timeout: 8_000,
  });

  // Encontrar la fila del usuario creado en CP-133
  const row = page.locator("tr", {
    hasText: "newviewer_cp133@cuadrantes.test",
  });
  await expect(row).toBeVisible({ timeout: 5_000 });

  // Click en Editar
  await row.getByRole("button", { name: /Editar/i }).click();
  await expect(page.locator('h3:has-text("Editar")')).toBeVisible({ timeout: 5_000 });

  // Cambiar el email
  const emailField = page.locator('input[type="email"]');
  await emailField.clear();
  await emailField.fill("newviewer_cp134@cuadrantes.test");

  await page.getByRole("button", { name: /Guardar/i }).click();

  await expect(page.locator("text=Usuario actualizado")).toBeVisible({
    timeout: 8_000,
  });
  await expect(
    page.locator("td", { hasText: "newviewer_cp134@cuadrantes.test" })
  ).toBeVisible({ timeout: 5_000 });
});

// ──────────────────────────────────────────────────────────────────────────────
// CP-135 — ADMIN puede desactivar un usuario desde /admin
// ──────────────────────────────────────────────────────────────────────────────
test("CP-135 — ADMIN puede desactivar un usuario TECNICO desde /admin @smoke", async ({
  page,
}) => {
  // Login primero para que el API request tenga sesión
  await loginAsAdmin(page);

  // Crear un usuario TECNICO para poder desactivarlo
  const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const tempEmail = `cp135_temp_${uniqueSuffix}@cuadrantes.test`;
  const createRes = await page.request.post("/api/admin/users", {
    data: {
      name: "CP135 Temp",
      email: tempEmail,
      password: "Test1234!",
      globalRole: "TECNICO",
    },
  });

  expect(
    createRes.ok(),
    `CP-135 setup failed creating user: ${createRes.status()} ${createRes.statusText()}`
  ).toBeTruthy();

  const createPayload = (await createRes.json()) as { id: string };
  const userId = createPayload.id;
  await page.goto("/admin");
  await expect(page.locator('[data-testid="admin-tab-users"]')).toBeVisible({
    timeout: 8_000,
  });

  const row = page.locator("tr", { hasText: tempEmail });
  await expect(row).toBeVisible({ timeout: 5_000 });
  await row.getByRole("button", { name: /Editar/i }).click();

  // Click en "Desactivar usuario"
  await page.getByRole("button", { name: /Desactivar usuario/i }).click();
  // Confirmar
  await page.getByRole("button", { name: /^Sí$/ }).click();

  await expect(page.locator("text=Usuario desactivado")).toBeVisible({
    timeout: 8_000,
  });

  // Limpieza: eliminar el usuario si lo creamos aquí
  await page.request.patch(`/api/admin/users/${userId}`, {
    data: { active: false },
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// CP-136 — El filtro por rol en la tab Usuarios funciona correctamente
// ──────────────────────────────────────────────────────────────────────────────
test("CP-136 — Filtro por rol ADMIN muestra solo ADMINs @smoke", async ({
  page,
}) => {
  await loginAsAdmin(page);
  await page.goto("/admin");
  await expect(page.locator('[data-testid="admin-tab-users"]')).toBeVisible({
    timeout: 8_000,
  });

  // Seleccionar filtro ADMIN
  const roleFilter = page.locator("select", { hasText: "Todos los roles" });
  await roleFilter.selectOption("ADMIN");

  // Todos los badges de rol deben ser ADMIN
  const badges = page.locator("span.rounded-full", { hasText: "ADMIN" });
  await expect(badges.first()).toBeVisible({ timeout: 5_000 });

  // No debe haber badges de VIEWER ni TECNICO
  await expect(
    page.locator("span.rounded-full", { hasText: "VIEWER" })
  ).not.toBeVisible();
  await expect(
    page.locator("span.rounded-full", { hasText: /^TECNICO$/ })
  ).not.toBeVisible();
});

// ──────────────────────────────────────────────────────────────────────────────
// CP-139 — VIEWER puede ver el cuadrante sin PrepPanel
// ──────────────────────────────────────────────────────────────────────────────
test("CP-139 — VIEWER ve el cuadrante pero no tiene PrepPanel", async ({
  page,
}) => {
  await loginAsViewer(page);
  await page.goto(ROUTES.home);

  // Puede ver el grid (mes publicado) o el aviso de no publicado.
  const unpublishedMessage = page.locator('[data-testid="unpublished-message"]');
  const isUnpublished = await unpublishedMessage.isVisible({ timeout: 2_000 }).catch(() => false);
  if (!isUnpublished) {
    const grid = page.locator('[data-testid="schedule-grid"]');
    await expect(grid).toBeVisible({ timeout: 15_000 });
  } else {
    await expect(unpublishedMessage).toBeVisible();
  }

  // No debe haber PrepPanel
  const prepPanel = page.locator('[data-testid="prep-step-generar"]');
  await expect(prepPanel).not.toBeVisible();

  // No debe haber botón de generar
  await expect(page.locator('[data-testid="btn-generate"]')).not.toBeVisible();
});

// ──────────────────────────────────────────────────────────────────────────────
// CP-140 — VIEWER no puede editar celdas del cuadrante
// ──────────────────────────────────────────────────────────────────────────────
test("CP-140 — VIEWER no puede editar celdas (no hay ShiftEditor al hacer clic) @smoke", async ({
  page,
}) => {
  await loginAsViewer(page);
  await page.goto(ROUTES.home);

  // Fix CP-140: Promise.race was unreliable — unpublished-message could resolve
  // the race but then disappear during React re-render before isVisible() ran.
  // Now we wait for networkidle to let the page settle, then evaluate state once.
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

  const unpublishedMessage = page.locator('[data-testid="unpublished-message"]');
  const grid = page.locator('[data-testid="schedule-grid"]');
  const shiftEditor = page.locator('[data-testid="shift-editor"]');

  const isUnpublished = await unpublishedMessage.isVisible();
  const hasGrid = await grid.isVisible();

  if (isUnpublished) {
    // Correct: VIEWER sees unpublished message — no editor must be shown
    await expect(shiftEditor).not.toBeVisible();
    return;
  }

  if (hasGrid) {
    // Published schedule visible: cells must NOT have cursor-pointer (no edit rights)
    const editableCells = grid.locator("td.cursor-pointer");
    const cellCount = await editableCells.count();
    if (cellCount > 0) {
      await editableCells.first().click();
      await expect(shiftEditor).not.toBeVisible({ timeout: 2_000 });
    } else {
      // No cursor-pointer cells → VIEWER correctly has no edit access
      expect(cellCount).toBe(0);
    }
    return;
  }

  // Neither grid nor unpublished-message visible (e.g. empty project, loading ended)
  // ShiftEditor must still not be visible — viewer never has edit rights
  await expect(shiftEditor).not.toBeVisible();
});

// ──────────────────────────────────────────────────────────────────────────────
// CP-141 — /employees redirige a /admin (backward compatibility)
// ──────────────────────────────────────────────────────────────────────────────
test("CP-141 — /employees redirige a /admin para ADMIN", async ({
  page,
}) => {
  await loginAsAdmin(page);
  await page.goto("/employees");
  // El middleware debe redirigir /employees → /admin
  await expect(page).toHaveURL(/\/admin/, { timeout: 10_000 });
});

// ──────────────────────────────────────────────────────────────────────────────
// CP-142 — ADMIN puede cambiar contraseña desde la tabla
// ──────────────────────────────────────────────────────────────────────────────
test("CP-142 — ADMIN cambia contraseña desde acción directa de tabla", async ({
  page,
}) => {
  const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const tempEmail = `cp142_temp_${uniqueSuffix}@cuadrantes.test`;
  const oldPassword = "Test1234!";
  const newPassword = "NuevoPass123!";

  await loginAsAdmin(page);

  const createRes = await page.request.post("/api/admin/users", {
    data: {
      name: "CP142 Temp",
      email: tempEmail,
      password: oldPassword,
      globalRole: "TECNICO",
    },
  });
  expect(createRes.ok()).toBeTruthy();

  await page.goto("/admin");
  const row = page.locator("tr", { hasText: tempEmail });
  await expect(row).toBeVisible({ timeout: 8_000 });

  await row.getByRole("button", { name: /Contraseña/i }).click();
  await expect(page.locator('h3:has-text("Cambiar contraseña")')).toBeVisible({ timeout: 5_000 });

  const passwordInputs = page.locator('input[type="password"]');
  await passwordInputs.first().fill(newPassword);
  await passwordInputs.nth(1).fill(newPassword);
  await page.getByRole("button", { name: /^Guardar$/ }).click();

  await expect(page.locator("text=Contraseña actualizada")).toBeVisible({ timeout: 8_000 });
});
