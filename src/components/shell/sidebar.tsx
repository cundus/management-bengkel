"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartNoAxesCombined,
  HandCoins,
  LayoutDashboard,
  Landmark,
  LogOut,
  PackageSearch,
  Plus,
  ReceiptText,
  Settings2,
  Users,
  WalletCards,
  Grid2X2,
  type LucideIcon,
} from "lucide-react";
import { BrandLogo } from "@/components/brand";
import { PRIMARY_NAV, SECONDARY_NAV, isNavActive } from "./nav-config";
import { logoutAction } from "@/actions/auth";
import { ROLE_LABELS, type UserRole } from "@/lib/constants";
import { initials } from "@/lib/format";
import { cn } from "@/lib/cn";

const ICONS: Record<string, LucideIcon> = {
  "/": LayoutDashboard,
  "/transaksi": ReceiptText,
  "/piutang": HandCoins,
  "/laporan": ChartNoAxesCombined,
  "/lainnya": Grid2X2,
  "/pelanggan": Users,
  "/stok": PackageSearch,
  "/pengeluaran": WalletCards,
  "/hutang": Landmark,
  "/pengaturan": Settings2,
};

export function Sidebar({
  user,
  outstandingCount,
  lowStockCount,
}: {
  user: { name: string; email: string; role: UserRole };
  outstandingCount: number;
  lowStockCount: number;
}) {
  const pathname = usePathname();
  const primary = PRIMARY_NAV.filter((item) => item.href !== "/lainnya");
  const secondary = SECONDARY_NAV.filter(
    (item) => user.role === "owner" || !["/pengeluaran", "/hutang", "/pengaturan"].includes(item.href),
  );

  const renderItem = (item: (typeof PRIMARY_NAV)[number]) => {
    const active = isNavActive(pathname, item.href);
    const Icon = ICONS[item.href] ?? LayoutDashboard;
    const badge =
      item.href === "/piutang" && outstandingCount > 0
        ? outstandingCount
        : item.href === "/stok" && lowStockCount > 0
          ? lowStockCount
          : null;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-bold transition-all",
          active
            ? "bg-white/[0.1] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
            : "text-white/55 hover:bg-white/[0.05] hover:text-white/90",
        )}
      >
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-lg transition-colors",
            active ? "bg-brand text-white" : "bg-white/[0.04] text-white/45 group-hover:text-white/80",
          )}
        >
          <Icon size={16} strokeWidth={2.2} />
        </span>
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {badge ? (
          <span
            className={cn(
              "min-w-5 rounded-md px-1.5 py-0.5 text-center text-[10px] font-extrabold tabular",
              item.href === "/piutang" ? "bg-brand text-white" : "bg-lime/20 text-lime",
            )}
          >
            {badge > 99 ? "99+" : badge}
          </span>
        ) : null}
      </Link>
    );
  };

  return (
    <aside className="no-print fixed inset-y-0 left-0 z-40 hidden w-[268px] flex-col bg-pine text-white lg:flex">
      <div className="dot-grid absolute inset-x-0 top-0 h-52 opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div className="relative flex items-center px-6 pb-7 pt-7">
        <BrandLogo light />
      </div>

      <div className="relative px-4">
        <Link
          href="/transaksi/baru"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-extrabold text-white shadow-[0_10px_30px_-10px_rgba(240,90,40,0.8)] transition hover:bg-[#ff6a38] active:scale-[0.99]"
        >
          <Plus size={17} strokeWidth={3} />
          Transaksi Baru
        </Link>
      </div>

      <nav className="no-scrollbar relative flex-1 overflow-y-auto px-4 pb-6 pt-6">
        <div className="mb-2 px-3 text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/30">Menu utama</div>
        <div className="space-y-1">{primary.map(renderItem)}</div>

        <div className="mb-2 mt-7 px-3 text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/30">
          Operasional
        </div>
        <div className="space-y-1">{secondary.map(renderItem)}</div>
      </nav>

      <div className="relative m-4 mt-0 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lime font-display text-sm font-extrabold text-pine">
            {initials(user.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-bold text-white">{user.name}</div>
            <div className="truncate text-[10px] font-semibold uppercase tracking-wider text-white/35">
              {ROLE_LABELS[user.role]}
            </div>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              title="Keluar"
              className="flex size-8 items-center justify-center rounded-lg text-white/35 transition hover:bg-white/10 hover:text-white"
            >
              <LogOut size={15} />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
