import { test, expect } from "@playwright/test";
import { todayISO } from "../../src/lib/dates";

test("pengeluaran yang menduplikasi pembelian meminta konfirmasi dan bisa dikoreksi", async ({ page }) => {
  const suffix = Date.now();
  const amount = 222222;

  await page.goto("/pembelian/baru");
  await page.getByLabel("Supplier", { exact: true }).selectOption({ index: 1 });
  await page.getByLabel("Nomor nota supplier (opsional)").fill(`INV-EXP-${suffix}`);
  await page.getByLabel("Barang 1", { exact: true }).selectOption({ index: 1 });
  await page.getByLabel("Kode batch / lot 1", { exact: true }).fill(`LOT-EXP-${suffix}`);
  await page.getByLabel("Jumlah 1", { exact: true }).fill("1");
  await page.getByLabel("Modal per unit 1 (Rp)", { exact: true }).fill(String(amount));
  await page.getByLabel("Jatuh tempo", { exact: true }).fill(todayISO());
  await page.getByRole("button", { name: "Simpan & catat hutang" }).click();
  await page.waitForURL(/\/pembelian\/\d+\?baru=1$/);

  await page.goto("/pengeluaran");
  await page.getByRole("button", { name: "Catat pengeluaran" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("#expense-description").fill(`E2E duplikat ${suffix}`);
  await dialog.locator("#expense-amount").fill(String(amount));
  await dialog.getByRole("button", { name: "Simpan pengeluaran" }).click();

  await expect(dialog.getByText(/Ada pembelian PB-/)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Centang konfirmasi dulu" })).toBeDisabled();
  await dialog.getByLabel(/Saya sudah cek/).check();
  await dialog.getByRole("button", { name: "Simpan sebagai biaya lain" }).click();
  await expect(dialog).toHaveCount(0);

  const row = page.locator("div[data-expense-id]").filter({ hasText: `E2E duplikat ${suffix}` });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Koreksi" }).click();

  const correction = page.getByRole("dialog");
  await correction.getByLabel("Alasan koreksi").fill("Duplikat pembelian stok");
  await correction.getByRole("button", { name: "Balik pengeluaran" }).click();
  await expect(correction).toHaveCount(0);
  await expect(row.getByText("Dikoreksi")).toBeVisible();

  const reversal = page.locator("div[data-expense-id]").filter({ hasText: `Koreksi pengeluaran #${await row.getAttribute("data-expense-id")}` });
  await expect(reversal).toContainText("-Rp 222.222");
  await expect(reversal.getByText("Koreksi", { exact: true })).toBeVisible();
});