import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  Download,
  HandCoins,
  Landmark,
  Package,
  ReceiptText,
  TrendingUp,
  WalletCards,
  Wrench,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getMonthlyReport, getReport, monthOptions } from "@/lib/queries/reports";
import { PageHeader } from "@/components/ui/page-header";
import { DailyRevenueChart } from "@/components/reports/daily-chart";
import { growth } from "@/lib/calculations";
import { addDaysISO, MAX_REPORT_RANGE_DAYS, monthLabel, rangeLabel, resolveReportPeriod, todayISO } from "@/lib/dates";
import { formatRupiah, percent } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Laporan" };

const METHOD_COLORS: Record<string, string> = {
  tunai: "bg-success",
  transfer: "bg-info",
  qris: "bg-brand",
};

const METHOD_LABELS: Record<string, string> = {
  tunai: "Tunai",
  transfer: "Transfer",
  qris: "QRIS",
};

const MARGIN_GROUPS = [
  { key: "jasa", label: "Jasa", title: "Margin produk jasa", unit: "pekerjaan", icon: Wrench },
  { key: "sparepart", label: "Barang", title: "Margin produk barang", unit: "unit", icon: Package },
] as const;

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; from?: string; to?: string }>;
}) {
  await requireUser();
  const params = await searchParams;
  const period = resolveReportPeriod(params);
  const isDaily = period.mode === "harian";
  const month = period.month;
  const report = isDaily ? await getReport(period.start, period.end) : await getMonthlyReport(month);
  const options = monthOptions(12);
  const today = todayISO();
  const periodQuery = isDaily ? `from=${period.start}&to=${period.end}` : `month=${month}`;
  const periodLabel = isDaily ? rangeLabel(period.start, period.end) : monthLabel(month);
  const previousLabel = isDaily ? "vs periode sebelumnya" : "vs bulan lalu";
  const thisPeriod = isDaily ? (period.start === period.end ? "pada hari ini" : "pada periode ini") : "bulan ini";
  const quickRanges = [
    { label: "Hari ini", from: today, to: today },
    { label: "Kemarin", from: addDaysISO(today, -1), to: addDaysISO(today, -1) },
    { label: "7 hari", from: addDaysISO(today, -6), to: today },
    { label: "30 hari", from: addDaysISO(today, -29), to: today },
  ];
  const dateInputClass =
    "h-10 rounded-xl border border-line-strong bg-surface px-2.5 text-[11.5px] font-extrabold text-ink outline-none focus:border-brand";
  const revenueGrowth = growth(report.revenue, report.previousRevenue);
  const margin = percent(report.netProfit, report.revenue);
  const totalExpense = report.expenseByCategory.reduce((sum, item) => sum + item.amount, 0);
  const cashInMethods = new Map(report.paymentMethods.map((method) => [method.method, method]));

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="Buku besar bengkel"
        title="Laporan keuangan"
        description="Pendapatan, biaya, laba, dan arus kas bulanan atau per interval harian dalam satu tampilan yang siap diambil keputusan."
        actions={
          <>
            <a href={`/api/export/laporan?${periodQuery}`} className="btn-secondary">
              <Download size={15} />
              <span className="hidden sm:inline">Ekspor laporan</span>
            </a>
            <nav className="flex rounded-xl border border-line-strong bg-surface p-0.5 text-[11px] font-extrabold" aria-label="Jenis laporan">
              <Link
                href={`/laporan?month=${month}`}
                aria-current={!isDaily ? "page" : undefined}
                className={cn("rounded-[10px] px-3 py-2", !isDaily ? "bg-pine text-white" : "text-muted hover:text-ink")}
              >
                Bulanan
              </Link>
              <Link
                href={`/laporan?from=${today}&to=${today}`}
                aria-current={isDaily ? "page" : undefined}
                className={cn("rounded-[10px] px-3 py-2", isDaily ? "bg-pine text-white" : "text-muted hover:text-ink")}
              >
                Harian
              </Link>
            </nav>
            {isDaily ? (
              <form method="get" action="/laporan" className="flex flex-wrap items-center gap-1.5">
                <input type="date" name="from" defaultValue={period.start} className={dateInputClass} aria-label="Dari tanggal" />
                <span className="text-[10px] font-bold text-faint">s/d</span>
                <input type="date" name="to" defaultValue={period.end} className={dateInputClass} aria-label="Sampai tanggal" />
                <button type="submit" className="btn-primary h-10 px-3 text-[11px]">
                  Lihat
                </button>
              </form>
            ) : (
            <form method="get" action="/laporan" className="flex items-center gap-1.5">
              <div className="relative">
                <CalendarDays size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                <select
                  name="month"
                  defaultValue={month}
                  className="h-10 appearance-none rounded-xl border border-line-strong bg-surface pl-8 pr-8 text-[11.5px] font-extrabold text-ink outline-none focus:border-brand"
                  aria-label="Pilih bulan laporan"
                >
                  {options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn-primary h-10 px-3 text-[11px]">
                Lihat
              </button>
            </form>
            )}
          </>
        }
      />

      {isDaily && (
        <nav className="mb-3 flex flex-wrap items-center gap-1.5" aria-label="Rentang cepat">
          {quickRanges.map((range) => {
            const active = range.from === period.start && range.to === period.end;
            return (
              <Link
                key={range.label}
                href={`/laporan?from=${range.from}&to=${range.to}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[10px] font-extrabold",
                  active ? "border-pine bg-pine text-white" : "border-line-strong bg-surface text-muted hover:text-ink",
                )}
              >
                {range.label}
              </Link>
            );
          })}
          <span className="text-[9.5px] font-medium text-faint">Maksimal {MAX_REPORT_RANGE_DAYS} hari per laporan.</span>
        </nav>
      )}

      <section className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="badge-neutral">
            <CalendarDays size={11} /> {periodLabel}
          </span>
          <span className="text-[10px] font-medium text-faint">
            {report.transactions} transaksi · {report.daily.filter((d) => d.revenue > 0).length} hari operasional
            {isDaily && report.daily.length > 1 ? ` dari ${report.daily.length} hari` : ""}
          </span>
        </div>
        <div className="text-[10px] font-semibold text-faint">Semua angka dalam Rupiah</div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <div className="relative overflow-hidden rounded-3xl bg-pine p-4 text-white sm:p-5">
          <div className="pointer-events-none absolute -right-8 -top-10 size-28 rounded-full border-[18px] border-brand/25" />
          <div className="flex items-center justify-between">
            <div className="flex size-8 items-center justify-center rounded-lg bg-white/10 text-lime">
              <TrendingUp size={16} />
            </div>
            {revenueGrowth != null && (
              <span className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[9px] font-extrabold">
                {revenueGrowth >= 0 ? <ArrowUpRight size={10} className="text-lime" /> : <ArrowDownRight size={10} className="text-[#ffb097]" />}
                {revenueGrowth >= 0 ? "+" : ""}
                {revenueGrowth}%
              </span>
            )}
          </div>
          <div className="mt-4 text-[9px] font-extrabold uppercase tracking-[0.1em] text-white/40">Omset</div>
          <div className="mt-1 font-display text-[1.2rem] font-extrabold tracking-tight tabular sm:text-[1.45rem]">
            {formatRupiah(report.revenue)}
          </div>
          <div className="mt-1 text-[9px] font-medium text-white/35">{previousLabel}</div>
        </div>

        <div className="card p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="flex size-8 items-center justify-center rounded-lg bg-success-soft text-success">
              <CircleDollarSign size={16} />
            </div>
            <span className="text-[9px] font-extrabold text-faint">Margin {margin}%</span>
          </div>
          <div className="mt-4 text-[9px] font-extrabold uppercase tracking-[0.1em] text-faint">Laba bersih</div>
          <div className="mt-1 font-display text-[1.2rem] font-extrabold tracking-tight text-ink tabular sm:text-[1.45rem]">
            {formatRupiah(report.netProfit)}
          </div>
          <div className="mt-1 text-[9px] font-medium text-muted">setelah HPP & biaya</div>
        </div>

        <div className="card p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="flex size-8 items-center justify-center rounded-lg bg-info-soft text-info">
              <ArrowUpRight size={16} />
            </div>
          </div>
          <div className="mt-4 text-[9px] font-extrabold uppercase tracking-[0.1em] text-faint">Kas diterima</div>
          <div className="mt-1 font-display text-[1.2rem] font-extrabold tracking-tight text-ink tabular sm:text-[1.45rem]">
            {formatRupiah(report.cashIn)}
          </div>
          <div className="mt-1 text-[9px] font-medium text-muted">termasuk pelunasan piutang</div>
        </div>

        <div className="card p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="flex size-8 items-center justify-center rounded-lg bg-warning-soft text-warning">
              <HandCoins size={16} />
            </div>
            <span className="badge-danger">{report.overdue > 0 ? "Ada tunggakan" : "Sehat"}</span>
          </div>
          <div className="mt-4 text-[9px] font-extrabold uppercase tracking-[0.1em] text-faint">Piutang berjalan</div>
          <div className="mt-1 font-display text-[1.2rem] font-extrabold tracking-tight text-ink tabular sm:text-[1.45rem]">
            {formatRupiah(report.outstanding)}
          </div>
          <div className="mt-1 text-[9px] font-medium text-muted">{formatRupiah(report.overdue)} lewat tempo</div>
        </div>
      </section>

      <section className="card mt-4 p-5 sm:p-6">
        <DailyRevenueChart daily={report.daily} start={report.start} end={report.end} />
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="card p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="eyebrow">Laba rugi</div>
              <h2 className="mt-1 section-title">Dari omset ke laba</h2>
            </div>
            <BarChart3 size={18} className="text-faint" />
          </div>
          <div className="mt-5 space-y-1">
            <div className="flex justify-between py-2 text-[12px]">
              <span className="font-semibold text-muted">Pendapatan (omset)</span>
              <span className="font-extrabold text-ink tabular">{formatRupiah(report.revenue)}</span>
            </div>
            <div className="flex justify-between py-2 text-[12px]">
              <span className="font-semibold text-muted">Harga pokok (HPP)</span>
              <span className="font-semibold text-danger tabular">−{formatRupiah(report.cogs)}</span>
            </div>
            <div className="flex justify-between border-t border-line py-2.5 text-[12px]">
              <span className="font-extrabold text-ink">Laba kotor</span>
              <span className="font-extrabold text-ink tabular">{formatRupiah(report.grossProfit)}</span>
            </div>
            <div className="flex justify-between py-2 text-[12px]">
              <span className="font-semibold text-muted">Biaya operasional</span>
              <span className="font-semibold text-danger tabular">−{formatRupiah(report.expenses)}</span>
            </div>
            {report.cancellationIncome > 0 && (
              <div className="flex justify-between py-2 text-[12px]">
                <span className="font-semibold text-muted">Pendapatan pembatalan</span>
                <span className="font-semibold text-success tabular">+{formatRupiah(report.cancellationIncome)}</span>
              </div>
            )}
            {report.stockAdjustment !== 0 && (
              <div className="flex justify-between py-2 text-[12px]">
                <Link href={`/stok/penyesuaian?month=${month}`} className="font-semibold text-muted underline">Selisih penyesuaian stok</Link>
                <span className={cn("font-semibold tabular", report.stockAdjustment < 0 ? "text-danger" : "text-success")}>
                  {report.stockAdjustment < 0 ? "−" : "+"}{formatRupiah(Math.abs(report.stockAdjustment))}
                </span>
              </div>
            )}
            <div className="mt-1 flex items-center justify-between rounded-xl bg-pine px-4 py-3.5">
              <div>
                <div className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-white/40">Laba bersih</div>
                <div className="mt-0.5 text-[9px] font-medium text-white/30">
                  Pendapatan − HPP − biaya{report.cancellationIncome > 0 ? " + pembatalan" : ""}{report.stockAdjustment !== 0 ? " ± selisih stok" : ""}
                </div>
              </div>
              <div className="font-display text-[1.3rem] font-extrabold tracking-tight text-lime tabular">
                {formatRupiah(report.netProfit)}
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-xl border border-line bg-[#fbf9f4] px-3.5 py-2.5">
            <span className="text-[10px] font-semibold text-muted">
              {isDaily ? `Biaya periode sebelumnya (${rangeLabel(report.previousStart, report.previousEnd)})` : "Biaya bulan lalu"}
            </span>
            <span className="text-[10px] font-extrabold text-ink tabular">{formatRupiah(report.previousExpenses)}</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="eyebrow">Arus kas</div>
                <h2 className="mt-1 section-title">Uang masuk vs keluar</h2>
              </div>
              <WalletCards size={18} className="text-faint" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <div className="rounded-xl bg-success-soft px-3.5 py-3">
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-success/70">
                  <ArrowUpRight size={11} /> Masuk
                </div>
                <div className="mt-1 text-[13px] font-extrabold text-success tabular">{formatRupiah(report.cashIn)}</div>
              </div>
              <div className="rounded-xl bg-danger-soft px-3.5 py-3">
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-danger/70">
                  <ArrowDownRight size={11} /> Keluar
                </div>
                <div className="mt-1 text-[13px] font-extrabold text-danger tabular">{formatRupiah(report.cashOut)}</div>
              </div>
            </div>
            <div className="mt-3 space-y-2 text-[10px]">
              <div className="flex justify-between text-muted">
                <span>Pengeluaran operasional</span>
                <span className="font-bold text-ink tabular">{formatRupiah(report.expenses)}</span>
              </div>
              <div className="flex justify-between text-muted">
                <span>Pembayaran hutang supplier</span>
                <span className="font-bold text-ink tabular">
                  {formatRupiah(Math.max(0, report.cashOut - report.expenses - report.refunds))}
                </span>
              </div>
              {report.refunds > 0 && (
                <div className="flex justify-between text-muted">
                  <span>Refund nota batal</span>
                  <span className="font-bold text-ink tabular">{formatRupiah(report.refunds)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-line pt-2.5 text-[11px]">
                <span className="font-extrabold text-ink">Arus kas bersih</span>
                <span className={cn("font-extrabold tabular", report.netCash >= 0 ? "text-success" : "text-danger")}>
                  {formatRupiah(report.netCash)}
                </span>
              </div>
            </div>
          </div>

          <div className="card p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="eyebrow">Metode pembayaran</div>
                <h2 className="mt-1 section-title">Cara pelanggan membayar</h2>
              </div>
              <Landmark size={18} className="text-faint" />
            </div>
            {report.paymentMethods.length === 0 ? (
              <p className="mt-5 rounded-xl border border-dashed border-line px-4 py-6 text-center text-[10px] text-faint">
                Belum ada pembayaran {thisPeriod}.
              </p>
            ) : (
              <>
                <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-[#efe9de]">
                  {report.paymentMethods.map((method) => (
                    <div
                      key={method.method}
                      className={cn("h-full", METHOD_COLORS[method.method] ?? "bg-pine")}
                      style={{ width: `${percent(method.amount, report.cashIn)}%` }}
                      title={`${METHOD_LABELS[method.method]}: ${formatRupiah(method.amount)}`}
                    />
                  ))}
                </div>
                <div className="mt-4 space-y-2.5">
                  {report.paymentMethods.map((method) => (
                    <div key={method.method} className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-[10.5px] font-semibold text-muted">
                        <span className={cn("size-2 rounded-full", METHOD_COLORS[method.method] ?? "bg-pine")} />
                        {METHOD_LABELS[method.method] ?? method.method}
                        <span className="text-[9px] text-faint">({cashInMethods.get(method.method)?.count ?? 0}×)</span>
                      </span>
                      <span className="text-[11px] font-extrabold text-ink tabular">{formatRupiah(method.amount)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-2">
        {MARGIN_GROUPS.map((group) => {
          const summary = report.categoryMargins[group.key];
          const items = report.itemMargins[group.key];
          const Icon = group.icon;
          return (
            <div key={group.key} className="card p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="eyebrow">Margin {group.label.toLowerCase()}</div>
                  <h2 className="mt-1 section-title">{group.title}</h2>
                </div>
                <Icon size={18} className="text-faint" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {[
                  { label: "Omset", value: formatRupiah(summary.revenue) },
                  { label: "Modal (HPP)", value: formatRupiah(summary.cost) },
                  { label: "Laba kotor", value: formatRupiah(summary.grossProfit) },
                  { label: "Margin", value: `${summary.margin}%` },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl bg-[#fbf9f4] px-3 py-2.5">
                    <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-faint">{stat.label}</div>
                    <div className="mt-0.5 text-[12px] font-extrabold text-ink tabular">{stat.value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-[9.5px] font-medium text-faint">
                {percent(summary.revenue, report.revenue)}% dari omset · {summary.qty} {group.unit} terjual
              </div>
              {items.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-line px-4 py-6 text-center text-[10px] text-faint">
                  Belum ada penjualan {group.label.toLowerCase()} {thisPeriod}.
                </p>
              ) : (
                <div className="table-wrap mt-3">
                  <table className="data-table min-w-[460px]">
                    <thead>
                      <tr>
                        <th>{group.label}</th>
                        <th className="text-center">Qty</th>
                        <th className="text-right">Omset</th>
                        <th className="text-right">Laba</th>
                        <th className="text-right">Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.slice(0, 8).map((item) => (
                        <tr key={item.name}>
                          <td className="max-w-[180px] truncate text-[11px] font-semibold text-ink">{item.name}</td>
                          <td className="text-center text-[11px] text-muted tabular">{item.qty}</td>
                          <td className="text-right text-[11px] text-muted tabular">{formatRupiah(item.revenue)}</td>
                          <td
                            className={cn(
                              "text-right text-[11px] font-bold tabular",
                              item.grossProfit >= 0 ? "text-ink" : "text-danger",
                            )}
                          >
                            {formatRupiah(item.grossProfit)}
                          </td>
                          <td className="text-right text-[11px] font-semibold text-muted tabular">{item.margin}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {items.length > 8 && (
                    <div className="mt-2 text-[9.5px] font-medium text-faint">
                      +{items.length - 8} {group.label.toLowerCase()} lain — lihat lengkapnya di ekspor laporan.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="card p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="eyebrow">Biaya operasional</div>
              <h2 className="mt-1 section-title">Ke mana uang keluar</h2>
            </div>
            <span className="text-[11px] font-extrabold text-ink tabular">{formatRupiah(totalExpense)}</span>
          </div>
          {report.expenseByCategory.length === 0 ? (
            <p className="mt-5 rounded-xl border border-dashed border-line px-4 py-6 text-center text-[10px] text-faint">
              Belum ada pengeluaran tercatat.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {report.expenseByCategory.map((expense) => (
                <div key={expense.category}>
                  <div className="flex justify-between text-[10.5px]">
                    <span className="font-semibold text-muted">{expense.category}</span>
                    <span className="font-extrabold text-ink tabular">{formatRupiah(expense.amount)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#efe9de]">
                    <div
                      className="h-full rounded-full bg-warning"
                      style={{ width: `${percent(expense.amount, totalExpense)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          <Link href="/pengeluaran" className="btn-secondary mt-5 w-full text-[11px]">
            Kelola pengeluaran
          </Link>
        </div>

        <div className="card p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="eyebrow">Kontribusi terbesar</div>
              <h2 className="mt-1 section-title">Jasa & sparepart terlaris</h2>
            </div>
            <ReceiptText size={18} className="text-faint" />
          </div>
          {report.topItems.length === 0 ? (
            <p className="mt-5 rounded-xl border border-dashed border-line px-4 py-6 text-center text-[10px] text-faint">
              Belum ada penjualan {thisPeriod}.
            </p>
          ) : (
            <div className="mt-3 divide-y divide-line/70">
              {report.topItems.map((item, index) => (
                <div key={`${item.name}-${index}`} className="flex items-center gap-3 py-2.5">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-[#f2eee6] text-[9px] font-extrabold text-muted">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11.5px] font-bold text-ink">{item.name}</div>
                    <div className="text-[9px] font-medium capitalize text-faint">
                      {item.category} · {item.qty} terjual
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] font-extrabold text-ink tabular">{formatRupiah(item.revenue)}</div>
                    <div className="text-[9px] font-semibold text-faint tabular">
                      {percent(item.revenue, report.revenue)}% omset
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <details className="card mt-4 overflow-hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 sm:px-6">
          <div>
            <div className="eyebrow">Audit harian</div>
            <h2 className="mt-1 section-title">Rincian pendapatan per hari</h2>
          </div>
          <span className="text-[10px] font-extrabold text-brand">Buka tabel →</span>
        </summary>
        <div className="border-t border-line px-4 pb-4 sm:px-6">
          <div className="table-wrap">
            <table className="data-table min-w-[480px]">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th className="text-center">Transaksi</th>
                  <th className="text-right">Omset</th>
                  <th className="text-right">Kas diterima</th>
                </tr>
              </thead>
              <tbody>
                {report.daily
                  .filter((day) => day.revenue > 0 || day.cash > 0)
                  .map((day) => (
                    <tr key={day.date}>
                      <td className="text-[11px] font-semibold text-ink">{day.date.split("-").reverse().join("/")}</td>
                      <td className="text-center text-[11px] text-muted tabular">{day.transactions}</td>
                      <td className="text-right text-[11px] font-bold text-ink tabular">{formatRupiah(day.revenue)}</td>
                      <td className="text-right text-[11px] font-semibold text-muted tabular">{formatRupiah(day.cash)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-line bg-surface/60 px-4 py-3">
        <CircleDollarSign size={14} className="mt-0.5 shrink-0 text-success" />
        <p className="text-[10px] leading-relaxed text-muted">
          <span className="font-bold text-ink">Cara membaca:</span> Omset adalah nilai nota pada periode terpilih; HPP dihitung dari
          modal item yang terjual. Margin jasa dan barang dihitung terpisah; diskon nota dibagi proporsional ke tiap
          item. Laba bersih = omset − HPP − biaya operasional. Kas diterima bisa berbeda dari omset
          karena pembayaran DP, pelunasan piutang lama, atau transaksi belum dibayar. Ini bukan pengganti laporan pajak.
        </p>
      </div>
    </div>
  );
}
