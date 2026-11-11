import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, CircleDollarSign } from "lucide-react";
import { requireOwner } from "@/lib/auth";
import { reportPeriodContext, type ReportSearchParams } from "@/lib/report-period";
import {
  getAdjustmentSection,
  getExpenseSection,
  getItemSalesSection,
  getRevenueSection,
  netProfitOf,
} from "@/lib/queries/reports";
import { ReportHeader } from "@/components/reports/report-header";
import { growth } from "@/lib/calculations";
import { rangeLabel } from "@/lib/dates";
import { formatRupiah, percent } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Laporan Laba Rugi" };

export default async function ProfitLossPage({ searchParams }: { searchParams: Promise<ReportSearchParams> }) {
  await requireOwner();
  const ctx = reportPeriodContext(await searchParams);
  const [revenue, items, expense, adjustment] = await Promise.all([
    getRevenueSection(ctx.range),
    getItemSalesSection(ctx.range),
    getExpenseSection(ctx.range),
    getAdjustmentSection(ctx.range),
  ]);
  const report = {
    ...ctx.range,
    ...revenue,
    ...expense,
    ...adjustment,
    cogs: items.cogs,
    grossProfit: revenue.revenue - items.cogs,
    netProfit: netProfitOf(revenue, items, expense, adjustment),
  };
  const totalExpense = report.expenseByCategory.reduce((sum, item) => sum + item.amount, 0);
  const expenseGrowth = growth(report.expenses, report.previousExpenses);
  const revenueGrowth = growth(report.revenue, report.previousRevenue);
  const previousPeriod = ctx.isDaily
    ? `Periode sebelumnya (${rangeLabel(report.previousStart, report.previousEnd)})`
    : "Bulan lalu";

  return (
    <div className="animate-fade-up">
      <ReportHeader
        active="/laporan/laba-rugi"
        eyebrow="Laporan"
        title="Laba rugi"
        description="Dari omset ke laba bersih: harga pokok, biaya operasional, dan komponen penyesuaian."
        ctx={ctx}
        exportHref={`/api/export/laporan?${ctx.query}`}
        meta={<span className="text-[10px] font-medium text-faint">Margin bersih {percent(report.netProfit, report.revenue)}%</span>}
      />

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
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
                <Link href={`/stok/penyesuaian?month=${ctx.period.month}`} className="font-semibold text-muted underline">
                  Selisih penyesuaian stok
                </Link>
                <span className={cn("font-semibold tabular", report.stockAdjustment < 0 ? "text-danger" : "text-success")}>
                  {report.stockAdjustment < 0 ? "−" : "+"}
                  {formatRupiah(Math.abs(report.stockAdjustment))}
                </span>
              </div>
            )}
            <div className="mt-1 flex items-center justify-between rounded-xl bg-pine px-4 py-3.5">
              <div>
                <div className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-white/40">Laba bersih</div>
                <div className="mt-0.5 text-[9px] font-medium text-white/30">
                  Pendapatan − HPP − biaya{report.cancellationIncome > 0 ? " + pembatalan" : ""}
                  {report.stockAdjustment !== 0 ? " ± selisih stok" : ""}
                </div>
              </div>
              <div className="font-display text-[1.3rem] font-extrabold tracking-tight text-lime tabular">
                {formatRupiah(report.netProfit)}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5 sm:p-6">
            <div className="eyebrow">Pembanding</div>
            <h2 className="mt-1 section-title">{previousPeriod}</h2>
            <div className="table-wrap mt-3">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Pos</th>
                    <th className="text-right">Sebelumnya</th>
                    <th className="text-right">Sekarang</th>
                    <th className="text-right">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "Omset", previous: report.previousRevenue, current: report.revenue, change: revenueGrowth },
                    { label: "Biaya operasional", previous: report.previousExpenses, current: report.expenses, change: expenseGrowth },
                  ].map((row) => (
                    <tr key={row.label}>
                      <td className="text-[11px] font-semibold text-ink">{row.label}</td>
                      <td className="text-right text-[11px] text-muted tabular">{formatRupiah(row.previous)}</td>
                      <td className="text-right text-[11px] font-bold text-ink tabular">{formatRupiah(row.current)}</td>
                      <td className="text-right text-[11px] font-semibold text-muted tabular">
                        {row.change == null ? "—" : `${row.change >= 0 ? "+" : ""}${row.change}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

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
                Belum ada pengeluaran tercatat {ctx.thisPeriod}.
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
                      <div className="h-full rounded-full bg-warning" style={{ width: `${percent(expense.amount, totalExpense)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Link href="/pengeluaran" className="btn-secondary mt-5 w-full text-[11px]">
              Kelola pengeluaran
            </Link>
          </div>
        </div>
      </section>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-line bg-surface/60 px-4 py-3">
        <CircleDollarSign size={14} className="mt-0.5 shrink-0 text-success" />
        <p className="text-[10px] leading-relaxed text-muted">
          <span className="font-bold text-ink">Cara membaca:</span> Omset adalah nilai nota pada periode terpilih; HPP dihitung dari
          modal item yang terjual. Laba bersih = omset − HPP − biaya operasional. Ini bukan pengganti laporan pajak.
        </p>
      </div>
    </div>
  );
}
