import { prisma } from "../db";
import { addDaysISO, dateOnlyToISO, daysBetween, endOfMonthISO, monthRange, parseDateOnly, todayISO } from "../dates";
import { openTransactionRecords } from "./mappers";
import { listTransactionInclude } from "./mappers";
import type { ReportData } from "../types";
import { marginByCategory } from "../calculations";
import { getCancellationIncome, getRefundsByDate } from "./voids";
import { getStockAdjustmentValue } from "./stock-adjustments";

/*
 * Laporan dipecah per bagian supaya tiap halaman hanya mengambil data yang ia
 * tampilkan. Contoh: Arus Kas tidak perlu memuat item nota, dan hanya Ringkasan
 * yang memindai seluruh nota terbuka untuk posisi piutang. `getReport` tetap
 * menggabungkan semua bagian untuk ekspor CSV dan halaman Ringkasan.
 */

export type ReportRange = {
  month: string;
  start: string;
  end: string;
  previousStart: string;
  previousEnd: string;
  /** Jumlah hari dalam rentang (inklusif). */
  length: number;
};

export type DailyRow = ReportData["daily"][number];

function previousMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 2, 1));
  return date.toISOString().slice(0, 7);
}

/**
 * Rentang tanggal bisnis [start, end] (inklusif). Tanpa `previous`, pembanding
 * adalah rentang sepanjang sama tepat sebelum `start`.
 */
export function reportRange(start: string, end: string, previous?: { start: string; end: string }): ReportRange {
  const length = daysBetween(start, end) + 1;
  return {
    month: start.slice(0, 7),
    start,
    end,
    previousStart: previous?.start ?? addDaysISO(start, -length),
    previousEnd: previous?.end ?? addDaysISO(start, -1),
    length,
  };
}

/** Rentang bulanan; pembandingnya bulan kalender sebelumnya (bukan N hari sebelumnya). */
export function monthlyReportRange(month: string): ReportRange {
  const { start, end } = monthRange(month);
  return reportRange(start, end, monthRange(previousMonth(month)));
}

function bounds(range: ReportRange) {
  return {
    current: { gte: parseDateOnly(range.start), lte: parseDateOnly(range.end) },
    previous: { gte: parseDateOnly(range.previousStart), lte: parseDateOnly(range.previousEnd) },
  };
}

// ── Omset ────────────────────────────────────────────────────────────────────

export type RevenueSection = {
  revenue: number;
  previousRevenue: number;
  transactions: number;
  byDate: Map<string, { revenue: number; transactions: number }>;
};

export async function getRevenueSection(range: ReportRange): Promise<RevenueSection> {
  const { current, previous } = bounds(range);
  const [transactions, previousAggregate] = await Promise.all([
    prisma.transaction.findMany({
      where: { status: "selesai", businessDate: current },
      select: { businessDate: true, total: true },
    }),
    prisma.transaction.aggregate({
      where: { status: "selesai", businessDate: previous },
      _sum: { total: true },
    }),
  ]);

  const byDate = new Map<string, { revenue: number; transactions: number }>();
  let revenue = 0;
  for (const transaction of transactions) {
    revenue += transaction.total;
    const key = dateOnlyToISO(transaction.businessDate);
    const entry = byDate.get(key) ?? { revenue: 0, transactions: 0 };
    entry.revenue += transaction.total;
    entry.transactions += 1;
    byDate.set(key, entry);
  }

  return {
    revenue,
    previousRevenue: previousAggregate._sum.total ?? 0,
    transactions: transactions.length,
    byDate,
  };
}

// ── Penjualan per item: HPP, margin, item terlaris ───────────────────────────

export type ItemSalesSection = {
  cogs: number;
  topItems: ReportData["topItems"];
  categoryMargins: ReportData["categoryMargins"];
  itemMargins: ReportData["itemMargins"];
};

