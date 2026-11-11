import type { Metadata } from "next";
import { Package, ReceiptText, Wrench } from "lucide-react";
import { requireOwner } from "@/lib/auth";
import { loadReport, reportPeriodContext, type ReportSearchParams } from "@/lib/report-period";
import { ReportHeader } from "@/components/reports/report-header";
import { formatRupiah, percent } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Laporan Penjualan" };

const MARGIN_GROUPS = [
  { key: "jasa", label: "Jasa", title: "Margin produk jasa", unit: "pekerjaan", icon: Wrench },
  { key: "sparepart", label: "Barang", title: "Margin produk barang", unit: "unit", icon: Package },
] as const;

export default async function SalesReportPage({ searchParams }: { searchParams: Promise<ReportSearchParams> }) {
  await requireOwner();
  const ctx = reportPeriodContext(await searchParams);
  const report = await loadReport(ctx);

  return (
    <div className="animate-fade-up">
      <ReportHeader
        active="/laporan/penjualan"
        eyebrow="Laporan"
        title="Penjualan & produk"
        description="Margin jasa dan barang per item, serta kontribusi terbesar terhadap omset."
        ctx={ctx}
        exportHref={`/api/export/laporan?${ctx.query}`}
        meta={
          <span className="text-[10px] font-medium text-faint">
            {report.transactions} transaksi · omset {formatRupiah(report.revenue)}
          </span>
        }
      />

      <section className="card p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="eyebrow">Kontribusi terbesar</div>
            <h2 className="mt-1 section-title">Jasa & sparepart terlaris</h2>
          </div>
          <ReceiptText size={18} className="text-faint" />
        </div>
        {report.topItems.length === 0 ? (
          <p className="mt-5 rounded-xl border border-dashed border-line px-4 py-6 text-center text-[10px] text-faint">
            Belum ada penjualan {ctx.thisPeriod}.
          </p>
        ) : (
          <div className="mt-3 grid gap-x-6 divide-y divide-line/70 md:grid-cols-2 md:divide-y-0">
            {report.topItems.map((item, index) => (
              <div key={`${item.name}-${index}`} className="flex items-center gap-3 border-line/70 py-2.5 md:border-b">
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
                  <div className="text-[9px] font-semibold text-faint tabular">{percent(item.revenue, report.revenue)}% omset</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
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
                  Belum ada penjualan {group.label.toLowerCase()} {ctx.thisPeriod}.
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
                      {items.map((item) => (
                        <tr key={item.name}>
                          <td className="max-w-[180px] truncate text-[11px] font-semibold text-ink">{item.name}</td>
                          <td className="text-center text-[11px] text-muted tabular">{item.qty}</td>
                          <td className="text-right text-[11px] text-muted tabular">{formatRupiah(item.revenue)}</td>
                          <td className={cn("text-right text-[11px] font-bold tabular", item.grossProfit >= 0 ? "text-ink" : "text-danger")}>
                            {formatRupiah(item.grossProfit)}
                          </td>
                          <td className="text-right text-[11px] font-semibold text-muted tabular">{item.margin}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </section>

      <p className="mt-4 text-[10px] leading-relaxed text-faint">
        Diskon nota dibagi proporsional ke tiap item, sehingga margin per item sudah memperhitungkan potongan harga.
      </p>
    </div>
  );
}
