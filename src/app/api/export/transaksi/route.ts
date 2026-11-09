import { getCurrentUser } from "@/lib/auth";
import { listTransactions } from "@/lib/queries/transactions";
import { csvResponse, toCsv } from "@/lib/csv";
import { todayISO } from "@/lib/dates";
import type { TransaksiStatusFilter } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const statusParam = url.searchParams.get("status") ?? "semua";
  const status: TransaksiStatusFilter = ["semua", "lunas", "sebagian", "belum_bayar"].includes(statusParam)
    ? (statusParam as TransaksiStatusFilter)
    : "semua";

  const result = await listTransactions({ search: q, status, page: 1, pageSize: 10000 });
  const rows: (string | number)[][] = [
    ["No. Nota", "Tanggal", "Pelanggan", "No. HP", "Kendaraan", "Mekanik", "Total", "Dibayar", "Sisa", "Status", "Jatuh Tempo"],
    ...result.rows.map((row) => [
      row.invoiceNo,
      row.businessDate,
      row.customerName,
      row.customerPhone ?? "",
      row.plateNumber ?? row.vehicleLabel ?? "",
      row.mechanic ?? "",
      row.total,
      row.paid,
      row.remaining,
      row.paymentStatus,
      row.dueDate ?? "",
    ]),
  ];

  return csvResponse(`wmc225-transaksi-${todayISO()}.csv`, toCsv(rows));
}
