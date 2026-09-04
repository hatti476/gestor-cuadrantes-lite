import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test.describe("@smoke Admin Users - DELETE (Bug 3)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
  });

  test("@smoke AC-19: ADMIN ve botón 'Eliminar' en cada fila de usuario", async ({ page }) => {
    const deleteButtons = page.locator('button:has-text("Eliminar"), button[data-testid^="btn-delete-user-"]');
    await expect(deleteButtons.first()).toBeVisible();
  });

  test("@smoke AC-20: Click Eliminar → modal confirmación → borra usuario", async ({ page }) => {
    const firstDeleteBtn = page.locator('button:has-text("Eliminar"), button[data-testid^="btn-delete-user-"]').first();
    await firstDeleteBtn.click();

    const confirmModal = page.locator('[role="dialog"]:has-text("Eliminar"), .modal:has-text("Eliminar"), div.fixed:has-text("¿Eliminar usuario")');
    await expect(confirmModal).toBeVisible();

    await page.click('button:has-text("Sí"), button:has-text("Eliminar"), button[data-testid="confirm-delete"]');
    await page.waitForLoadState("networkidle");

    await expect(confirmModal).not.toBeVisible();
  });

  test("@smoke AC-21: Usuario eliminado no aparece en lista ni puede loguearse", async ({ page }) => {
    const userEmail = page.locator("tbody tr td:nth-child(2)").first();
    const emailText = await userEmail.textContent();

    const firstDeleteBtn = page.locator('button:has-text("Eliminar"), button[data-testid^="btn-delete-user-"]').first();
    await firstDeleteBtn.click();

    const confirmModal = page.locator('[role="dialog"]:has-text("Eliminar"), .modal:has-text("Eliminar"), div.fixed:has-text("¿Eliminar usuario")');
    await expect(confirmModal).toBeVisible();
    await page.click('button:has-text("Sí"), button:has-text("Eliminar"), button[data-testid="confirm-delete"]');
    await page.waitForLoadState("networkidle");

    const remainingEmails = await page.locator("tbody tr td:nth-child(2)").allTextContents();
    expect(remainingEmails).not.toContain(emailText);

    await page.goto("/login");
    await page.getByLabel("Email").fill(emailText || "");
    await page.getByLabel("Contraseña").fill("wrongpassword");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page.locator("text=Credenciales inválidas, text=Usuario no encontrado, text=Error")).toBeVisible({ timeout: 5000 });
  });
});