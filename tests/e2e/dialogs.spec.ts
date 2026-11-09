import { test, expect } from "@playwright/test";

const dialogs = [
  { path: "/pengeluaran", trigger: "Catat pengeluaran" },
  { path: "/hutang", trigger: "Supplier baru" },
  { path: "/hutang", trigger: "Tagihan lain" },
  { path: "/hutang", trigger: "Bayar" },
  { path: "/piutang", trigger: "Bayar" },
  { path: "/pembelian/baru", trigger: "Supplier baru" },
];

for (const width of [390, 1280]) {
  for (const { path, trigger } of dialogs) {
    test(`${path}: dialog ${trigger} mengikuti viewport dan dapat digulir pada ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 360 });
      await page.goto(path);
      await page.getByRole("button", { name: trigger, exact: true }).first().click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog).toBeInViewport({ ratio: 1 });
      // The overlay must cover the viewport even inside transformed/scrolled pages.
      await expect.poll(() => dialog.evaluate((element) => {
        const rect = element.parentElement!.getBoundingClientRect();
        return Math.abs(rect.top) < 1 && Math.abs(rect.left) < 1 &&
          Math.abs(rect.width - window.innerWidth) < 1 && Math.abs(rect.height - window.innerHeight) < 1;
      })).toBe(true);
      await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");

      const bounds = await dialog.boundingBox();
      await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
      await page.mouse.wheel(0, 1500);
      await expect.poll(() => dialog.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
      await expect(dialog.locator('button[type="submit"]')).toBeInViewport({ ratio: 1 });

      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");

      await page.getByRole("button", { name: trigger, exact: true }).first().click();
      await dialog.getByRole("button", { name: "Tutup dialog", exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");
    });
  }
}
