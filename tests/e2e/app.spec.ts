import { test, expect } from "@playwright/test";

test.describe("WMC 225 — alur manajemen bengkel", () => {
  test("dashboard tampil dan semua modul utama dapat dibuka", async ({ page, request }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Budi");
    await expect(page.getByText("Omset hari ini", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("Piutang berjalan", { exact: false }).first()).toBeVisible();

    const routes: { path: string; heading: string }[] = [
      { path: "/transaksi", heading: "Transaksi" },
      { path: "/piutang", heading: "Piutang" },
      { path: "/laporan", heading: "Laporan keuangan" },
      { path: "/lainnya", heading: "Lainnya" },
      { path: "/pelanggan", heading: "Pelanggan & kendaraan" },
      { path: "/stok", heading: "Stok & jasa" },
      { path: "/pengeluaran", heading: "Pengeluaran" },
      { path: "/hutang", heading: "Hutang supplier" },
      { path: "/pengaturan", heading: "Pengaturan" },
    ];

    for (const route of routes) {
      const response = await page.goto(route.path);
      expect(response?.status(), route.path).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(route.heading);
    }

    const exportResponse = await request.get("/api/export/transaksi");
    expect(exportResponse.status()).toBe(200);
    expect(exportResponse.headers()["content-type"]).toContain("text/csv");
    expect(await exportResponse.text()).toContain("No. Nota");

    const manifest = await request.get("/manifest.webmanifest");
    expect(manifest.status()).toBe(200);
    expect(await manifest.text()).toContain("WMC 225");
  });

  test("membuat nota, mencatat pembayaran, dan piutang berkurang", async ({ page }) => {
    await page.goto("/transaksi/baru");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Transaksi baru");

    const customerOption = page.locator("#customerId option").filter({ hasText: "Maya Sari" });
    const customerValue = await customerOption.getAttribute("value");
    expect(customerValue).toBeTruthy();
    await page.selectOption("#customerId", customerValue!);

    await page.getByRole("button", { name: /Servis Ringan/ }).first().click();
    await page.getByRole("button", { name: /Ganti Oli/ }).first().click();
    await page.getByPlaceholder("Nama mekanik (opsional)").fill("Rahmat");
    await page.getByRole("button", { name: "Belum", exact: true }).click();

    await page.getByRole("button", { name: /Simpan & buka nota/ }).click();
    await page.waitForURL(/\/transaksi\/[0-9a-f-]{36}/, { timeout: 30_000 });
    await expect(page.getByText("Transaksi berhasil disimpan")).toBeVisible();
    await expect(page.getByText("Belum bayar").first()).toBeVisible();
    await expect(page.getByText(/Sisa tagihan/).first()).toBeVisible();

    await page.locator("#payment-amount").fill("25000");
    await page.getByRole("button", { name: /Catat pembayaran/ }).click();
    await expect(page.getByText("Pembayaran berhasil dicatat.")).toBeVisible();
    await expect(page.getByText("DP / Sebagian").first()).toBeVisible();

    await page.goto("/piutang");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Piutang");
    await expect(page.getByText("Total piutang berjalan")).toBeVisible();
  });

  test("mendaftarkan pelanggan, item baru, dan pengeluaran", async ({ page }) => {
    await page.goto("/pelanggan/baru");
    await page.locator("#name").fill("Tester Otomotif");
    await page.locator("#phone").fill("0812-0000-9999");
    await page.locator("#address").fill("Jl. Pengujian No. 1");
    await page.locator("#plateNumber").fill("D 9999 TST");
    await page.locator("#brand").fill("Honda");
    await page.locator("#model").fill("PCX 160");
    await page.locator("#year").fill("2025");
    await page.getByRole("button", { name: "Simpan pelanggan" }).click();
    await page.waitForURL(/\/pelanggan\/\d+/);
    await expect(page.getByText("Tester Otomotif").first()).toBeVisible();

    await page.goto("/stok");
    await page.getByRole("button", { name: "Tambah item" }).click();
    await page.locator("#item-name").fill("Test Filter Udara");
    await page.locator("#item-sku").fill("TST-001");
    await page.locator("#item-price").fill("55000");
    await page.locator("#item-cost").fill("30000");
    await page.locator("#item-stock").fill("10");
    await page.locator("#item-min").fill("2");
    await page.getByRole("button", { name: "Simpan item" }).click();
    await expect(page.getByText("Test Filter Udara").last()).toBeVisible();

    await page.goto("/pengeluaran");
    await page.getByRole("button", { name: /Catat pengeluaran/ }).click();
    await page.locator("#expense-description").fill("Test biaya operasional");
    await page.locator("#expense-amount").fill("123000");
    await page.getByRole("button", { name: "Simpan pengeluaran" }).click();
    await expect(page.getByText("Test biaya operasional").last()).toBeVisible();
  });

  test("membatalkan nota yang sudah dibayar dengan refund sebagian", async ({ page }) => {
    await page.goto("/transaksi/baru");
    const customerOption = page.locator("#customerId option").filter({ hasText: "Nina Wulandari" });
    const customerValue = await customerOption.getAttribute("value");
    await page.selectOption("#customerId", customerValue!);
    await page.getByRole("button", { name: /Tambal Ban/ }).first().click();
    await page.getByRole("button", { name: "Belum", exact: true }).click();
    await page.getByRole("button", { name: /Simpan & buka nota/ }).click();
    await page.waitForURL(/\/transaksi\/[0-9a-f-]{36}/, { timeout: 30_000 });

    await page.locator("#payment-amount").fill("10000");
    await page.getByRole("button", { name: /Catat pembayaran/ }).click();
    await expect(page.getByText("Pembayaran berhasil dicatat.")).toBeVisible();

    await page.getByRole("button", { name: "Batalkan transaksi" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("#void-reason").fill("Salah input saat pengujian");
    await dialog.locator("#refund-amount").fill("6000");
    await expect(dialog.getByText("pendapatan pembatalan")).toBeVisible();
    await dialog.getByRole("button", { name: /Batalkan nota/ }).click();

    await expect(page.getByText("Transaksi dibatalkan", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("Dikembalikan ke pelanggan")).toBeVisible();
    await expect(page.getByText("Pendapatan pembatalan")).toBeVisible();
    await expect(page.getByText("BATAL", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Batalkan transaksi" })).toHaveCount(0);
  });

  test("kasir mengajukan pembatalan dan pemilik menyetujui", async ({ page, browser }) => {
    const context = await browser.newContext({
      baseURL: "http://localhost:3100",
      ...test.info().project.use,
      storageState: undefined,
    });
    const kasir = await context.newPage();
    await kasir.goto("/login");
    await kasir.getByLabel("Username atau email", { exact: true }).fill("kasir");
    await kasir.getByLabel("Kata sandi", { exact: true }).fill("wmc225");
    await kasir.getByRole("button", { name: /Masuk ke dashboard/ }).click();
    await kasir.waitForURL("http://localhost:3100/");

    await kasir.goto("/transaksi/baru");
    const customerValue = await kasir.locator("#customerId option").filter({ hasText: "Nina Wulandari" }).getAttribute("value");
    await kasir.selectOption("#customerId", customerValue!);
    await kasir.getByRole("button", { name: /Tambal Ban/ }).first().click();
    await kasir.getByRole("button", { name: "Belum", exact: true }).click();
    await kasir.getByRole("button", { name: /Simpan & buka nota/ }).click();
    await kasir.waitForURL(/\/transaksi\/[0-9a-f-]{36}/, { timeout: 30_000 });
    const notaUrl = new URL(kasir.url()).pathname;

    await expect(kasir.getByRole("button", { name: "Batalkan transaksi" })).toHaveCount(0);
    await kasir.getByRole("button", { name: "Ajukan pembatalan" }).click();
    await kasir.locator("#request-void-reason").fill("Pelanggan batal servis");
    await kasir.getByRole("button", { name: /Kirim pengajuan/ }).click();
    await expect(kasir.getByText("Pengajuan pembatalan menunggu persetujuan pemilik")).toBeVisible();
    await expect(kasir.getByRole("button", { name: "Ajukan pembatalan" })).toHaveCount(0);
    await context.close();

    await page.goto("/transaksi?status=pengajuan");
    await expect(page.locator("text=Minta batal >> visible=true").first()).toBeVisible();
    await page.goto(notaUrl);
    await expect(page.getByText("Kasir mengajukan pembatalan nota ini")).toBeVisible();
    await page.getByRole("button", { name: /Setujui & batalkan/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator("#void-reason")).toHaveValue("Pelanggan batal servis");
    await dialog.getByRole("button", { name: /Batalkan nota/ }).click();
    await expect(page.getByText("Transaksi dibatalkan", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("Kasir mengajukan pembatalan nota ini")).toHaveCount(0);
  });

  test("kasir tidak dapat membuka modul khusus pemilik", async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: "http://localhost:3100",
      ...test.info().project.use,
      storageState: undefined,
    });
    const page = await context.newPage();
    await page.goto("/login");
    await page.getByLabel("Username atau email", { exact: true }).fill("kasir");
    await page.getByLabel("Kata sandi", { exact: true }).fill("wmc225");
    await page.getByRole("button", { name: /Masuk ke dashboard/ }).click();
    await page.waitForURL("http://localhost:3100/");

    await page.goto("/pengeluaran");
    await page.waitForURL(/\/lainnya\?error=akses-terbatas/);
    await expect(page.getByText("Akses khusus pemilik").first()).toBeVisible();

    await page.goto("/akun");
    await page.waitForURL(/\/lainnya\?error=akses-terbatas/);
    await expect(page.getByRole("link", { name: /Manajemen akun/i })).toHaveCount(0);

    await page.goto("/stok");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Stok & jasa");
    await expect(page.getByRole("button", { name: "Tambah item" })).toHaveCount(0);

    await context.close();
  });
});
