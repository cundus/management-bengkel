export type AppNavItem = {
  href: string;
  label: string;
  shortLabel: string;
  description: string;
  group: "utama" | "operasional" | "data";
};

export const PRIMARY_NAV: AppNavItem[] = [
  {
    href: "/",
    label: "Beranda",
    shortLabel: "Beranda",
    description: "Ringkasan hari ini",
    group: "utama",
  },
  {
    href: "/transaksi",
    label: "Transaksi",
    shortLabel: "Transaksi",
    description: "Nota servis & penjualan",
    group: "utama",
  },
  {
    href: "/piutang",
    label: "Piutang",
    shortLabel: "Piutang",
    description: "Tagihan pelanggan",
    group: "utama",
  },
  {
    href: "/laporan",
    label: "Laporan",
    shortLabel: "Laporan",
    description: "Pendapatan & laba",
    group: "utama",
  },
  {
    href: "/lainnya",
    label: "Lainnya",
    shortLabel: "Lainnya",
    description: "Semua menu",
    group: "utama",
  },
];

export const SECONDARY_NAV: AppNavItem[] = [
  {
    href: "/akun",
    label: "Manajemen Akun",
    shortLabel: "Akun",
    description: "Akun dan hak akses",
    group: "data",
  },
  {
    href: "/pelanggan",
    label: "Pelanggan & Kendaraan",
    shortLabel: "Pelanggan",
    description: "Database pelanggan",
    group: "operasional",
  },
  {
    href: "/stok",
    label: "Stok & Jasa",
    shortLabel: "Stok",
    description: "Katalog dan persediaan",
    group: "operasional",
  },
  {
    href: "/pembelian",
    label: "Pembelian",
    shortLabel: "Pembelian",
    description: "Barang masuk & tagihan supplier",
    group: "operasional",
  },
  {
    href: "/pengeluaran",
    label: "Pengeluaran",
    shortLabel: "Pengeluaran",
    description: "Biaya operasional",
    group: "operasional",
  },
  {
    href: "/hutang",
    label: "Hutang Supplier",
    shortLabel: "Hutang",
    description: "Kewajiban usaha",
    group: "operasional",
  },
  {
    href: "/pengaturan",
    label: "Pengaturan",
    shortLabel: "Pengaturan",
    description: "Profil bengkel",
    group: "data",
  },
];

const SECONDARY_PATHS = SECONDARY_NAV.map((item) => item.href);

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/lainnya") {
    return pathname === "/lainnya" || SECONDARY_PATHS.some((path) => pathname.startsWith(path));
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
