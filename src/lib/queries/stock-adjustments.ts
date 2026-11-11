import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { monthRange, parseDateOnly } from "../dates";

export type AdjustmentFilter = { month?: string; itemId?: number };

export async function listStockAdjustments({ month, itemId }: AdjustmentFilter) {
  const where: Prisma.StockAdjustmentWhereInput = {};
  if (itemId) where.itemId = itemId;
  if (month) {
    const { start, end } = monthRange(month);
    where.businessDate = { gte: parseDateOnly(start), lte: parseDateOnly(end) };
  }
  const adjustments = await prisma.stockAdjustment.findMany({
    where,
    orderBy: { id: "desc" },
    include: {
      item: { select: { id: true, name: true, sku: true, unit: true } },
      createdBy: { select: { name: true } },
      stockMovements: {
        orderBy: { id: "asc" },
        select: { qty: true, stockBatch: { select: { code: true, unitCost: true } } },
      },
    },
  });
  const loss = adjustments.reduce((sum, adjustment) => sum + Math.min(0, adjustment.value), 0);
  const gain = adjustments.reduce((sum, adjustment) => sum + Math.max(0, adjustment.value), 0);
  return { adjustments, loss, gain, net: loss + gain };
}

// Sum of signed adjustment value in a date range, used by the profit and loss report.
export async function getStockAdjustmentValue(startDate: Date, endDate: Date): Promise<number> {
  const result = await prisma.stockAdjustment.aggregate({
    where: { businessDate: { gte: startDate, lte: endDate } },
    _sum: { value: true },
  });
  return result._sum.value ?? 0;
}
