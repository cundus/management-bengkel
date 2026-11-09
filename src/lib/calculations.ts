import type { PaymentStatus } from "./types";

export type CartLine = {
  qty: number;
  unitPrice: number;
};

export function calculateTransactionTotals(lines: CartLine[], discount: number): {
  subtotal: number;
  discount: number;
  total: number;
} {
  const subtotal = lines.reduce((sum, line) => sum + Math.max(0, line.qty) * Math.max(0, line.unitPrice), 0);
  const safeDiscount = Math.min(Math.max(0, Math.round(discount)), subtotal);
  return { subtotal, discount: safeDiscount, total: subtotal - safeDiscount };
}

export function remainingAmount(total: number, paid: number): number {
  return Math.max(0, Math.round(total) - Math.round(paid));
}

export function paymentStatus(total: number, paid: number, status?: string): PaymentStatus {
  if (status === "batal") return "batal";
  const remaining = remainingAmount(total, paid);
  if (remaining <= 0) return "lunas";
  if (paid > 0) return "sebagian";
  return "belum_bayar";
}

export function canAcceptPayment(total: number, paid: number, amount: number): { ok: boolean; message?: string } {
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, message: "Nominal harus lebih dari nol." };
  const remaining = remainingAmount(total, paid);
  if (remaining <= 0) return { ok: false, message: "Transaksi ini sudah lunas." };
  if (amount > remaining) return { ok: false, message: "Nominal melebihi sisa tagihan." };
  return { ok: true };
}

export type AgingBucket = "lancar" | "1-7" | "8-30" | ">30";

export function agingBucket(dueDate: string | null, today: string): AgingBucket {
  if (!dueDate) return "lancar";
  const due = new Date(`${dueDate}T12:00:00Z`).getTime();
  const current = new Date(`${today}T12:00:00Z`).getTime();
  const daysOverdue = Math.floor((current - due) / 86_400_000);
  if (daysOverdue <= 0) return "lancar";
  if (daysOverdue <= 7) return "1-7";
  if (daysOverdue <= 30) return "8-30";
  return ">30";
}

export function sumBy<T>(items: T[], getValue: (item: T) => number): number {
  return items.reduce((sum, item) => sum + getValue(item), 0);
}

export function growth(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

export function generateInvoiceNumber(businessDate: string, sequence: number): string {
  return `INV-${businessDate.replaceAll("-", "")}-${String(sequence).padStart(3, "0")}`;
}

export function normalizePhoneForWhatsApp(phone: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  if (digits.startsWith("8")) digits = `62${digits}`;
  return digits.startsWith("62") && digits.length >= 10 ? digits : null;
}
