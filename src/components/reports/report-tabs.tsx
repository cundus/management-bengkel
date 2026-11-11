"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { NAV_GROUPS } from "@/components/shell/nav-config";
import { cn } from "@/lib/cn";

const REPORT_TABS = NAV_GROUPS.find((group) => group.id === "laporan")?.items ?? [];

export function ReportTabs({ active, query }: { active: string; query?: string }) {
  const scroller = useRef<HTMLDivElement>(null);

  // Di layar sempit tab bisa keluar layar; geser tab aktif ke tengah tanpa ikut menggulir halaman.
  useEffect(() => {
    const container = scroller.current;
    const current = container?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!container || !current) return;
    container.scrollLeft = current.offsetLeft - (container.clientWidth - current.offsetWidth) / 2;
  }, [active]);

  return (
    <nav className="no-print -mx-4 mb-4 sm:mx-0" aria-label="Jenis laporan">
      <div ref={scroller} className="no-scrollbar relative flex gap-1.5 overflow-x-auto scroll-smooth px-4 sm:flex-wrap sm:px-0">
        {REPORT_TABS.map((tab) => {
          const current = tab.href === active;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={query ? `${tab.href}?${query}` : tab.href}
              aria-current={current ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-[11px] font-extrabold transition",
                current
                  ? "border-pine bg-pine text-white"
                  : "border-line-strong bg-surface text-muted hover:border-ink/30 hover:text-ink",
              )}
            >
              <Icon size={13} />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
