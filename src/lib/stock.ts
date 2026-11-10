import type { Prisma, StockMovementType } from "@prisma/client";
import { parseDateOnly, todayISO } from "@/lib/dates";

// Use the same item lock for receiving, selling, returning, and catalog edits.
export async function lockStockItem(tx: Prisma.TransactionClient, itemId: number) {
  await tx.$queryRaw`SELECT id FROM items WHERE id = ${itemId} FOR UPDATE`;
}

type MovementRef = {
  createdById: number;
  transactionId?: string;
  purchaseId?: number;
  notes?: string | null;
};

// Every items.stock change goes through here so the ledger cannot drift from the balance.
// Callers must hold lockStockItem for the item so balances are written in id order.
async function changeStock(
  tx: Prisma.TransactionClient,
  itemId: number,
  type: StockMovementType,
  parts: { stockBatchId: number; qty: number }[],
  ref: MovementRef,
) {
  const delta = parts.reduce((sum, part) => sum + part.qty, 0);
  const { stock } = await tx.item.update({ where: { id: itemId }, data: { stock: { increment: delta } }, select: { stock: true } });
  let balance = stock - delta;
  for (const part of parts) {
    balance += part.qty;
    await tx.stockMovement.create({ data: {
      itemId, type, qty: part.qty, balanceAfter: balance, stockBatchId: part.stockBatchId,
      transactionId: ref.transactionId, purchaseId: ref.purchaseId, notes: ref.notes ?? null, createdById: ref.createdById,
    } });
  }
}

export async function receiveStock(tx: Prisma.TransactionClient, data: {
  itemId: number; code: string; receivedDate: Date; quantity: number; unitCost: number;
  notes?: string | null; purchaseId?: number;
}, ref: { type: "saldo_awal" | "penerimaan" | "pembelian"; createdById: number }) {
  await lockStockItem(tx, data.itemId);
  const item = await tx.item.findUnique({ where: { id: data.itemId } });
  if (!item || item.category !== "sparepart" || !item.isActive) throw new Error("Pilih sparepart yang masih aktif.");
  if (item.stock + data.quantity > 2147483647) throw new Error("Jumlah stok melebihi batas penyimpanan.");
  const batch = await tx.stockBatch.create({ data: { ...data, remaining: data.quantity } });
  await changeStock(tx, data.itemId, ref.type, [{ stockBatchId: batch.id, qty: data.quantity }], {
    createdById: ref.createdById, purchaseId: data.purchaseId, notes: data.notes,
  });
  return batch;
}

export async function consumeStock(tx: Prisma.TransactionClient, itemId: number, qty: number, ref: { transactionId: string; createdById: number }) {
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
  await changeStock(tx, itemId, "penjualan", allocations.map((a) => ({ stockBatchId: a.stockBatchId, qty: -a.qty })), ref);
  return allocations;
}

// Returns a voided sale line to its original batch, or to a new batch for pre-batch invoices.
export async function returnStock(tx: Prisma.TransactionClient, line: {
  id: number; itemId: number; qty: number; unitCost: number; stockBatchId: number | null;
}, ref: { transactionId: string; invoiceNo: string; createdById: number }) {
  await lockStockItem(tx, line.itemId);
  let stockBatchId = line.stockBatchId;
  if (stockBatchId) {
    await tx.stockBatch.update({ where: { id: stockBatchId }, data: { remaining: { increment: line.qty } } });
  } else {
    // Older invoices predate batch tracking; preserve their original cost.
    stockBatchId = (await tx.stockBatch.create({ data: {
      itemId: line.itemId, code: `RETUR-LAMA-${line.id}`, receivedDate: parseDateOnly(todayISO()),
      quantity: line.qty, remaining: line.qty, unitCost: line.unitCost,
      notes: `Pengembalian ${ref.invoiceNo}`,
    } })).id;
  }
  await changeStock(tx, line.itemId, "pembatalan", [{ stockBatchId, qty: line.qty }], {
    createdById: ref.createdById, transactionId: ref.transactionId, notes: `Pembatalan ${ref.invoiceNo}`,
  });
}