export async function getItemSalesSection(range: ReportRange, topLimit = 6): Promise<ItemSalesSection> {
  const transactions = await prisma.transaction.findMany({
    where: { status: "selesai", businessDate: bounds(range).current },
    select: {
      discount: true,
      items: { select: { name: true, category: true, qty: true, unitCost: true, subtotal: true } },
    },
  });

  let cogs = 0;
  const itemMap = new Map<string, ReportData["topItems"][number]>();
  for (const transaction of transactions) {
    for (const item of transaction.items) {
      cogs += item.qty * item.unitCost;
      const key = `${item.name}|${item.category}`;
      const current = itemMap.get(key) ?? { name: item.name, qty: 0, revenue: 0, category: item.category };
      current.qty += item.qty;
      current.revenue += item.subtotal;
      itemMap.set(key, current);
    }
  }
  const margins = marginByCategory(transactions);

  return {
    cogs,
    topItems: [...itemMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, topLimit),
    categoryMargins: margins.categories,
    itemMargins: margins.items,
  };
}

// ── Biaya operasional ────────────────────────────────────────────────────────

export type ExpenseSection = {
  expenses: number;
  previousExpenses: number;
  expenseByCategory: ReportData["expenseByCategory"];
};

export async function getExpenseSection(range: ReportRange): Promise<ExpenseSection> {
  const { current, previous } = bounds(range);
  const [byCategory, previousAggregate] = await Promise.all([
    prisma.expense.groupBy({
      by: ["category"],
      where: { expenseDate: current },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { expenseDate: previous },
      _sum: { amount: true },
    }),
  ]);

  const expenseByCategory = byCategory
    .map((row) => ({ category: row.category, amount: row._sum.amount ?? 0 }))
    .sort((a, b) => b.amount - a.amount);

  return {
    expenses: expenseByCategory.reduce((sum, row) => sum + row.amount, 0),
    previousExpenses: previousAggregate._sum.amount ?? 0,
    expenseByCategory,
  };
}

// ── Kas: pembayaran pelanggan, pembayaran supplier, refund ───────────────────

export type CashSection = {
  cashIn: number;
  payableCashOut: number;
  refunds: number;
  paymentMethods: ReportData["paymentMethods"];
  /** Kas bersih dari pelanggan per hari: pembayaran − refund. */
  byDate: Map<string, number>;
};

export async function getCashSection(range: ReportRange): Promise<CashSection> {
  const { current } = bounds(range);
  const [payments, payableAggregate, refunds] = await Promise.all([
    prisma.payment.findMany({
      where: { businessDate: current },
      select: { amount: true, method: true, businessDate: true },
    }),
    prisma.payablePayment.aggregate({
      where: { businessDate: current },
      _sum: { amount: true },
    }),
    getRefundsByDate(current.gte, current.lte),
  ]);

  let cashIn = 0;
  const byDate = new Map<string, number>();
  const methodMap = new Map<string, { amount: number; count: number }>();
  for (const payment of payments) {
    cashIn += payment.amount;
    const key = dateOnlyToISO(payment.businessDate);
    byDate.set(key, (byDate.get(key) ?? 0) + payment.amount);
    const method = methodMap.get(payment.method) ?? { amount: 0, count: 0 };
    method.amount += payment.amount;
    method.count += 1;
    methodMap.set(payment.method, method);
  }
  for (const [key, amount] of refunds.byDate) {
    byDate.set(key, (byDate.get(key) ?? 0) - amount);
  }

  return {
    cashIn,
    payableCashOut: payableAggregate._sum.amount ?? 0,
    refunds: refunds.total,
    paymentMethods: [...methodMap.entries()]
      .map(([method, value]) => ({ method, ...value }))
      .sort((a, b) => b.amount - a.amount),
    byDate,
  };
}

// ── Penyesuaian laba: pendapatan pembatalan & selisih stok ───────────────────

export type AdjustmentSection = {
  cancellationIncome: number;
  /** Nilai bertanda; negatif = susut/kerugian persediaan. */
  stockAdjustment: number;
};

export async function getAdjustmentSection(range: ReportRange): Promise<AdjustmentSection> {
  const { current } = bounds(range);
  const [cancellationIncome, stockAdjustment] = await Promise.all([
    getCancellationIncome(current.gte, current.lte),
    getStockAdjustmentValue(current.gte, current.lte),
  ]);
  return { cancellationIncome, stockAdjustment };
}

// ── Posisi piutang saat ini (tidak terikat periode) ──────────────────────────

