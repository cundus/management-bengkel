import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ChevronRight, CircleDollarSign, HandCoins, TrendingUp } from "lucide-react";
import { requireOwner } from "@/lib/auth";
import { loadReport, reportPeriodContext, type ReportSearchParams } from "@/lib/report-period";
import { ReportHeader } from "@/components/reports/report-header";
import { DailyRevenueChart } from "@/components/reports/daily-chart";
import { growth } from "@/lib/calculations";
import { formatRupiah, percent } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Laporan" };

export default async function ReportSummaryPage({ searchParams }: { searchParams: Promise<ReportSearchParams> }) {
  await requireOwner();
  const ctx = reportPeriodContext(await searchParams);
  const report = await loadReport(ctx);
  const revenueGrowth = growth(report.revenue, report.previousRevenue);
  const margin = percent(report.netProfit, report.revenue);
  const operatingDays = report.daily.filter((d) => d.revenue > 0).length;

  const details = [
    {
      href: "/laporan/laba-rugi",
      label: "Laba rugi",
      value: formatRupiah(report.netProfit),
      note: `Laba kotor ${formatRupiah(report.grossProfit)} · biaya ${formatRupiah(report.expenses)}`,
    },
    {
      href: "/laporan/arus-kas",
      label: "Arus kas",
      value: formatRupiah(report.netCash),
      note: `Masuk ${formatRupiah(report.cashIn)} · keluar ${formatRupiah(report.cashOut)}`,
      tone: report.netCash >= 0 ? "text-success" : "text-danger",
    },
    {
      href: "/laporan/penjualan",
      label: "Penjualan & produk",
      value: `${report.transactions} transaksi`,
      note: report.topItems[0] ? `Terlaris: ${report.topItems[0].name}` : `Belum ada penjualan ${ctx.thisPeriod}`,
    },
    {
      href: "/laporan/piutang-hutang",
      label: "Piutang & hutang",
      value: formatRupiah(report.outstanding),
      note: `${formatRupiah(report.overdue)} piutang lewat tempo`,
    },
  ];

  return (
    <div className="animate-fade-up">
      <ReportHeader
        active="/laporan"
        eyebrow="Buku besar bengkel"
        title="Laporan keuangan"
        description="Ringkasan omset, laba, dan kas pada periode terpilih. Buka tab laporan untuk rincian tiap bagian."
        ctx={ctx}
        exportHref={`/api/export/laporan?${ctx.query}`}
        meta={
          <span className="text-[10px] font-medium text-faint">
            {report.transactions} transaksi · {operatingDays} hari operasional
            {ctx.isDaily && report.daily.length > 1 ? ` dari ${report.daily.length} hari` : ""}
          </span>
        }
      />

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
          <div className="mt-1 text-[9px] font-medium text-white/35">{ctx.previousLabel}</div>
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
            <span className={report.overdue > 0 ? "badge-danger" : "badge-neutral"}>
              {report.overdue > 0 ? "Ada tunggakan" : "Sehat"}
            </span>
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

      <section className="mt-4" aria-labelledby="rincian-laporan">
        <h2 id="rincian-laporan" className="mb-2 px-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-faint">
          Rincian laporan
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {details.map((detail) => (
            <Link
              key={detail.href}
              href={detail.href === "/laporan/piutang-hutang" ? detail.href : `${detail.href}?${ctx.query}`}
              className="card group flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:border-line-strong sm:p-5"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-faint">{detail.label}</div>
                <div className={cn("mt-1 font-display text-[1.05rem] font-extrabold tracking-tight tabular", detail.tone ?? "text-ink")}>
                  {detail.value}
                </div>
                <div className="mt-0.5 truncate text-[10px] font-medium text-muted">{detail.note}</div>
              </div>
              <ChevronRight size={16} className="shrink-0 text-faint transition group-hover:translate-x-0.5 group-hover:text-ink" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
