import { describe, expect, it } from "vitest";
import {
  allNavItems,
  mobileNavForRole,
  navGroupsForRole,
  resolveActiveHref,
  resolveMobileActiveHref,
} from "@/components/shell/nav-config";

const hrefs = (role: "owner" | "kasir") => navGroupsForRole(role).flatMap((group) => group.items.map((item) => item.href));

describe("konfigurasi navigasi", () => {
  it("setiap href menu unik", () => {
    const all = allNavItems().map((item) => item.href);
    expect(new Set(all).size).toBe(all.length);
  });

  it("kasir tidak melihat menu khusus pemilik, termasuk semua laporan", () => {
    const kasir = hrefs("kasir");
    expect(kasir).toEqual(["/", "/transaksi", "/piutang", "/pelanggan", "/stok"]);
    expect(kasir.some((href) => href.startsWith("/laporan"))).toBe(false);
    expect(navGroupsForRole("kasir").map((group) => group.id)).toEqual(["utama", "penjualan", "inventori"]);
  });

  it("pemilik melihat semua grup dan laporan", () => {
    expect(navGroupsForRole("owner").map((group) => group.id)).toEqual([
      "utama", "penjualan", "inventori", "keuangan", "laporan", "sistem",
    ]);
    expect(hrefs("owner")).toContain("/laporan/piutang-hutang");
  });

  it("bottom nav mengganti Laporan dengan Stok untuk kasir", () => {
    expect(mobileNavForRole("owner").map((item) => item.href)).toEqual(["/", "/transaksi", "/piutang", "/laporan", "/lainnya"]);
    expect(mobileNavForRole("kasir").map((item) => item.href)).toEqual(["/", "/transaksi", "/piutang", "/stok", "/lainnya"]);
    expect(mobileNavForRole("owner")[3].label).toBe("Laporan");
  });

  it("memilih menu paling spesifik sebagai menu aktif", () => {
    const all = allNavItems().map((item) => item.href);
    expect(resolveActiveHref("/", all)).toBe("/");
    expect(resolveActiveHref("/stok/penyesuaian", all)).toBe("/stok/penyesuaian");
    expect(resolveActiveHref("/stok/12", all)).toBe("/stok");
    expect(resolveActiveHref("/laporan", all)).toBe("/laporan");
    expect(resolveActiveHref("/laporan/arus-kas", all)).toBe("/laporan/arus-kas");
    expect(resolveActiveHref("/transaksi/baru", all)).toBe("/transaksi");
    expect(resolveActiveHref("/stokopname", all)).toBeNull();
  });

  it("halaman di luar bottom nav menyorot Lainnya", () => {
    const owner = mobileNavForRole("owner");
    expect(resolveMobileActiveHref("/laporan/laba-rugi", owner)).toBe("/laporan");
    expect(resolveMobileActiveHref("/pelanggan/3", owner)).toBe("/lainnya");
    expect(resolveMobileActiveHref("/lainnya", owner)).toBe("/lainnya");
    expect(resolveMobileActiveHref("/", owner)).toBe("/");
  });
});
