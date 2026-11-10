import { daysBetween } from "./dates";
import type { MarginItem, MarginLine, MarginSummary, PaymentStatus, SettlementPayment } from "./types";

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

/**
 * Bagi diskon nota ke tiap baris secara proporsional terhadap subtotal baris,
 * supaya omset per kategori/item tetap berjumlah sama dengan total nota.
 * Sisa pembulatan dibebankan ke baris dengan subtotal terbesar.
 */
export function allocateDiscount(subtotals: number[], discount: number): number[] {
  const gross = subtotals.reduce((sum, value) => sum + value, 0);
  const safeDiscount = Math.min(Math.max(0, Math.round(discount)), gross);
  if (gross <= 0 || safeDiscount === 0) return subtotals.map((value) => value);
  const shares = subtotals.map((value) => Math.floor((value * safeDiscount) / gross));
  const remainder = safeDiscount - shares.reduce((sum, value) => sum + value, 0);
  if (remainder > 0) {
    const largest = subtotals.indexOf(Math.max(...subtotals));
    shares[largest] += remainder;
  }
  return subtotals.map((value, index) => value - shares[index]);
}

type MarginTransaction = {
  discount: number;
  items: { name: string; category: "jasa" | "sparepart"; qty: number; unitCost: number; subtotal: number }[];
};

function marginPercent(profit: number, revenue: number): number {
  if (revenue <= 0) return 0;
  return Math.round((profit / revenue) * 1000) / 10;
}

export function marginByCategory(transactions: MarginTransaction[]): {
  categories: Record<"jasa" | "sparepart", MarginSummary>;
  items: Record<"jasa" | "sparepart", MarginItem[]>;
} {
  const empty = (): MarginSummary => ({ revenue: 0, cost: 0, grossProfit: 0, margin: 0, qty: 0, lines: 0 });
  const categories = { jasa: empty(), sparepart: empty() };
  const itemMap = new Map<string, MarginLine>();

  for (const transaction of transactions) {
    const netRevenues = allocateDiscount(
      transaction.items.map((item) => item.subtotal),
      transaction.discount,
    );
    transaction.items.forEach((item, index) => {
      const revenue = netRevenues[index];
      const cost = item.qty * item.unitCost;
      const summary = categories[item.category];
      summary.revenue += revenue;
      summary.cost += cost;
      summary.qty += item.qty;
      summary.lines += 1;

      const key = `${item.category}|${item.name}`;
      const current = itemMap.get(key) ?? { name: item.name, category: item.category, qty: 0, revenue: 0, cost: 0 };
      current.qty += item.qty;
      current.revenue += revenue;
      current.cost += cost;
      itemMap.set(key, current);
    });
  }

  for (const summary of Object.values(categories)) {
    summary.grossProfit = summary.revenue - summary.cost;
    summary.margin = marginPercent(summary.grossProfit, summary.revenue);
  }

  const items = { jasa: [] as MarginItem[], sparepart: [] as MarginItem[] };
  for (const line of itemMap.values()) {
    const grossProfit = line.revenue - line.cost;
    items[line.category].push({ ...line, grossProfit, margin: marginPercent(grossProfit, line.revenue) });
  }
  items.jasa.sort((a, b) => b.grossProfit - a.grossProfit);
  items.sparepart.sort((a, b) => b.grossProfit - a.grossProfit);

  return { categories, items };
}

/**
 * Nota dianggap "piutang yang sudah lunas" bila saat ini sudah terbayar penuh
 * dan pembayaran terakhirnya terjadi setelah tanggal nota (artinya nota sempat
 * belum lunas di hari dibuat). Pembayaran harus urut dari yang paling awal.
 */
export function settledReceivable(
  total: number,
  businessDate: string,
  payments: SettlementPayment[],
): { settledDate: string; daysToSettle: number; downPayment: number } | null {
  if (payments.length === 0) return null;
  const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  if (remainingAmount(total, paid) > 0) return null;
  const settledDate = payments.reduce(
    (latest, payment) => (payment.businessDate > latest ? payment.businessDate : latest),
    payments[0].businessDate,
  );
  if (settledDate <= businessDate) return null;
  const downPayment = payments
    .filter((payment) => payment.businessDate <= businessDate)
    .reduce((sum, payment) => sum + payment.amount, 0);
  return { settledDate, daysToSettle: daysBetween(businessDate, settledDate), downPayment };
}
