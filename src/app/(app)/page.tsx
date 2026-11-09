import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ArrowUpRightFromSquare,
  CalendarClock,
  CircleDollarSign,
  HandCoins,
  Landmark,
  PackageSearch,
  Plus,
  ReceiptText,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDashboardData, getTodayGreeting } from "@/lib/queries/dashboard";
import { formatRupiah, formatCompactRupiah } from "@/lib/format";
import { dueLabel, formatTimeID, formatDateID } from "@/lib/dates";
import { growth } from "@/lib/calculations";
import { RevenueBars } from "@/components/dashboard/revenue-bars";
import { PaymentBadge, DueBadge } from "@/components/ui/status-badge";
import { Avatar } from "@/components/ui/avatar";
import { SectionHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Beranda" };

const QUICK_ACTIONS = [
  { href: "/transaksi/baru", label: "Transaksi", icon: Plus, primary: true },
  { href: "/piutang", label: "Catat Bayar", icon: HandCoins },
  { href: "/pelanggan", label: "Pelanggan", icon: Users },
  { href: "/pengeluaran", label: "Pengeluaran", icon: WalletCards },
];

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await getDashboardData();
  const trend = growth(data.todayRevenue, data.yesterdayRevenue);
  const greeting = getTodayGreeting();
  const todayLabel = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Jakarta",
  }).format(new Date());
  const firstName = user.name.split(" ")[0];
  const quickActions = QUICK_ACTIONS.filter(
    (action) => user.role === "owner" || action.href !== "/pengeluaran",
  );

  const receivableSegments = [
    {
      label: "Lewat jatuh tempo",
      value: data.receivables.overdueTotal,
      count: data.receivables.overdueCount,
      color: "bg-danger",
    },
    {
      label: "Jatuh tempo ≤7 hari",
      value: data.receivables.dueSoonTotal,
      count: 0,
      color: "bg-warning",
    },
    {
      label: "Masih lancar",
      value: Math.max(0, data.receivables.total - data.receivables.overdueTotal - data.receivables.dueSoonTotal),
      count: Math.max(0, data.receivables.count - data.receivables.overdueCount),
      color: "bg-success",
    },
  ];

  return (
    <div className="animate-fade-up space-y-5 sm:space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="eyebrow">{todayLabel}</div>
          <h1 className="mt-1.5 font-display text-[1.65rem] font-extrabold tracking-[-0.04em] text-ink">
            {greeting}, {firstName}.
          </h1>
        </div>
        <div className="hidden items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[9.5px] font-bold text-muted lg:flex">
          <span className="size-1.5 rounded-full bg-success" />
          Data terkini
        </div>
      </div>

      <section className="relative isolate overflow-hidden rounded-[28px] bg-pine text-white shadow-[0_20px_60px_-32px_rgba(23,35,29,0.8)]">
        <div className="dot-grid pointer-events-none absolute inset-0 opacity-30 [mask-image:linear-gradient(115deg,black,transparent_70%)]" />
        <div className="pointer-events-none absolute -right-24 -top-28 size-80 rounded-full border-[48px] border-brand/20" />
        <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[1fr_296px] lg:gap-10 lg:p-8">
          <div className="flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] font-bold text-white/65">
                  <span className="size-1.5 rounded-full bg-lime live-dot" />
                  Ringkasan hari ini
                </span>
                <span className="hidden text-[10px] font-semibold text-white/35 sm:inline">{formatDateID(data.today)}</span>
              </div>
              <div className="mt-6 flex flex-wrap items-end gap-x-5 gap-y-2">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.13em] text-white/40">Omset hari ini</div>
                  <div className="mt-1.5 font-display text-[2.35rem] font-extrabold leading-none tracking-[-0.055em] tabular sm:text-[3.2rem]">
                    {formatRupiah(data.todayRevenue)}
                  </div>
                </div>
                <div className="mb-1 flex items-center gap-1.5 rounded-full bg-white/[0.07] px-2.5 py-1.5 text-[10px] font-bold text-white/65">
                  {trend == null ? (
                    <>
                      <TrendingUp size={12} className="text-lime" /> Hari pertama
                    </>
                  ) : trend >= 0 ? (
                    <>
                      <ArrowUpRight size={13} className="text-lime" /> {trend}% vs kemarin
                    </>
                  ) : (
                    <>
                      <ArrowDownRight size={13} className="text-[#ffb097]" /> {Math.abs(trend)}% vs kemarin
                    </>
                  )}
                </div>
              </div>
              <p className="mt-3 text-[11px] text-white/40">
                {data.todayTransactions} transaksi tercatat · {formatRupiah(data.todayCash)} kas diterima
              </p>
            </div>

            <div className="mt-7 grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap">
              {quickActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[11.5px] font-extrabold transition active:scale-[0.98] sm:px-4",
                    action.primary
                      ? "bg-brand text-white shadow-[0_8px_20px_-10px_rgba(240,90,40,0.9)] hover:bg-[#ff6a38]"
                      : "border border-white/10 bg-white/[0.06] text-white/75 hover:bg-white/[0.1] hover:text-white",
                  )}
                >
                  <action.icon size={14} strokeWidth={2.5} />
                  {action.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.055] p-3.5 lg:flex lg:items-center lg:justify-between">
              <div className="flex items-center gap-2 text-[10px] font-bold text-white/45">
                <ReceiptText size={14} className="text-lime" /> Transaksi hari ini
              </div>
              <div className="mt-2 font-display text-2xl font-extrabold tabular lg:mt-0">{data.todayTransactions}</div>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.055] p-3.5 lg:flex lg:items-center lg:justify-between">
              <div className="flex items-center gap-2 text-[10px] font-bold text-white/45">
                <CircleDollarSign size={14} className="text-lime" /> Kas masuk
              </div>
              <div className="mt-2 font-display text-[15px] font-extrabold tabular lg:mt-0">
                {formatCompactRupiah(data.todayCash)}
              </div>
            </div>
            <div className="col-span-2 rounded-2xl border border-white/[0.08] bg-white/[0.055] p-3.5 sm:col-span-1 lg:flex lg:items-center lg:justify-between">
              <div className="flex items-center gap-2 text-[10px] font-bold text-white/45">
                <CalendarClock size={14} className="text-brand" /> Perlu ditagih
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-2 lg:mt-0 lg:justify-end lg:gap-2.5">
                <div className="font-display text-[15px] font-extrabold tabular">
                  {formatCompactRupiah(data.receivables.overdueTotal)}
                </div>
                <Link href="/piutang?filter=jatuh_tempo" className="text-[10px] font-bold text-brand hover:text-[#ff8a60]">
                  {data.receivables.overdueCount} nota →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Link href="/laporan" className="card group p-4 transition hover:-translate-y-0.5 hover:border-line-strong sm:p-5">
          <div className="flex items-center justify-between">
            <span className="icon-tile bg-brand-soft text-brand">
              <TrendingUp size={18} />
            </span>
            <ArrowUpRight size={15} className="text-faint transition group-hover:text-ink" />
          </div>
          <div className="mt-4 text-[10px] font-extrabold uppercase tracking-[0.1em] text-faint">Omset bulan ini</div>
          <div className="mt-1.5 font-display text-[1.35rem] font-extrabold tracking-tight text-ink tabular sm:text-2xl">
            {formatRupiah(data.monthRevenue)}
          </div>
          <div className="mt-1 text-[10px] font-medium text-muted">sampai hari ini</div>
        </Link>

        <Link href="/laporan" className="card group p-4 transition hover:-translate-y-0.5 hover:border-line-strong sm:p-5">
          <div className="flex items-center justify-between">
            <span className="icon-tile bg-success-soft text-success">
              <CircleDollarSign size={18} />
            </span>
            <ArrowUpRight size={15} className="text-faint transition group-hover:text-ink" />
          </div>
          <div className="mt-4 text-[10px] font-extrabold uppercase tracking-[0.1em] text-faint">Laba bersih</div>
          <div className="mt-1.5 font-display text-[1.35rem] font-extrabold tracking-tight text-ink tabular sm:text-2xl">
            {formatRupiah(data.monthProfit)}
          </div>
          <div className="mt-1 text-[10px] font-medium text-muted">setelah HPP & biaya</div>
        </Link>

        <Link href="/piutang" className="card group p-4 transition hover:-translate-y-0.5 hover:border-line-strong sm:p-5">
          <div className="flex items-center justify-between">
            <span className="icon-tile bg-warning-soft text-warning">
              <HandCoins size={18} />
            </span>
            <ArrowUpRight size={15} className="text-faint transition group-hover:text-ink" />
          </div>
          <div className="mt-4 text-[10px] font-extrabold uppercase tracking-[0.1em] text-faint">Piutang berjalan</div>
          <div className="mt-1.5 font-display text-[1.35rem] font-extrabold tracking-tight text-ink tabular sm:text-2xl">
            {formatRupiah(data.receivables.total)}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[10px] font-medium text-muted">
            <span className={cn("size-1.5 rounded-full", data.receivables.overdueCount > 0 ? "bg-danger" : "bg-success")} />
            {data.receivables.count} nota terbuka
          </div>
        </Link>

        <Link href="/hutang" className="card group p-4 transition hover:-translate-y-0.5 hover:border-line-strong sm:p-5">
          <div className="flex items-center justify-between">
            <span className="icon-tile bg-[#eef0ea] text-pine">
              <Landmark size={18} />
            </span>
            <ArrowUpRight size={15} className="text-faint transition group-hover:text-ink" />
          </div>
          <div className="mt-4 text-[10px] font-extrabold uppercase tracking-[0.1em] text-faint">Hutang supplier</div>
          <div className="mt-1.5 font-display text-[1.35rem] font-extrabold tracking-tight text-ink tabular sm:text-2xl">
            {formatRupiah(data.payables.total)}
          </div>
          <div className="mt-1 text-[10px] font-medium text-muted">
            {data.payables.count} tagihan · {data.payables.overdueCount} jatuh tempo
          </div>
        </Link>
      </section>

      {data.lowStock.length > 0 && (
        <Link
          href="/stok?low=1"
          className="flex items-center gap-3 rounded-2xl border border-warning/20 bg-warning-soft px-4 py-3 transition hover:border-warning/40"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
            <PackageSearch size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-extrabold text-warning">
              {data.lowStock.length} sparepart perlu segera di-restock
            </p>
            <p className="truncate text-[10px] font-medium text-warning/70">
              {data.lowStock.slice(0, 3).map((item) => `${item.name} (${item.stock})`).join(" · ")}
            </p>
          </div>
          <ArrowRight size={15} className="shrink-0 text-warning/60" />
        </Link>
      )}

      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="card p-5 sm:p-6">
          <RevenueBars data={data.weekly} today={data.today} />
        </div>

        <div className="card flex flex-col p-5 sm:p-6">
          <SectionHeader
            title="Kesehatan piutang"
            description="Komposisi tagihan yang belum dibayar"
            action={
              <Link href="/piutang" className="text-[10px] font-extrabold text-brand hover:text-brand-dark">
                Detail →
              </Link>
            }
          />
          <div className="mt-5 flex items-end justify-between">
            <div>
              <div className="font-display text-[1.75rem] font-extrabold tracking-tight text-ink tabular">
                {formatRupiah(data.receivables.total)}
              </div>
              <div className="mt-1 text-[10px] font-medium text-muted">
                dari {data.receivables.count} nota belum lunas
              </div>
            </div>
            {data.receivables.overdueCount > 0 && (
              <span className="badge-danger">{data.receivables.overdueCount} telat</span>
            )}
          </div>

          <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-[#efe9de]">
            {receivableSegments.map((segment) =>
              segment.value > 0 ? (
                <div
                  key={segment.label}
                  className={cn("h-full", segment.color)}
                  style={{ width: `${(segment.value / Math.max(data.receivables.total, 1)) * 100}%` }}
                />
              ) : null,
            )}
          </div>

          <div className="mt-4 space-y-2.5">
            {receivableSegments.map((segment) => (
              <div key={segment.label} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2 font-semibold text-muted">
                  <span className={cn("size-2 rounded-full", segment.color)} />
                  {segment.label}
                </div>
                <span className="font-bold text-ink tabular">{formatCompactRupiah(segment.value)}</span>
              </div>
            ))}
          </div>

          <div className="mt-auto pt-5">
            <Link href="/piutang?filter=jatuh_tempo" className="btn-secondary w-full text-xs">
              Kelola piutang
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="card overflow-hidden">
          <div className="p-5 pb-4 sm:px-6">
            <SectionHeader
              title="Transaksi terakhir"
              description="Aktivitas servis paling baru"
              action={
                <Link href="/transaksi" className="text-[10px] font-extrabold text-brand hover:text-brand-dark">
                  Semua transaksi →
                </Link>
              }
            />
          </div>
          {data.recentTransactions.length === 0 ? (
            <EmptyState
              title="Belum ada transaksi"
              description="Mulai catat servis pertama hari ini."
              actionHref="/transaksi/baru"
              actionLabel="Buat transaksi"
            />
          ) : (
            <div className="divide-y divide-line/70">
              {data.recentTransactions.map((transaction) => (
                <Link
                  key={transaction.id}
                  href={`/transaksi/${transaction.id}`}
                  className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-[#faf7f1] sm:px-6"
                >
                  <Avatar name={transaction.customerName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[12.5px] font-bold text-ink">{transaction.customerName}</span>
                      <span className="hidden text-[9px] font-semibold text-faint sm:inline">·</span>
                      <span className="hidden text-[9px] font-semibold text-faint sm:inline">
                        {formatTimeID(transaction.createdAt)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-medium text-muted">
                      <span>{transaction.plateNumber ?? transaction.vehicleLabel ?? "Tanpa kendaraan"}</span>
                      <span className="text-line-strong">•</span>
                      <span className="truncate font-mono text-[9px] text-faint">{transaction.invoiceNo}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[12px] font-extrabold text-ink tabular">{formatRupiah(transaction.total)}</div>
                    <div className="mt-1 flex justify-end">
                      <PaymentBadge status={transaction.paymentStatus} compact />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card overflow-hidden">
          <div className="p-5 pb-4 sm:px-6">
            <SectionHeader
              title="Jatuh tempo dekat"
              description="Prioritas penagihan minggu ini"
              action={<CalendarClock size={16} className="text-faint" />}
            />
          </div>
          {data.dueSoon.length === 0 ? (
            <EmptyState title="Tidak ada tagihan mendesak" description="Semua piutang masih dalam jadwal." icon={HandCoins} />
          ) : (
            <div className="divide-y divide-line/70">
              {data.dueSoon.map((transaction) => {
                const due = dueLabel(transaction.dueDate, data.today);
                return (
                  <Link
                    key={transaction.id}
                    href={`/transaksi/${transaction.id}`}
                    className="block px-4 py-3.5 transition hover:bg-[#faf7f1] sm:px-6"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Avatar name={transaction.customerName} size="sm" />
                        <div className="min-w-0">
                          <div className="truncate text-[12px] font-bold text-ink">{transaction.customerName}</div>
                          <div className="mt-0.5 text-[9px] font-medium text-faint">{transaction.plateNumber}</div>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-[12px] font-extrabold text-ink tabular">{formatRupiah(transaction.remaining)}</div>
                        <div className="mt-1">
                          <DueBadge label={due.label} tone={due.tone} />
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
          <div className="p-4 pt-2 sm:px-6">
            <Link href="/piutang" className="btn-ghost w-full text-[11px]">
              Buka daftar piutang <ArrowUpRightFromSquare size={12} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
