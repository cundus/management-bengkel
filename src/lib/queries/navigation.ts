import { cache } from "react";
import { prisma } from "../db";
import { todayISO } from "../dates";
import { getOpenReceivableSummary } from "./balances";
import { countPendingVoidRequests } from "./voids";

export function countLowStockItems(): Promise<number> {
  return prisma.item.count({
    where: { category: "sparepart", isActive: true, stock: { lte: prisma.item.fields.minStock } },
  });
}

export const getNavigationSummary = cache(async () => {
  const today = todayISO();
  const [receivables, lowStock, voidRequests] = await Promise.all([
    getOpenReceivableSummary(today),
    countLowStockItems(),
    countPendingVoidRequests(),
  ]);

  return { today, outstanding: receivables.count, overdue: receivables.overdueCount, lowStock, voidRequests };
});
