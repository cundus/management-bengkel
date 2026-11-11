import type { Metadata } from "next";
import { ArrowDownRight, ArrowUpRight, CircleDollarSign, Landmark, WalletCards } from "lucide-react";
import { requireOwner } from "@/lib/auth";
import { reportPeriodContext, type ReportSearchParams } from "@/lib/report-period";
import { buildDaily, cashFlowOf, getCashSection, getExpenseSection, getRevenueSection } from "@/lib/queries/reports";
import { ReportHeader } from "@/components/reports/report-header";
import { formatRupiah, percent } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Laporan Arus Kas" };

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

export default async function CashFlowPage({ searchParams }: { searchParams: Promise<ReportSearchParams> }) {
  await requireOwner();
  const ctx = reportPeriodContext(await searchParams);
  const [revenue, cash, expense] = await Promise.all([
    getRevenueSection(ctx.range),
    getCashSection(ctx.range),
    getExpenseSection(ctx.range),
  ]);
  const report = {
    ...cash,
    ...cashFlowOf(cash, expense),
    expenses: expense.expenses,
    daily: buildDaily(ctx.range, revenue, cash),
  };
  const supplierPayments = Math.max(0, report.cashOut - report.expenses - report.refunds);
  const activeDays = report.daily.filter((day) => day.revenue > 0 || day.cash > 0);

  return (
    <div className="animate-fade-up">
      <ReportHeader
        active="/laporan/arus-kas"
        eyebrow="Laporan"
        title="Arus kas"
        description="Uang yang benar-benar masuk dan keluar. Bisa berbeda dari omset karena DP, pelunasan piutang lama, dan nota belum dibayar."
        ctx={ctx}
        exportHref={`/api/export/laporan?${ctx.query}`}
      />

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
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
              <span className="font-bold text-ink tabular">{formatRupiah(supplierPayments)}</span>
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
              Belum ada pembayaran {ctx.thisPeriod}.
            </p>
          ) : (
            <>
              <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-[#efe9de]">
                {report.paymentMethods.map((method) => (
                  <div
                    key={method.method}
                    className={cn("h-full", METHOD_COLORS[method.method] ?? "bg-pine")}
                    style={{ width: `${percent(method.amount, report.cashIn)}%` }}
                    title={`${METHOD_LABELS[method.method] ?? method.method}: ${formatRupiah(method.amount)}`}
                  />
                ))}
              </div>
              <div className="mt-4 space-y-2.5">
                {report.paymentMethods.map((method) => (
                  <div key={method.method} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-[10.5px] font-semibold text-muted">
                      <span className={cn("size-2 rounded-full", METHOD_COLORS[method.method] ?? "bg-pine")} />
                      {METHOD_LABELS[method.method] ?? method.method}
                      <span className="text-[9px] text-faint">({method.count}×)</span>
                    </span>
                    <span className="text-[11px] font-extrabold text-ink tabular">{formatRupiah(method.amount)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      <section className="card mt-4 overflow-hidden">
        <div className="px-5 py-4 sm:px-6">
          <div className="eyebrow">Audit harian</div>
          <h2 className="mt-1 section-title">Rincian pendapatan per hari</h2>
        </div>
        <div className="border-t border-line px-4 pb-4 sm:px-6">
          {activeDays.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-line px-4 py-6 text-center text-[10px] text-faint">
              Belum ada transaksi atau pembayaran {ctx.thisPeriod}.
            </p>
          ) : (
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
                  {activeDays.map((day) => (
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
          )}
        </div>
      </section>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-line bg-surface/60 px-4 py-3">
        <CircleDollarSign size={14} className="mt-0.5 shrink-0 text-success" />
        <p className="text-[10px] leading-relaxed text-muted">
          <span className="font-bold text-ink">Cara membaca:</span> Kas diterima mencakup DP dan pelunasan piutang dari nota periode
          sebelumnya. Kas keluar = pengeluaran operasional + pembayaran hutang supplier + refund nota batal.
        </p>
      </div>
    </div>
  );
}
