"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut, Plus } from "lucide-react";
import { BrandLogo } from "@/components/brand";
import { allNavItems, navGroupsForRole, resolveActiveHref, type AppNavItem, type NavBadge } from "./nav-config";
import { logoutAction } from "@/actions/auth";
import { ROLE_LABELS, type UserRole } from "@/lib/constants";
import { initials } from "@/lib/format";
import { cn } from "@/lib/cn";
import { NavigationPending } from "./navigation-pending";

const COLLAPSED_KEY = "wmc225:sidebar-collapsed";

const BADGE_STYLES: Record<NavBadge, string> = {
  outstanding: "bg-brand text-white",
  voidRequests: "bg-warning-soft text-warning",
  lowStock: "bg-lime/20 text-lime",
};

function readCollapsed(): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(COLLAPSED_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeCollapsed(ids: string[]) {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, JSON.stringify(ids));
  } catch {
    // localStorage tidak tersedia (mode privat); status lipat cukup berlaku di sesi ini.
  }
}

export function Sidebar({
  user,
  outstandingCount,
  lowStockCount,
  voidRequestCount = 0,
}: {
  user: { name: string; email: string; role: UserRole };
  outstandingCount: number;
  lowStockCount: number;
  voidRequestCount?: number;
}) {
  const pathname = usePathname();
  const groups = navGroupsForRole(user.role);
  const activeHref = resolveActiveHref(
    pathname,
    allNavItems().map((item) => item.href),
  );
  const [collapsed, setCollapsed] = useState<string[]>([]);

  useEffect(() => {
    setCollapsed(readCollapsed());
  }, []);

  const toggle = (id: string) => {
    setCollapsed((current) => {
      const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
      writeCollapsed(next);
      return next;
    });
  };

  const badgeCounts: Record<NavBadge, number> = {
    outstanding: outstandingCount,
    lowStock: lowStockCount,
    voidRequests: voidRequestCount,
  };

  const renderItem = (item: AppNavItem) => {
    const active = item.href === activeHref;
    const Icon = item.icon;
    const badge = item.badge && badgeCounts[item.badge] > 0 ? badgeCounts[item.badge] : null;
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-bold transition-all",
          active
            ? "bg-white/[0.1] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
            : "text-white/55 hover:bg-white/[0.05] hover:text-white/90",
        )}
      >
        <NavigationPending />
        <span
          className={cn(
            "flex size-7 items-center justify-center rounded-lg transition-colors",
            active ? "bg-brand text-white" : "bg-white/[0.04] text-white/45 group-hover:text-white/80",
          )}
        >
          <Icon size={15} strokeWidth={2.2} />
        </span>
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {badge && item.badge ? (
          <span
            className={cn(
              "min-w-5 rounded-md px-1.5 py-0.5 text-center text-[10px] font-extrabold tabular",
              BADGE_STYLES[item.badge],
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

      <nav className="no-scrollbar relative flex-1 overflow-y-auto px-4 pb-6 pt-5" aria-label="Navigasi utama">
        {groups.map((group, index) => {
          const hasActive = group.items.some((item) => item.href === activeHref);
          // Grup dengan halaman aktif selalu terbuka supaya posisi pengguna tetap terlihat.
          const open = hasActive || !collapsed.includes(group.id);
          const isHome = group.id === "utama";
          return (
            <div key={group.id} className={cn(index > 0 && "mt-4")}>
              {!isHome && (
                <button
                  type="button"
                  onClick={() => toggle(group.id)}
                  disabled={hasActive}
                  aria-expanded={open}
                  className="mb-1 flex w-full items-center justify-between rounded-lg px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/30 transition hover:text-white/55 disabled:cursor-default disabled:hover:text-white/30"
                >
                  {group.label}
                  {!hasActive && (
                    <ChevronDown size={12} className={cn("transition-transform", !open && "-rotate-90")} />
                  )}
                </button>
              )}
              {open && <div className="space-y-0.5">{group.items.map(renderItem)}</div>}
            </div>
          );
        })}
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
