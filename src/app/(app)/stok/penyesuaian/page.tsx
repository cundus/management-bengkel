import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listStockAdjustments } from "@/lib/queries/stock-adjustments";
import { monthOptions } from "@/lib/queries/reports";
import { currentMonthISO, dateOnlyToISO, formatDateID, isValidMonth, monthLabel } from "@/lib/dates";
import { formatNumber, formatRupiah } from "@/lib/format";
import { ADJUSTMENT_REASON_LABELS, adjustmentNumber } from "@/lib/stock-adjustments";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Penyesuaian stok" };

const timestampFormat = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" });

export default async function StockAdjustmentsPage({ searchParams }: {
  searchParams: Promise<{ month?: string; item?: string }>;
}) {
  await requireUser();
  const params = await searchParams;
  const itemId = Number(params.item);
  const item = Number.isInteger(itemId) && itemId > 0
    ? await prisma.item.findUnique({ where: { id: itemId }, select: { id: true, name: true } })
    : null;
  // Per item, all months by default; otherwise the current month.
  const month = params.month === "semua" ? undefined
    : isValidMonth(params.month) ? params.month
    : item ? undefined : currentMonthISO();
  const { adjustments, loss, gain, net } = await listStockAdjustments({ month, itemId: item?.id });
  const query = new URLSearchParams({ ...(month ? { month } : { month: "semua" }), ...(item ? { item: String(item.id) } : {}) });

  return (
    <div className="animate-fade-up space-y-4">
      <PageHeader
        eyebrow="Persediaan"
        title="Penyesuaian stok"
        description={`${item ? `${item.name} · ` : ""}${month ? monthLabel(month) : "Semua periode"}. Setiap penyesuaian tercatat permanen dengan alasan, pelaku, dan nilai modal batch.`}
        actions={<>
          <a href={`/api/export/penyesuaian?${query}`} className="btn-secondary"><Download size={15} /><span className="hidden sm:inline">Ekspor CSV</span></a>
          <Link href={item ? `/stok/${item.id}?view=kartu` : "/stok"} className="btn-secondary">Kembali</Link>
        </>}
      />

      <form method="get" action="/stok/penyesuaian" className="flex flex-wrap items-center gap-2">
        {item && <input type="hidden" name="item" value={item.id} />}
        <select name="month" defaultValue={month ?? "semua"} className="select w-auto" aria-label="Periode">
          <option value="semua">Semua periode</option>
          {monthOptions(12).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <button type="submit" className="btn-secondary">Tampilkan</button>
        {item && <Link href={`/stok/penyesuaian${month ? `?month=${month}` : ""}`} className="text-xs font-bold text-pine underline">Semua item</Link>}
      </form>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[
          { label: "Jumlah penyesuaian", value: formatNumber(adjustments.length), tone: "text-ink" },
          { label: "Nilai berkurang", value: formatRupiah(loss), tone: "text-danger" },
          { label: "Nilai bertambah", value: formatRupiah(gain), tone: "text-pine" },
          { label: "Selisih bersih", value: formatRupiah(net), tone: net < 0 ? "text-danger" : "text-ink" },
        ].map((card) => (
          <div key={card.label} className="card p-4">
            <div className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-faint">{card.label}</div>
            <div className={cn("mt-1.5 font-display text-lg font-extrabold tracking-tight tabular", card.tone)}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        {adjustments.length === 0 ? <p className="p-5 text-sm text-muted">Belum ada penyesuaian pada periode ini.</p> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>No.</th><th>Waktu</th><th>Item</th><th>Alasan &amp; keterangan</th><th>Jumlah</th><th>Stok</th><th>Batch</th><th className="text-right">Nilai</th></tr></thead>
              <tbody>{adjustments.map((adjustment) => {
                const number = adjustmentNumber(adjustment.id);
                return (
                  <tr key={adjustment.id} id={number}>
                    <td className="whitespace-nowrap font-mono font-bold">{number}</td>
                    <td>{timestampFormat.format(adjustment.createdAt)}
                      <p className="text-xs text-muted">{adjustment.createdBy.name} · tgl. {formatDateID(dateOnlyToISO(adjustment.businessDate))}</p>
                    </td>
                    <td><Link href={`/stok/${adjustment.item.id}?view=kartu`} className="font-bold text-pine underline">{adjustment.item.name}</Link>
                      <p className="font-mono text-[10px] text-faint">{adjustment.item.sku}</p>
                    </td>
                    <td><div className="font-bold">{ADJUSTMENT_REASON_LABELS[adjustment.reason]}</div>
                      <p className="max-w-xs whitespace-normal text-xs text-muted">{adjustment.notes}</p>
                    </td>
                    <td className={cn("font-bold tabular", adjustment.qty > 0 && "text-pine")}>
                      {adjustment.qty > 0 ? "+" : "−"}{formatNumber(Math.abs(adjustment.qty))} {adjustment.item.unit}
                    </td>
                    <td className="tabular">{formatNumber(adjustment.stockBefore)} → {formatNumber(adjustment.stockAfter)}</td>
                    <td className="text-xs">{adjustment.stockMovements.map((movement, index) => (
                      <div key={index}>{movement.stockBatch?.code ?? "-"} · {formatNumber(Math.abs(movement.qty))} × {formatRupiah(movement.stockBatch?.unitCost ?? 0)}</div>
                    ))}</td>
                    <td className={cn("text-right font-extrabold tabular", adjustment.value < 0 ? "text-danger" : "text-pine")}>
                      {adjustment.value < 0 ? "−" : "+"}{formatRupiah(Math.abs(adjustment.value))}
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
