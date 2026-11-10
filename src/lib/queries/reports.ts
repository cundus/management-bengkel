import { prisma } from "../db";
import { dateOnlyToISO, endOfMonthISO, monthRange, parseDateOnly, todayISO } from "../dates";
import { openTransactionRecords } from "./mappers";
import { listTransactionInclude } from "./mappers";
import type { ReportData } from "../types";
import { marginByCategory } from "../calculations";
import { getCancellationIncome, getRefundsByDate } from "./voids";

function previousMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 2, 1));
  return date.toISOString().slice(0, 7);
}

export async function getMonthlyReport(month: string): Promise<ReportData> {
  const { start, end } = monthRange(month);
  const { start: prevStart, end: prevEnd } = monthRange(previousMonth(month));
  const startDate = parseDateOnly(start);
  const endDate = parseDateOnly(end);

  const [
    transactions,
    previousRevenueAggregate,
    expenses,
    previousExpensesAggregate,
    payments,
    payableCashOutAggregate,
    openRecords,
    refunds,
    cancellationIncome,
  ] = await Promise.all([
    prisma.transaction.findMany({
      where: { status: "selesai", businessDate: { gte: startDate, lte: endDate } },
      include: { items: true },
      orderBy: { businessDate: "asc" },
    }),
    prisma.transaction.aggregate({
      where: {
        status: "selesai",
        businessDate: { gte: parseDateOnly(prevStart), lte: parseDateOnly(prevEnd) },
      },
      _sum: { total: true },
    }),
    prisma.expense.findMany({
      where: { expenseDate: { gte: startDate, lte: endDate } },
      orderBy: { expenseDate: "asc" },
    }),
    prisma.expense.aggregate({
      where: { expenseDate: { gte: parseDateOnly(prevStart), lte: parseDateOnly(prevEnd) } },
      _sum: { amount: true },
    }),
    prisma.payment.findMany({
      where: { businessDate: { gte: startDate, lte: endDate } },
      include: {
        transaction: {
          select: { invoiceNo: true, customer: { select: { name: true } } },
        },
      },
      orderBy: { paidAt: "desc" },
    }),
    prisma.payablePayment.aggregate({
      where: { businessDate: { gte: startDate, lte: endDate } },
      _sum: { amount: true },
    }),
    prisma.transaction.findMany({
      where: { status: "selesai" },
      include: listTransactionInclude,
    }),
    getRefundsByDate(startDate, endDate),
    getCancellationIncome(startDate, endDate),
  ]);

  const revenue = transactions.reduce((sum, transaction) => sum + transaction.total, 0);
  const cogs = transactions.reduce(
    (sum, transaction) =>
      sum + transaction.items.reduce((lineSum, item) => lineSum + item.qty * item.unitCost, 0),
    0,
  );
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const cashIn = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const payableCashOut = payableCashOutAggregate._sum.amount ?? 0;

  const dailyRevenue = new Map<string, { revenue: number; transactions: number }>();
  for (const transaction of transactions) {
    const key = dateOnlyToISO(transaction.businessDate);
    const current = dailyRevenue.get(key) ?? { revenue: 0, transactions: 0 };
    dailyRevenue.set(key, {
      revenue: current.revenue + transaction.total,
      transactions: current.transactions + 1,
    });
  }
  const dailyCashMap = new Map<string, number>();
  for (const payment of payments) {
    const key = dateOnlyToISO(payment.businessDate);
    dailyCashMap.set(key, (dailyCashMap.get(key) ?? 0) + payment.amount);
  }
  // Kas harian bersih dari pelanggan: pembayaran − refund.
  for (const [key, amount] of refunds.byDate) {
    dailyCashMap.set(key, (dailyCashMap.get(key) ?? 0) - amount);
  }

  const dayCount = Number(end.slice(8, 10));
  const daily: ReportData["daily"] = Array.from({ length: dayCount }, (_, index) => {
    const date = `${month}-${String(index + 1).padStart(2, "0")}`;
    const entry = dailyRevenue.get(date);
    return {
      date,
      revenue: entry?.revenue ?? 0,
      transactions: entry?.transactions ?? 0,
      cash: dailyCashMap.get(date) ?? 0,
    };
  });

  const expenseMap = new Map<string, number>();
  for (const expense of expenses) {
    expenseMap.set(expense.category, (expenseMap.get(expense.category) ?? 0) + expense.amount);
  }
  const expenseByCategory = [...expenseMap.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  const paymentMethodMap = new Map<string, { amount: number; count: number }>();
  for (const payment of payments) {
    const current = paymentMethodMap.get(payment.method) ?? { amount: 0, count: 0 };
    paymentMethodMap.set(payment.method, {
      amount: current.amount + payment.amount,
      count: current.count + 1,
    });
  }
  const paymentMethods = [...paymentMethodMap.entries()]
    .map(([method, value]) => ({ method, ...value }))
    .sort((a, b) => b.amount - a.amount);

  const itemMap = new Map<string, { name: string; qty: number; revenue: number; category: "jasa" | "sparepart" }>();
  for (const transaction of transactions) {
    for (const item of transaction.items) {
      const key = `${item.name}|${item.category}`;
      const current = itemMap.get(key) ?? {
        name: item.name,
        qty: 0,
        revenue: 0,
        category: item.category,
      };
      itemMap.set(key, {
        ...current,
        qty: current.qty + item.qty,
        revenue: current.revenue + item.subtotal,
      });
    }
  }
  const topItems = [...itemMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 6);
  const margins = marginByCategory(transactions);

  const open = openTransactionRecords(openRecords);
  const outstanding = open.reduce((sum, transaction) => sum + transaction.remaining, 0);
  const overdue = open.reduce(
    (sum, transaction) =>
      transaction.dueDate && transaction.dueDate < todayISO() ? sum + transaction.remaining : sum,
    0,
  );

  const recentPayments = payments.slice(0, 8).map((payment) => ({
    id: payment.id,
    invoiceNo: payment.transaction.invoiceNo,
    customerName: payment.transaction.customer.name,
    amount: payment.amount,
    method: payment.method,
    businessDate: dateOnlyToISO(payment.businessDate),
  }));

  return {
    month,
    start,
    end,
    revenue,
    previousRevenue: previousRevenueAggregate._sum.total ?? 0,
    transactions: transactions.length,
    cogs,
    grossProfit: revenue - cogs,
    expenses: totalExpenses,
    previousExpenses: previousExpensesAggregate._sum.amount ?? 0,
    netProfit: revenue - cogs - totalExpenses + cancellationIncome,
    cancellationIncome,
    refunds: refunds.total,
    cashIn,
    cashOut: totalExpenses + payableCashOut + refunds.total,
    netCash: cashIn - totalExpenses - payableCashOut - refunds.total,
    outstanding,
    overdue,
    daily,
    expenseByCategory,
    paymentMethods,
    topItems,
    categoryMargins: margins.categories,
    itemMargins: margins.items,
    recentPayments,
  };
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
