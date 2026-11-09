import type { Prisma } from "@prisma/client";

// Use the same item lock for receiving, selling, returning, and catalog edits.
export async function lockStockItem(tx: Prisma.TransactionClient, itemId: number) {
  await tx.$queryRaw`SELECT id FROM items WHERE id = ${itemId} FOR UPDATE`;
}

export async function receiveStock(tx: Prisma.TransactionClient, data: {
  itemId: number; code: string; receivedDate: Date; quantity: number; unitCost: number;
  notes?: string | null; purchaseId?: number;
}) {
  await lockStockItem(tx, data.itemId);
  const item = await tx.item.findUnique({ where: { id: data.itemId } });
  if (!item || item.category !== "sparepart" || !item.isActive) throw new Error("Pilih sparepart yang masih aktif.");
  if (item.stock + data.quantity > 2147483647) throw new Error("Jumlah stok melebihi batas penyimpanan.");
  const batch = await tx.stockBatch.create({ data: { ...data, remaining: data.quantity } });
  await tx.item.update({ where: { id: data.itemId }, data: { stock: { increment: data.quantity } } });
  return batch;
}

export async function consumeStock(tx: Prisma.TransactionClient, itemId: number, qty: number) {
  await lockStockItem(tx, itemId);
  const item = await tx.item.findUniqueOrThrow({ where: { id: itemId } });
  if (!item.isActive || item.category !== "sparepart" || item.stock < qty) {
    throw new Error(`Stok ${item.name} berubah. Muat ulang halaman.`);
  }
  const batches = await tx.stockBatch.findMany({
    where: { itemId, remaining: { gt: 0 } },
    orderBy: [{ receivedDate: "asc" }, { id: "asc" }],
  });
  const allocations: { stockBatchId: number; qty: number; unitCost: number }[] = [];
  let needed = qty;
  for (const batch of batches) {
    if (needed === 0) break;
    const taken = Math.min(needed, batch.remaining);
    await tx.stockBatch.update({ where: { id: batch.id }, data: { remaining: { decrement: taken } } });
    allocations.push({ stockBatchId: batch.id, qty: taken, unitCost: batch.unitCost });
    needed -= taken;
  }
  if (needed > 0) throw new Error(`Saldo batch ${item.name} tidak sesuai stok. Periksa persediaan.`);
  await tx.item.update({ where: { id: itemId }, data: { stock: { decrement: qty } } });
  return allocations;
}
