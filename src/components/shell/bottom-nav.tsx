"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartNoAxesCombined,
  Grid2X2,
  HandCoins,
  LayoutDashboard,
  ReceiptText,
  type LucideIcon,
} from "lucide-react";
import { isNavActive } from "./nav-config";
import { cn } from "@/lib/cn";

const ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Beranda", icon: LayoutDashboard },
  { href: "/transaksi", label: "Transaksi", icon: ReceiptText },
  { href: "/piutang", label: "Piutang", icon: HandCoins },
  { href: "/laporan", label: "Laporan", icon: ChartNoAxesCombined },
  { href: "/lainnya", label: "Lainnya", icon: Grid2X2 },
];

export function BottomNav({ outstandingCount = 0 }: { outstandingCount?: number }) {
  const pathname = usePathname();

  return (
    <nav
      className="no-print fixed inset-x-3 bottom-3 z-50 rounded-[22px] border border-white/[0.08] bg-pine/95 px-1.5 pb-safe pt-1.5 shadow-float backdrop-blur-xl lg:hidden"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navigasi utama"
    >
      <div className="grid grid-cols-5">
        {ITEMS.map((item) => {
          const active = isNavActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-2xl px-0.5 pb-1 pt-1.5 transition-colors",
                active ? "text-white" : "text-white/40",
              )}
            >
              <span
                className={cn(
                  "relative flex h-7 w-11 items-center justify-center rounded-full transition-all",
                  active ? "bg-brand text-white shadow-[0_6px_18px_-6px_rgba(240,90,40,0.85)]" : "group-active:bg-white/10",
                )}
              >
                <Icon size={18} strokeWidth={active ? 2.6 : 2} />
                {item.href === "/piutang" && outstandingCount > 0 && (
                  <span className="absolute -right-0.5 -top-1 min-w-4 rounded-full bg-lime px-1 text-center text-[9px] font-extrabold leading-4 text-pine">
                    {outstandingCount > 9 ? "9+" : outstandingCount}
                  </span>
                )}
              </span>
              <span className={cn("text-[10px] font-bold leading-none", active ? "text-white" : "text-white/45")}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
