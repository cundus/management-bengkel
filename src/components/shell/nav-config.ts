import {
  ChartNoAxesCombined,
  ClipboardList,
  FileBarChart,
  Grid2X2,
  HandCoins,
  Landmark,
  LayoutDashboard,
  PackageSearch,
  ReceiptText,
  Scale,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  TrendingUp,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@/lib/constants";

export type NavBadge = "voidRequests" | "outstanding" | "lowStock";

export type AppNavItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Role yang boleh membuka menu. Kosong berarti semua role. */
  roles?: UserRole[];
  badge?: NavBadge;
};

export type AppNavGroup = {
  id: string;
  label: string;
  items: AppNavItem[];
};

const OWNER: UserRole[] = ["owner"];

export const NAV_GROUPS: AppNavGroup[] = [
  {
    id: "utama",
    label: "Utama",
    items: [{ href: "/", label: "Beranda", description: "Ringkasan hari ini", icon: LayoutDashboard }],
  },
  {
    id: "penjualan",
    label: "Penjualan",
    items: [
      { href: "/transaksi", label: "Transaksi", description: "Nota servis & penjualan", icon: ReceiptText, badge: "voidRequests" },
      { href: "/piutang", label: "Piutang", description: "Tagihan pelanggan", icon: HandCoins, badge: "outstanding" },
      { href: "/pelanggan", label: "Pelanggan & Kendaraan", description: "Profil, riwayat servis, dan kendaraan", icon: Users },
    ],
  },
  {
    id: "inventori",
    label: "Inventori",
    items: [
      { href: "/stok", label: "Stok & Jasa", description: "Katalog harga, HPP, dan persediaan", icon: PackageSearch, badge: "lowStock" },
      { href: "/pembelian", label: "Pembelian", description: "Barang masuk dan batch stok", icon: ShoppingCart, roles: OWNER },
      { href: "/stok/penyesuaian", label: "Penyesuaian Stok", description: "Koreksi stok fisik dan selisihnya", icon: ClipboardList, roles: OWNER },
    ],
  },
  {
    id: "keuangan",
    label: "Keuangan",
    items: [
      { href: "/pengeluaran", label: "Pengeluaran", description: "Biaya operasional bengkel", icon: WalletCards, roles: OWNER },
      { href: "/hutang", label: "Hutang Supplier", description: "Kewajiban usaha dan pembayarannya", icon: Landmark, roles: OWNER },
    ],
  },
  {
    id: "laporan",
    label: "Laporan",
    items: [
      { href: "/laporan", label: "Ringkasan", description: "KPI dan tren periode", icon: ChartNoAxesCombined, roles: OWNER },
      { href: "/laporan/laba-rugi", label: "Laba Rugi", description: "Omset, HPP, biaya, dan laba bersih", icon: FileBarChart, roles: OWNER },
      { href: "/laporan/arus-kas", label: "Arus Kas", description: "Uang masuk, keluar, dan metode bayar", icon: WalletCards, roles: OWNER },
      { href: "/laporan/penjualan", label: "Penjualan & Produk", description: "Margin dan item terlaris", icon: TrendingUp, roles: OWNER },
      { href: "/laporan/piutang-hutang", label: "Piutang & Hutang", description: "Umur tagihan dan posisi bersih", icon: Scale, roles: OWNER },
    ],
  },
  {
    id: "sistem",
    label: "Sistem",
    items: [
      { href: "/pengaturan", label: "Pengaturan Bengkel", description: "Profil, nota, dan preferensi aplikasi", icon: Settings2, roles: OWNER },
      { href: "/akun", label: "Manajemen Akun", description: "Akun pemilik, kasir, dan kata sandi", icon: ShieldCheck, roles: OWNER },
    ],
  },
];

export const MORE_NAV_ITEM: AppNavItem = { href: "/lainnya", label: "Lainnya", description: "Semua menu", icon: Grid2X2 };

/** Urutan menu bottom nav mobile per role; item terakhir selalu "Lainnya". */
const MOBILE_HREFS: Record<UserRole, string[]> = {
  owner: ["/", "/transaksi", "/piutang", "/laporan"],
  kasir: ["/", "/transaksi", "/piutang", "/stok"],
};

const MOBILE_LABELS: Record<string, string> = { "/laporan": "Laporan", "/stok": "Stok" };

export function canAccess(item: AppNavItem, role: UserRole): boolean {
  return !item.roles || item.roles.includes(role);
}

export function navGroupsForRole(role: UserRole): AppNavGroup[] {
  return NAV_GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => canAccess(item, role)) })).filter(
    (group) => group.items.length > 0,
  );
}

export function allNavItems(): AppNavItem[] {
  return NAV_GROUPS.flatMap((group) => group.items);
}

export function mobileNavForRole(role: UserRole): AppNavItem[] {
  const byHref = new Map(allNavItems().map((item) => [item.href, item]));
  const items = MOBILE_HREFS[role]
    .map((href) => byHref.get(href))
    .filter((item): item is AppNavItem => !!item && canAccess(item, role))
    .map((item) => ({ ...item, label: MOBILE_LABELS[item.href] ?? item.label }));
  return [...items, MORE_NAV_ITEM];
}

function matches(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Href paling spesifik yang cocok dengan pathname, mis. `/stok/penyesuaian`
 * mengalahkan `/stok`, dan `/laporan/arus-kas` mengalahkan `/laporan`.
 */
export function resolveActiveHref(pathname: string, hrefs: string[]): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    if (matches(pathname, href) && (!best || href.length > best.length)) best = href;
  }
  return best;
}

/** Href aktif di bottom nav: halaman di luar menu mobile jatuh ke "Lainnya". */
export function resolveMobileActiveHref(pathname: string, items: AppNavItem[]): string {
  const hrefs = items.filter((item) => item.href !== MORE_NAV_ITEM.href).map((item) => item.href);
  return resolveActiveHref(pathname, hrefs) ?? MORE_NAV_ITEM.href;
}
