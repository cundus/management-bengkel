import { prisma } from "../db";
import { dateTimeToISO } from "../dates";
import type { Item } from "../types";

function mapItem(item: {
  id: number;
  sku: string;
  name: string;
  category: "jasa" | "sparepart";
  unit: string;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  isActive: boolean;
  createdAt: Date;
  stockBatches?: { remaining: number; unitCost: number }[];
}): Item {
  return {
    id: item.id, sku: item.sku, name: item.name, category: item.category, unit: item.unit,
    price: item.price, cost: item.cost, stock: item.stock, minStock: item.minStock, isActive: item.isActive,
    stockValue: item.stockBatches?.reduce((sum, batch) => sum + batch.remaining * batch.unitCost, 0),
    createdAt: dateTimeToISO(item.createdAt),
  };
}

export async function listItems(options?: { search?: string; activeOnly?: boolean }): Promise<Item[]> {
  const search = (options?.search ?? "").trim();
  const rows = await prisma.item.findMany({
    where: {
      ...(options?.activeOnly ? { isActive: true } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { sku: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: [{ category: "desc" }, { name: "asc" }],
    include: { stockBatches: { where: { remaining: { gt: 0 } }, select: { remaining: true, unitCost: true } } },
  });
  return rows.map(mapItem);
}

export async function getCatalog(): Promise<Item[]> {
  return listItems({ activeOnly: true });
}

export async function getLowStockItems(): Promise<Item[]> {
  const rows = await prisma.item.findMany({
    where: { category: "sparepart", isActive: true },
    orderBy: [{ stock: "asc" }, { name: "asc" }],
  });
  return rows.filter((item) => item.stock <= item.minStock).map(mapItem);
}

export async function getItemById(id: number): Promise<Item | null> {
  const row = await prisma.item.findUnique({ where: { id } });
  return row ? mapItem(row) : null;
}
