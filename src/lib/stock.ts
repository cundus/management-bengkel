import type { Prisma, StockAdjustmentReason, StockMovementType } from "@prisma/client";
import { parseDateOnly, todayISO } from "@/lib/dates";
import { adjustmentNumber, reasonAllows, type AdjustmentDirection } from "@/lib/stock-adjustments";

const MAX_INT = 2147483647;

// Use the same item lock for receiving, selling, returning, and catalog edits.
export async function lockStockItem(tx: Prisma.TransactionClient, itemId: number) {
  await tx.$queryRaw`SELECT id FROM items WHERE id = ${itemId} FOR UPDATE`;
}

type MovementRef = {
  createdById: number;
  transactionId?: string;
  purchaseId?: number;
  stockAdjustmentId?: number;
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
      transactionId: ref.transactionId, purchaseId: ref.purchaseId, stockAdjustmentId: ref.stockAdjustmentId, notes: ref.notes ?? null, createdById: ref.createdById,
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

// Takes qty from batches in FIFO order, or from one batch when stockBatchId is given.
async function takeFromBatches(tx: Prisma.TransactionClient, itemId: number, qty: number, stockBatchId?: number) {
  const batches = await tx.stockBatch.findMany({
    where: { itemId, remaining: { gt: 0 }, ...(stockBatchId ? { id: stockBatchId } : {}) },
    orderBy: [{ receivedDate: "asc" }, { id: "asc" }],
  });
  const allocations: { stockBatchId: number; qty: number; unitCost: number }[] = [];
  let needed = qty;
  for (const batch of batches) {
    if (needed === 0) break;
    const taken = Math.min(needed, batch.remaining);
    allocations.push({ stockBatchId: batch.id, qty: taken, unitCost: batch.unitCost });
    needed -= taken;
  }
  if (needed > 0) return null;
  for (const allocation of allocations) {
    await tx.stockBatch.update({ where: { id: allocation.stockBatchId }, data: { remaining: { decrement: allocation.qty } } });
  }
  return allocations;
}

export async function consumeStock(tx: Prisma.TransactionClient, itemId: number, qty: number, ref: { transactionId: string; createdById: number }) {
  await lockStockItem(tx, itemId);
  const item = await tx.item.findUniqueOrThrow({ where: { id: itemId } });
  if (!item.isActive || item.category !== "sparepart" || item.stock < qty) {
    throw new Error(`Stok ${item.name} berubah. Muat ulang halaman.`);
  }
  const allocations = await takeFromBatches(tx, itemId, qty);
  if (!allocations) throw new Error(`Saldo batch ${item.name} tidak sesuai stok. Periksa persediaan.`);
  await changeStock(tx, itemId, "penjualan", allocations.map((a) => ({ stockBatchId: a.stockBatchId, qty: -a.qty })), ref);
  return allocations;
}

export type StockAdjustmentInput = {
  itemId: number;
  direction: AdjustmentDirection;
  qty: number;
  reason: StockAdjustmentReason;
  notes: string;
  // Saldo yang dilihat pengguna saat mengisi form; ditolak bila stok sudah berubah.
  expectedStock: number;
  // Kurang: batch tertentu (opsional, default FIFO). Tambah: modal per unit batch baru.
  stockBatchId?: number;
  unitCost?: number;
};

// Manual adjustment as its own document so every change has a reason, actor, and value.
export async function adjustStock(tx: Prisma.TransactionClient, input: StockAdjustmentInput, ref: { createdById: number }) {
  if (!reasonAllows(input.reason, input.direction)) throw new Error("Alasan tidak sesuai dengan arah penyesuaian.");
  await lockStockItem(tx, input.itemId);
  const item = await tx.item.findUnique({ where: { id: input.itemId } });
  if (!item || item.category !== "sparepart") throw new Error("Penyesuaian hanya untuk sparepart.");
  if (item.stock !== input.expectedStock) {
    throw new Error(`Stok ${item.name} sudah berubah menjadi ${item.stock} sejak form dibuka. Periksa lagi sebelum menyimpan.`);
  }
  const businessDate = parseDateOnly(todayISO());
  const notes = input.notes.trim();

  if (input.direction === "kurang") {
    if (input.qty > item.stock) throw new Error(`Stok ${item.name} hanya ${item.stock}. Penyesuaian tidak boleh membuat stok negatif.`);
    const allocations = await takeFromBatches(tx, item.id, input.qty, input.stockBatchId);
    if (!allocations) {
      throw new Error(input.stockBatchId ? "Sisa batch yang dipilih tidak cukup." : `Saldo batch ${item.name} tidak sesuai stok. Periksa persediaan.`);
    }
    const value = -allocations.reduce((sum, a) => sum + a.qty * a.unitCost, 0);
    if (value < -MAX_INT) throw new Error("Nilai penyesuaian melebihi batas penyimpanan.");
    const adjustment = await tx.stockAdjustment.create({ data: {
      itemId: item.id, reason: input.reason, qty: -input.qty, stockBefore: item.stock, stockAfter: item.stock - input.qty,
      value, notes, businessDate, createdById: ref.createdById,
    } });
    await changeStock(tx, item.id, "penyesuaian", allocations.map((a) => ({ stockBatchId: a.stockBatchId, qty: -a.qty })), {
      createdById: ref.createdById, stockAdjustmentId: adjustment.id, notes,
    });
    return adjustment;
  }

  const unitCost = input.unitCost ?? item.cost;
  if (item.stock + input.qty > MAX_INT) throw new Error("Jumlah stok melebihi batas penyimpanan.");
  if (input.qty * unitCost > MAX_INT) throw new Error("Nilai penyesuaian melebihi batas penyimpanan.");
  const adjustment = await tx.stockAdjustment.create({ data: {
    itemId: item.id, reason: input.reason, qty: input.qty, stockBefore: item.stock, stockAfter: item.stock + input.qty,
    value: input.qty * unitCost, notes, businessDate, createdById: ref.createdById,
  } });
  const batch = await tx.stockBatch.create({ data: {
    itemId: item.id, code: adjustmentNumber(adjustment.id), receivedDate: businessDate,
    quantity: input.qty, remaining: input.qty, unitCost, notes: `Penyesuaian ${adjustmentNumber(adjustment.id)}`,
  } });
  await changeStock(tx, item.id, "penyesuaian", [{ stockBatchId: batch.id, qty: input.qty }], {
    createdById: ref.createdById, stockAdjustmentId: adjustment.id, notes,
  });
  return adjustment;
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
