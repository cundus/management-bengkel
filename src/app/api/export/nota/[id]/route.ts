import { getCurrentUser } from "@/lib/auth";
import { getTransactionById } from "@/lib/queries/transactions";
import { csvResponse, toCsv } from "@/lib/csv";
import { formatDateID } from "@/lib/dates";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await context.params;
  const transaction = await getTransactionById(id);
  if (!transaction) return new Response("Nota tidak ditemukan", { status: 404 });

  const rows: (string | number)[][] = [
    ["NOTA SERVIS WMC 225"],
    ["No. Nota", transaction.invoiceNo],
    ["Tanggal", formatDateID(transaction.businessDate)],
    ["Pelanggan", transaction.customerName],
    ["Telepon", transaction.customerPhone ?? ""],
    ["Kendaraan", transaction.vehicle ? `${transaction.vehicle.brand} ${transaction.vehicle.model} (${transaction.vehicle.plateNumber})` : ""],
    ["Mekanik", transaction.mechanic ?? ""],
    ["Status", transaction.status === "batal" ? "Dibatalkan" : transaction.paymentStatus],
    [],
    ["ITEM", "QTY", "HARGA", "SUBTOTAL"],
    ...transaction.items.map((item) => [item.name, item.qty, item.unitPrice, item.subtotal]),
    [],
    ["Subtotal", transaction.subtotal],
    ["Diskon", transaction.discount],
    ["Total", transaction.total],
    ["Dibayar", transaction.paid],
    ["Sisa", transaction.remaining],
    [],
    ["CATATAN", transaction.notes ?? ""],
    ["Dibuat oleh", transaction.createdByName],
  ];

  return csvResponse(`nota-${transaction.invoiceNo}.csv`, toCsv(rows));
}
