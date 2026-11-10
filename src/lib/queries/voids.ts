import { prisma } from "../db";
import { dateOnlyToISO } from "../dates";

// Refund nota batal: kas keluar di tanggal bisnis refund.
export async function getRefundsByDate(start: Date, end: Date): Promise<{ total: number; byDate: Map<string, number> }> {
  const refunds = await prisma.refund.findMany({
    where: { businessDate: { gte: start, lte: end } },
    select: { businessDate: true, amount: true },
  });
  const byDate = new Map<string, number>();
  let total = 0;
  for (const refund of refunds) {
    const key = dateOnlyToISO(refund.businessDate);
    byDate.set(key, (byDate.get(key) ?? 0) + refund.amount);
    total += refund.amount;
  }
  return { total, byDate };
}

// Pendapatan pembatalan: uang yang sudah dibayar pada nota batal tetapi tidak di-refund,
// diakui pada tanggal pembatalan (voided_date).
export async function getCancellationIncome(start: Date, end: Date): Promise<number> {
  const voided = await prisma.transaction.findMany({
    where: { status: "batal", voidedDate: { gte: start, lte: end } },
    select: { payments: { select: { amount: true } }, refunds: { select: { amount: true } } },
  });
  return voided.reduce((sum, transaction) => {
    const paid = transaction.payments.reduce((total, payment) => total + payment.amount, 0);
    const refunded = transaction.refunds.reduce((total, refund) => total + refund.amount, 0);
    return sum + Math.max(0, paid - refunded);
  }, 0);
}

export async function countPendingVoidRequests(): Promise<number> {
  return prisma.voidRequest.count({ where: { status: "pending", transaction: { status: "selesai" } } });
}
