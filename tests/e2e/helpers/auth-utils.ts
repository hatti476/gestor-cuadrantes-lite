/**
 * @module auth-utils
 * @description Utilidades de autenticación para E2E.
 */

import { expect, type Page } from "@playwright/test";
import { ROUTES } from "../config";
import { login } from "../helpers";
import { TEST_USERS } from "../fixtures/users";

export type TestRole = "admin" | "tech" | "viewer";

export async function loginAs(page: Page, role: TestRole): Promise<void> {
  const creds = TEST_USERS[role];
  await login(page, creds.email, creds.password);
}

export async function logout(page: Page): Promise<void> {
  const logoutButton = page.getByRole("button", { name: /cerrar sesión/i });
  if (await logoutButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await logoutButton.click();
  }
  await page.waitForURL((url) => url.pathname === ROUTES.login, { timeout: 10000 }).catch(() => undefined);
}

export async function expectRedirectFor(
  page: Page,
  role: TestRole,
  path: string,
  expectedDestination: string
): Promise<void> {
  await loginAs(page, role);
  await page.goto(path);
  await expect(page).toHaveURL(new RegExp(`${expectedDestination.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), {
    timeout: 10000,
  });
}
