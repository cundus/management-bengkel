import { cache } from "react";
import { prisma } from "../db";
import { addDaysISO, dateOnlyToISO, daysBetween, lastNDates, parseDateOnly, startOfMonthISO, todayISO } from "../dates";
import { listTransactionInclude, mapTransactionList } from "./mappers";
import { findOpenTransactionIdsDueBy, getOpenReceivableSummary } from "./balances";
import { listRowsByIds } from "./transactions";
import { getLowStockItems } from "./items";
import { getCancellationIncome, getRefundsByDate } from "./voids";
import type { DashboardData } from "../types";

async function buildDashboardData(): Promise<DashboardData> {
  const today = todayISO();
  const yesterday = addDaysISO(today, -1);
  const monthStart = startOfMonthISO(today);
  const weekDates = lastNDates(7, today);
  const todayDate = parseDateOnly(today);
  const monthStartDate = parseDateOnly(monthStart);

  const [
    todayTransactions,
    yesterdayAggregate,
    todayCashAggregate,
    monthTransactions,
    monthCashAggregate,
    monthExpenseAggregate,
    receivableSummary,
    dueSoonRows,
    payableRecords,
    weeklyTransactions,
    weeklyPayments,
    recentRecords,
    lowStock,
    refunds,
    monthCancellationIncome,
  ] = await Promise.all([
    prisma.transaction.findMany({
      where: { status: "selesai", businessDate: todayDate },
      select: { total: true },
    }),
    prisma.transaction.aggregate({
      where: { status: "selesai", businessDate: parseDateOnly(yesterday) },
      _sum: { total: true },
    }),
    prisma.payment.aggregate({
      where: { businessDate: todayDate },
      _sum: { amount: true },
    }),
    prisma.transaction.findMany({
      where: {
        status: "selesai",
        businessDate: { gte: monthStartDate, lte: todayDate },
      },
      select: { total: true, items: { select: { qty: true, unitCost: true } } },
    }),
    prisma.payment.aggregate({
      where: { businessDate: { gte: monthStartDate, lte: todayDate } },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { expenseDate: { gte: monthStartDate, lte: todayDate } },
      _sum: { amount: true },
    }),
    getOpenReceivableSummary(today, addDaysISO(today, 7)),
    findOpenTransactionIdsDueBy(addDaysISO(today, 7), 4).then(listRowsByIds),
    prisma.payable.findMany({
      include: { payments: { select: { amount: true } } },
    }),
    prisma.transaction.findMany({
      where: {
        status: "selesai",
        businessDate: { gte: parseDateOnly(weekDates[0]), lte: todayDate },
      },
      select: { businessDate: true, total: true },
    }),
    prisma.payment.findMany({
      where: {
        businessDate: { gte: parseDateOnly(weekDates[0]), lte: todayDate },
      },
      select: { businessDate: true, amount: true },
    }),
    prisma.transaction.findMany({
      where: { status: "selesai" },
      include: listTransactionInclude,
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    getLowStockItems(),
    getRefundsByDate(parseDateOnly(weekDates[0] < monthStart ? weekDates[0] : monthStart), todayDate),
    getCancellationIncome(monthStartDate, todayDate),
  ]);
  const refundBetween = (from: string, to: string) =>
    [...refunds.byDate].reduce((sum, [date, amount]) => (date >= from && date <= to ? sum + amount : sum), 0);

  const todayRevenue = todayTransactions.reduce((sum, transaction) => sum + transaction.total, 0);
  const monthRevenue = monthTransactions.reduce((sum, transaction) => sum + transaction.total, 0);
  const monthCogs = monthTransactions.reduce(
    (sum, transaction) =>
      sum + transaction.items.reduce((lineSum, item) => lineSum + item.qty * item.unitCost, 0),
    0,
  );

  const receivables = {
    total: receivableSummary.total,
    count: receivableSummary.count,
    overdueTotal: receivableSummary.overdueTotal,
    overdueCount: receivableSummary.overdueCount,
    dueSoonTotal: receivableSummary.dueSoonTotal,
  };

  const payables = payableRecords.reduce(
    (acc, payable) => {
      const paid = payable.payments.reduce((sum, payment) => sum + payment.amount, 0);
      const remaining = Math.max(0, payable.amount - paid);
      if (remaining <= 0) return acc;
      acc.total += remaining;
      acc.count += 1;
      if (payable.dueDate && dateOnlyToISO(payable.dueDate) < today) acc.overdueCount += 1;
      return acc;
    },
    { total: 0, count: 0, overdueCount: 0 },
  );

  const revenueByDate = new Map<string, number>();
  for (const transaction of weeklyTransactions) {
    const date = dateOnlyToISO(transaction.businessDate);
    revenueByDate.set(date, (revenueByDate.get(date) ?? 0) + transaction.total);
  }
  const cashByDate = new Map<string, number>();
  for (const payment of weeklyPayments) {
    const date = dateOnlyToISO(payment.businessDate);
    cashByDate.set(date, (cashByDate.get(date) ?? 0) + payment.amount);
  }
  for (const [date, amount] of refunds.byDate) {
    if (date >= weekDates[0]) cashByDate.set(date, (cashByDate.get(date) ?? 0) - amount);
  }

  const dueSoon = dueSoonRows.map((transaction) => ({
    ...transaction,
    daysLeft: transaction.dueDate ? daysBetween(today, transaction.dueDate) : 0,
  }));

  return {
    today,
    todayRevenue,
    todayCash: (todayCashAggregate._sum.amount ?? 0) - refundBetween(today, today),
    todayTransactions: todayTransactions.length,
    yesterdayRevenue: yesterdayAggregate._sum.total ?? 0,
    monthRevenue,
    monthCash: (monthCashAggregate._sum.amount ?? 0) - refundBetween(monthStart, today),
    monthExpenses: monthExpenseAggregate._sum.amount ?? 0,
    monthProfit: monthRevenue - monthCogs - (monthExpenseAggregate._sum.amount ?? 0) + monthCancellationIncome,
    receivables,
    payables,
    weekly: weekDates.map((date) => ({
      date,
      revenue: revenueByDate.get(date) ?? 0,
      cash: cashByDate.get(date) ?? 0,
    })),
    recentTransactions: recentRecords.map(mapTransactionList),
    dueSoon,
    lowStock,
  };
}

export const getDashboardData = cache(buildDashboardData);

export function getTodayGreeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Jakarta" }).format(new Date()),
  );
  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 19) return "Selamat sore";
  return "Selamat malam";
}
