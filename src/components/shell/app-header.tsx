import Link from "next/link";
import { Bell, Plus } from "lucide-react";
import { BrandLogo, BrandMark } from "@/components/brand";
import { initials } from "@/lib/format";
import type { UserRole } from "@/lib/constants";
import { ROLE_LABELS } from "@/lib/constants";
import { formatDateID } from "@/lib/dates";

export function MobileHeader({
  user,
  today,
  overdueCount,
}: {
  user: { name: string; role: UserRole };
  today: string;
  overdueCount: number;
}) {
  return (
    <header className="no-print sticky top-0 z-30 border-b border-line/70 bg-canvas/90 backdrop-blur-xl lg:hidden">
      <div className="flex items-center justify-between px-4 pb-2.5 pt-safe">
        <div className="flex items-center gap-2.5 pt-2">
          <BrandMark size={33} />
          <div>
            <div className="font-display text-[17px] font-extrabold leading-none tracking-[-0.04em] text-ink">
              WMC<span className="text-brand"> 225</span>
            </div>
            <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.16em] text-faint">Bengkel & Servis</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 pt-2">
          <Link
            href="/piutang"
            aria-label={`Piutang, ${overdueCount} jatuh tempo`}
            className="relative flex size-9 items-center justify-center rounded-xl border border-line bg-surface text-muted transition hover:text-ink"
          >
            <Bell size={17} />
            {overdueCount > 0 && (
              <span className="absolute right-1.5 top-1.5 size-2 rounded-full border-2 border-surface bg-brand" />
            )}
          </Link>
          <Link
            href="/transaksi/baru"
            aria-label="Buat transaksi baru"
            className="flex size-9 items-center justify-center rounded-xl bg-pine text-white shadow-sm transition active:scale-95"
          >
            <Plus size={19} strokeWidth={2.5} />
          </Link>
          <Link
            href="/pengaturan"
            aria-label="Buka pengaturan"
            className="ml-0.5 flex size-9 items-center justify-center rounded-xl bg-brand-soft font-display text-[11px] font-extrabold text-brand-dark"
          >
            {initials(user.name)}
          </Link>
        </div>
      </div>
    </header>
  );
}

export function DesktopHeader({
  user,
  today,
}: {
  user: { name: string; role: UserRole };
  today: string;
}) {
  return (
    <header className="no-print mb-2 hidden items-center justify-between border-b border-line/80 pb-5 lg:flex">
      <div>
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">
          <span className="size-1.5 rounded-full bg-success" />
          Operasional aktif
        </div>
        <p className="mt-1 text-sm font-semibold text-muted">{formatDateID(today)} · Bandung, Jawa Barat</p>
      </div>
      <div className="flex items-center gap-3">
        <Link href="/pengaturan" className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition hover:bg-black/[0.03]">
          <div className="text-right">
            <div className="text-[12.5px] font-bold leading-tight text-ink">{user.name}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-faint">{ROLE_LABELS[user.role]}</div>
          </div>
          <div className="flex size-9 items-center justify-center rounded-xl bg-pine font-display text-[11px] font-extrabold text-lime">
            {initials(user.name)}
          </div>
        </Link>
      </div>
    </header>
  );
}

export function AuthHeader() {
  return (
    <div className="flex items-center justify-between">
      <BrandLogo />
      <div className="hidden items-center gap-2 text-xs font-semibold text-muted sm:flex">
        <span className="size-2 rounded-full bg-success live-dot" />
        Sistem siap
      </div>
    </div>
  );
}
