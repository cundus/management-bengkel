"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { mobileNavForRole, resolveMobileActiveHref } from "./nav-config";
import type { UserRole } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { NavigationPending } from "./navigation-pending";

export function BottomNav({
  role,
  outstandingCount = 0,
  voidRequestCount = 0,
}: {
  role: UserRole;
  outstandingCount?: number;
  voidRequestCount?: number;
}) {
  const pathname = usePathname();
  const items = mobileNavForRole(role);
  const activeHref = resolveMobileActiveHref(pathname, items);

  return (
    <nav
      className="no-print fixed inset-x-3 bottom-3 z-50 rounded-[22px] border border-white/[0.08] bg-pine/95 px-1.5 pb-safe pt-1.5 shadow-float backdrop-blur-xl lg:hidden"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navigasi utama"
    >
      <div className="grid grid-cols-5">
        {items.map((item) => {
          const active = item.href === activeHref;
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
              <NavigationPending />
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
                {item.href === "/transaksi" && voidRequestCount > 0 && (
                  <span
                    className="absolute -right-0.5 -top-1 min-w-4 rounded-full bg-warning-soft px-1 text-center text-[9px] font-extrabold leading-4 text-warning"
                    aria-label={`${voidRequestCount} pengajuan pembatalan`}
                  >
                    {voidRequestCount > 9 ? "9+" : voidRequestCount}
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
