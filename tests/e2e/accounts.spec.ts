import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const email = `account-e2e-${Date.now()}@example.com`;
const username = `user-${Date.now()}`;
const password = "AccountTest123!";
const prisma = new PrismaClient({ datasourceUrl: process.env.E2E_DATABASE_URL || "postgresql://wmc:wmc@localhost:5432/wmc225_e2e?schema=public" });

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
});

test("pemilik mengelola akun, kasir ditolak, dan reset kata sandi mencabut sesi", async ({ page, browser }) => {
  await page.goto("/akun");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Manajemen akun");
  const createForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Tambah akun", exact: true }) });
  await createForm.getByLabel("Nama", { exact: true }).fill("Kasir Pengujian");
  await createForm.getByLabel("Email", { exact: true }).fill(email);
  await createForm.getByLabel("Username (opsional)", { exact: true }).fill(username.toUpperCase());
  await createForm.getByLabel("Kata sandi", { exact: true }).fill(password);
  await createForm.getByRole("button", { name: "Tambah akun", exact: true }).click();
  const details = page.locator("details").filter({ hasText: email });
  await expect(details.locator("summary")).toBeVisible();

  const context = await browser.newContext({ baseURL: "http://localhost:3100", storageState: { cookies: [], origins: [] } });
  try {
    const cashier = await context.newPage();
    await cashier.goto("/login");
    await cashier.getByLabel("Username atau email", { exact: true }).fill(username.toUpperCase());
    await cashier.getByLabel("Kata sandi", { exact: true }).fill(password);
    await cashier.getByRole("button", { name: /Masuk ke dashboard/ }).click();
    await expect(cashier).toHaveURL("http://localhost:3100/");
    await cashier.goto("/akun");
    await expect(cashier).toHaveURL(/\/lainnya\?error=akses-terbatas/);

    await details.locator("summary").click();
    await details.getByLabel("Nama", { exact: true }).fill("Pemilik Pengujian");
    await details.getByLabel("Role", { exact: true }).selectOption("owner");
    await details.getByLabel("Username (opsional)", { exact: true }).fill(`${username}-new`);
    await details.getByRole("button", { name: "Simpan perubahan" }).click();
    await expect(details.locator("summary")).toContainText("Pemilik Pengujian");
    await cashier.goto("/akun");
    await expect(cashier.getByRole("heading", { level: 1 })).toHaveText("Manajemen akun");

    if ((await details.getAttribute("open")) === null) await details.locator("summary").click();
    await details.getByLabel("Kata sandi baru (opsional)", { exact: true }).fill("Replacement123!");
    await details.getByRole("button", { name: "Simpan perubahan" }).click();
    await expect(details.getByRole("status")).toHaveText("Akun berhasil diperbarui.");
    await cashier.goto("/akun");
    await expect(cashier).toHaveURL(/\/login$/);
    await cashier.getByLabel("Username atau email", { exact: true }).fill(email);
    await cashier.getByLabel("Kata sandi", { exact: true }).fill(password);
    await cashier.getByRole("button", { name: /Masuk ke dashboard/ }).click();
    await expect(cashier.getByRole("alert").filter({ hasText: "Username/email atau kata sandi salah" })).toBeVisible();
    await cashier.getByLabel("Username atau email", { exact: true }).fill(username);
    await cashier.getByLabel("Kata sandi", { exact: true }).fill("Replacement123!");
    await cashier.getByRole("button", { name: /Masuk ke dashboard/ }).click();
    await expect(cashier.getByRole("alert").filter({ hasText: "Username/email atau kata sandi salah" })).toBeVisible();
    await cashier.getByLabel("Username atau email", { exact: true }).fill(`${username}-new`);
    await cashier.getByLabel("Kata sandi", { exact: true }).fill("Replacement123!");
    await cashier.getByRole("button", { name: /Masuk ke dashboard/ }).click();
    await expect(cashier).toHaveURL("http://localhost:3100/");
  } finally {
    await context.close();
  }
});
