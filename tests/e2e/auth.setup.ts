import { test as setup, expect } from "@playwright/test";

const authFile = "playwright/.auth/user.json";

setup("login sebagai pemilik", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Selamat datang kembali." })).toBeVisible();
  await page.getByLabel("Username atau email", { exact: true }).fill("owner@wmc225.id");
  await page.getByLabel("Kata sandi", { exact: true }).fill("wmc225");
  await page.getByRole("button", { name: /Masuk ke dashboard/ }).click();
  await page.waitForURL("http://localhost:3100/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Budi");
  await page.context().storageState({ path: authFile });
});