export async function getReceivableSection(): Promise<{ outstanding: number; overdue: number }> {
  const records = await prisma.transaction.findMany({
    where: { status: "selesai" },
    include: listTransactionInclude,
  });
  const today = todayISO();
  let outstanding = 0;
  let overdue = 0;
  for (const transaction of openTransactionRecords(records)) {
    outstanding += transaction.remaining;
    if (transaction.dueDate && transaction.dueDate < today) overdue += transaction.remaining;
  }
  return { outstanding, overdue };
}

// ── Rumus gabungan (satu sumber untuk semua halaman & ekspor) ────────────────

export function netProfitOf(
  revenue: Pick<RevenueSection, "revenue">,
  items: Pick<ItemSalesSection, "cogs">,
  expense: Pick<ExpenseSection, "expenses">,
  adjustment: AdjustmentSection,
): number {
  return revenue.revenue - items.cogs - expense.expenses + adjustment.cancellationIncome + adjustment.stockAdjustment;
}

export function cashFlowOf(cash: CashSection, expense: Pick<ExpenseSection, "expenses">): { cashOut: number; netCash: number } {
  const cashOut = expense.expenses + cash.payableCashOut + cash.refunds;
  return { cashOut, netCash: cash.cashIn - cashOut };
}

/** Baris harian untuk seluruh rentang; hari tanpa aktivitas tetap muncul dengan nilai 0. */
export function buildDaily(range: ReportRange, revenue: RevenueSection, cash?: CashSection): DailyRow[] {
  return Array.from({ length: range.length }, (_, index) => {
    const date = addDaysISO(range.start, index);
    const entry = revenue.byDate.get(date);
    return {
      date,
      revenue: entry?.revenue ?? 0,
      transactions: entry?.transactions ?? 0,
      cash: cash?.byDate.get(date) ?? 0,
    };
  });
}

// ── Laporan lengkap ──────────────────────────────────────────────────────────

export async function getReportForRange(range: ReportRange): Promise<ReportData> {
  const [revenue, items, expense, cash, adjustment, receivable] = await Promise.all([
    getRevenueSection(range),
    getItemSalesSection(range),
    getExpenseSection(range),
    getCashSection(range),
    getAdjustmentSection(range),
    getReceivableSection(),
  ]);
  const { cashOut, netCash } = cashFlowOf(cash, expense);

  return {
    month: range.month,
    start: range.start,
    end: range.end,
    previousStart: range.previousStart,
    previousEnd: range.previousEnd,
    revenue: revenue.revenue,
    previousRevenue: revenue.previousRevenue,
    transactions: revenue.transactions,
    cogs: items.cogs,
    grossProfit: revenue.revenue - items.cogs,
    expenses: expense.expenses,
    previousExpenses: expense.previousExpenses,
    netProfit: netProfitOf(revenue, items, expense, adjustment),
    cancellationIncome: adjustment.cancellationIncome,
    stockAdjustment: adjustment.stockAdjustment,
    refunds: cash.refunds,
    cashIn: cash.cashIn,
    cashOut,
    netCash,
    outstanding: receivable.outstanding,
    overdue: receivable.overdue,
    daily: buildDaily(range, revenue, cash),
    expenseByCategory: expense.expenseByCategory,
    paymentMethods: cash.paymentMethods,
    topItems: items.topItems,
    categoryMargins: items.categoryMargins,
    itemMargins: items.itemMargins,
  };
}

export function getMonthlyReport(month: string): Promise<ReportData> {
  return getReportForRange(monthlyReportRange(month));
}

export function getReport(start: string, end: string, previous?: { start: string; end: string }): Promise<ReportData> {
  return getReportForRange(reportRange(start, end, previous));
}

export function monthOptions(limit = 12): { value: string; label: string }[] {
  const now = todayISO();
  const [year, month] = now.split("-").map(Number);
  const options: { value: string; label: string }[] = [];
  for (let index = 0; index < limit; index += 1) {
    const date = new Date(Date.UTC(year, month - 1 - index, 1));
    const value = date.toISOString().slice(0, 7);
    const label = new Intl.DateTimeFormat("id-ID", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);
    options.push({ value, label });
  }
  return options;
}

export function getReportMonthBounds(month: string): { start: string; end: string } {
  return { start: `${month}-01`, end: endOfMonthISO(`${month}-01`) };
}
