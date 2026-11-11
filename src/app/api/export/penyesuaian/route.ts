import { getCurrentUser } from "@/lib/auth";
import { listStockAdjustments } from "@/lib/queries/stock-adjustments";
import { csvResponse, toCsv } from "@/lib/csv";
import { dateOnlyToISO, isValidMonth } from "@/lib/dates";
import { ADJUSTMENT_REASON_LABELS, adjustmentNumber } from "@/lib/stock-adjustments";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const requested = url.searchParams.get("month");
  const month = isValidMonth(requested) ? requested : undefined;
  const itemId = Number(url.searchParams.get("item"));
  const { adjustments } = await listStockAdjustments({ month, itemId: Number.isInteger(itemId) && itemId > 0 ? itemId : undefined });

  const rows: (string | number)[][] = [
    ["No.", "Tanggal", "Waktu dicatat", "Dicatat oleh", "SKU", "Item", "Alasan", "Keterangan", "Jumlah", "Stok sebelum", "Stok sesudah", "Rincian batch", "Nilai (Rp)"],
    ...adjustments.map((adjustment) => [
      adjustmentNumber(adjustment.id),
      dateOnlyToISO(adjustment.businessDate),
      adjustment.createdAt.toISOString(),
      adjustment.createdBy.name,
      adjustment.item.sku,
      adjustment.item.name,
      ADJUSTMENT_REASON_LABELS[adjustment.reason],
      adjustment.notes,
      adjustment.qty,
      adjustment.stockBefore,
      adjustment.stockAfter,
      adjustment.stockMovements.map((movement) => `${movement.stockBatch?.code ?? "-"}:${movement.qty}@${movement.stockBatch?.unitCost ?? 0}`).join("; "),
      adjustment.value,
    ]),
  ];

  return csvResponse(`wmc225-penyesuaian-stok-${month ?? "semua"}.csv`, toCsv(rows));
}
