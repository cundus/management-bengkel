import { cache } from "react";
import { prisma } from "../db";
import { parseDateOnly, todayISO } from "../dates";
import { countPendingVoidRequests } from "./voids";

export const getNavigationSummary = cache(async () => {
  const today = todayISO();
  const [transactions, lowStock, voidRequests] = await Promise.all([
    prisma.transaction.findMany({
      where: { status: "selesai" },
      select: { total: true, dueDate: true, payments: { select: { amount: true } } },
    }),
    prisma.item.count({
      where: { category: "sparepart", isActive: true, stock: { lte: prisma.item.fields.minStock } },
    }),
    countPendingVoidRequests(),
  ]);

  let outstanding = 0;
  let overdue = 0;
  const todayDate = parseDateOnly(today);
  for (const transaction of transactions) {
    const paid = transaction.payments.reduce((sum, payment) => sum + payment.amount, 0);
    if (transaction.total <= paid) continue;
    outstanding += 1;
    if (transaction.dueDate && transaction.dueDate < todayDate) overdue += 1;
  }

  return { today, outstanding, overdue, lowStock, voidRequests };
});
