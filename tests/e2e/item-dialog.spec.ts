import { test, expect } from "@playwright/test";

for (const viewport of [{ width: 390, height: 600 }, { width: 1280, height: 600 }]) {
  test(`dialog tambah dan edit item dapat digulir pada ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/stok");

    for (const name of ["Tambah item", /^Edit /]) {
      await page.getByRole("button", { name }).first().click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeInViewport({ ratio: 1 });
      await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");

      const bounds = await dialog.boundingBox();
      expect(bounds).not.toBeNull();
      await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
      await page.mouse.wheel(0, 1000);
      await expect.poll(() => dialog.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
      await expect(dialog.getByRole("button", { name: /^Simpan/ })).toBeInViewport({ ratio: 1 });
      await dialog.getByRole("button", { name: "Batal", exact: true }).click();

      await expect(dialog).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");
      const previousScroll = await page.evaluate(() => window.scrollY);
      await page.mouse.wheel(0, 300);
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(previousScroll);
    }
  });
}
