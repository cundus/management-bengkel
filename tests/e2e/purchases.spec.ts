import { test, expect } from "@playwright/test";
import { todayISO } from "../../src/lib/dates";

test("pembelian banyak barang terhubung ke batch dan tagihan hingga lunas", async ({ page }) => {
  const suffix = Date.now();
  const reference = `INV-E2E-${suffix}`;
  await page.goto("/pembelian/baru");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pembelian baru");
  await page.getByLabel("Supplier", { exact: true }).selectOption({ index: 1 });
  await page.getByLabel("Nomor nota supplier (opsional)").fill(reference);
  await page.getByLabel("Barang 1", { exact: true }).selectOption({ index: 1 });
  await page.getByLabel("Kode batch / lot 1", { exact: true }).fill(`LOT-A-${suffix}`);
  await page.getByLabel("Jumlah 1", { exact: true }).fill("2");
  await page.getByLabel("Modal per unit 1 (Rp)", { exact: true }).fill("10000");
  await page.getByRole("button", { name: "Tambah barang", exact: true }).click();
  await page.getByLabel("Barang 2", { exact: true }).selectOption({ index: 2 });
  await page.getByLabel("Kode batch / lot 2", { exact: true }).fill(`LOT-B-${suffix}`);
  await page.getByLabel("Jumlah 2", { exact: true }).fill("3");
  await page.getByLabel("Modal per unit 2 (Rp)", { exact: true }).fill("20000");
  await page.getByLabel("Cara pembayaran").selectOption("sebagian");
  await page.getByLabel("Dibayar sekarang (Rp)").fill("30000");
  await page.getByLabel("Jatuh tempo", { exact: true }).fill(todayISO());
  await page.getByRole("button", { name: "Simpan & terima barang" }).click();
  await page.waitForURL(/\/pembelian\/\d+$/);
  const detailUrl = page.url();
  await expect(page.getByText("Rp 80.000", { exact: true })).toBeVisible();
  await expect(page.getByText("Rp 50.000", { exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: `LOT-A-${suffix}`, exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: `LOT-B-${suffix}`, exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Lihat tagihan supplier" }).click();
  const bill = page.locator('[id^="tagihan-"]').filter({ hasText: reference });
  await expect(bill).toBeVisible();
  await expect(bill.getByText("Rp 50.000", { exact: true })).toBeVisible();
  await bill.getByRole("button", { name: "Bayar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Catat pembayaran", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto(detailUrl);
  await expect(page.getByText("Pembelian sudah lunas.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Bayar", exact: true })).toHaveCount(0);

  await page.getByRole("row").filter({ hasText: `LOT-A-${suffix}` }).getByRole("link").click();
  await expect(page.getByRole("heading", { name: "Riwayat batch" })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: `LOT-A-${suffix}` })).toContainText("PB-");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
