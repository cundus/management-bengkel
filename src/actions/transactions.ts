"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireOwner, requireUser } from "@/lib/auth";
import { canAcceptPayment, generateInvoiceNumber } from "@/lib/calculations";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/constants";
import { addDaysISO, isValidISODate, parseDateOnly, todayISO } from "@/lib/dates";
import { prisma } from "@/lib/db";
import type { ActionState } from "@/lib/action-state";
import { consumeStock, returnStock } from "@/lib/stock";

export type CreateTransactionInput = {
  customerId: number;
  vehicleId: number | null;
  mechanic: string;
  discount: number;
  notes: string;
  dueDate: string | null;
  items: { itemId: number; qty: number }[];
  payNow: number;
  method: PaymentMethod;
};

export type CreateTransactionResult =
  | { ok: true; id: string; invoiceNo: string }
  | { ok: false; message: string };

function isPaymentMethod(value: string): value is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value);
}

export async function createTransactionAction(input: CreateTransactionInput): Promise<CreateTransactionResult> {
  const user = await requireUser();

  const customerId = Number(input.customerId);
  if (!Number.isInteger(customerId) || customerId <= 0) {
    return { ok: false, message: "Pilih pelanggan terlebih dahulu." };
  }

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) return { ok: false, message: "Pelanggan tidak ditemukan." };

  let vehicleId: number | null = input.vehicleId ? Number(input.vehicleId) : null;
  if (vehicleId) {
    const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, customerId } });
    if (!vehicle) return { ok: false, message: "Kendaraan tidak cocok dengan pelanggan." };
  } else {
    vehicleId = null;
  }

  const merged = new Map<number, number>();
  for (const line of input.items ?? []) {
    const itemId = Number(line.itemId);
    const qty = Math.floor(Number(line.qty));
    if (!Number.isInteger(itemId) || itemId <= 0) continue;
    if (!Number.isFinite(qty) || qty <= 0) continue;
    if (qty > 99) return { ok: false, message: "Jumlah item maksimal 99 per baris." };
    merged.set(itemId, (merged.get(itemId) ?? 0) + qty);
  }

  if (merged.size === 0) return { ok: false, message: "Tambahkan minimal satu jasa atau sparepart." };

  const idList = [...merged.keys()];
  const items = await prisma.item.findMany({ where: { id: { in: idList } } });

  if (items.length !== idList.length) return { ok: false, message: "Ada item yang tidak ditemukan." };

  for (const item of items) {
    const qty = merged.get(item.id)!;
    if (!item.isActive) return { ok: false, message: `${item.name} sudah tidak aktif.` };
    if (item.category === "sparepart" && item.stock < qty) {
      return { ok: false, message: `Stok ${item.name} tidak cukup (tersisa ${item.stock}).` };
    }
  }

  const lines = items.map((item) => {
    const qty = merged.get(item.id)!;
    return {
      itemId: item.id,
      name: item.name,
      category: item.category,
      qty,
      unitPrice: item.price,
      unitCost: item.cost,
      subtotal: item.price * qty,
    };
  });

  const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0);
  const discount = Math.max(0, Math.min(Math.floor(Number(input.discount) || 0), subtotal));
  const total = subtotal - discount;
  const payNow = Math.max(0, Math.floor(Number(input.payNow) || 0));

  if (total < 0) return { ok: false, message: "Total transaksi tidak valid." };
  if (payNow > total) return { ok: false, message: "Nominal pembayaran melebihi total." };

  const method: PaymentMethod = isPaymentMethod(input.method) ? input.method : "tunai";
  const today = todayISO();
  let dueDate: string | null = null;
  if (total - payNow > 0) {
    dueDate = input.dueDate && isValidISODate(input.dueDate) ? input.dueDate : addDaysISO(today, 14);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Serialisasi pembuatan nomor nota per bengkel, aman untuk beberapa kasir.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(225225)::text AS lock`;

      const count = await tx.transaction.count({ where: { businessDate: parseDateOnly(today) } });
      let sequence = count + 1;
      let invoiceNo = generateInvoiceNumber(today, sequence);
      while (await tx.transaction.findUnique({ where: { invoiceNo } })) {
        sequence += 1;
        invoiceNo = generateInvoiceNumber(today, sequence);
      }

      const id = randomUUID();
      const createdAt = new Date();

      await tx.transaction.create({
        data: {
          id,
          invoiceNo,
          customerId,
          vehicleId,
          mechanic: String(input.mechanic ?? "").trim().slice(0, 80) || null,
          subtotal,
          discount,
          total,
          businessDate: parseDateOnly(today),
          dueDate: dueDate ? parseDateOnly(dueDate) : null,
          notes: String(input.notes ?? "").trim().slice(0, 500) || null,
          status: "selesai",
          createdById: user.id,
          createdAt,
          payments:
            payNow > 0
              ? {
                  create: {
                    amount: payNow,
                    method,
                    notes: "Pembayaran awal",
                    businessDate: parseDateOnly(today),
                    paidAt: createdAt,
                    receivedById: user.id,
                  },
                }
              : undefined,
        },
      });

      // The header exists first so ledger rows can reference it. Split a sparepart line
      // by batch so each quantity retains its exact HPP.
      const batchLines: (typeof lines[number] & { transactionId: string; stockBatchId?: number })[] = [];
      for (const line of [...lines].sort((a, b) => a.itemId - b.itemId)) {
        if (line.category !== "sparepart") {
          batchLines.push({ ...line, transactionId: id });
          continue;
        }
        const allocations = await consumeStock(tx, line.itemId, line.qty, { transactionId: id, createdById: user.id });
        for (const allocation of allocations) {
          batchLines.push({ ...line, ...allocation, transactionId: id, subtotal: line.unitPrice * allocation.qty });
        }
      }
      await tx.transactionItem.createMany({ data: batchLines });

      return { id, invoiceNo };
    });

    revalidatePath("/");
    revalidatePath("/transaksi");
    revalidatePath("/piutang");
    revalidatePath("/laporan");
    revalidatePath("/stok");
    for (const itemId of idList) revalidatePath(`/stok/${itemId}`);
    revalidatePath("/pelanggan");

    return { ok: true, ...result };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Transaksi gagal disimpan. Coba lagi.",
    };
  }
}

export async function recordPaymentAction(
  transactionId: string,
  amount: number,
  method: PaymentMethod,
  notes: string,
): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser();
  const id = String(transactionId ?? "").trim();
  if (!id) return { ok: false, message: "Transaksi tidak valid." };

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM transactions WHERE id = ${id} FOR UPDATE`;
    const transaction = await tx.transaction.findUnique({
      where: { id },
      include: { payments: { select: { amount: true } } },
    });
    if (!transaction) return { ok: false, message: "Transaksi tidak ditemukan." };
    if (transaction.status === "batal") return { ok: false, message: "Transaksi yang dibatalkan tidak bisa dibayar." };

    const paid = transaction.payments.reduce((sum, payment) => sum + payment.amount, 0);
    const nominal = Math.floor(Number(amount));
    const check = canAcceptPayment(transaction.total, paid, nominal);
    if (!check.ok) return { ok: false, message: check.message ?? "Nominal tidak valid." };
    if (!isPaymentMethod(method)) return { ok: false, message: "Metode pembayaran tidak valid." };

    await tx.payment.create({
      data: {
        transactionId: id,
        amount: nominal,
        method,
        notes: notes?.trim().slice(0, 300) || null,
        businessDate: parseDateOnly(todayISO()),
        paidAt: new Date(),
        receivedById: user.id,
      },
    });

    return { ok: true, message: "Pembayaran berhasil dicatat." };
  });
  if (!result.ok) return result;

  revalidatePath("/");
  revalidatePath("/transaksi");
  revalidatePath(`/transaksi/${id}`);
  revalidatePath("/piutang");
  revalidatePath("/laporan");
  revalidatePath("/pelanggan");

  return result;
}

export async function voidTransactionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireOwner();
  const id = String(formData.get("transactionId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { ok: false, message: "Alasan pembatalan wajib diisi." };

  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: {
      payments: { select: { amount: true } },
      items: { select: { id: true, itemId: true, qty: true, category: true, stockBatchId: true, unitCost: true } },
    },
  });

  if (!transaction) return { ok: false, message: "Transaksi tidak ditemukan." };
  if (transaction.status === "batal") return { ok: false, message: "Transaksi sudah dibatalkan." };
  const paid = transaction.payments.reduce((sum, payment) => sum + payment.amount, 0);
  if (paid > 0) {
    return { ok: false, message: "Transaksi sudah memiliki pembayaran dan tidak bisa dibatalkan." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM transactions WHERE id = ${id} FOR UPDATE`;
      const changed = await tx.transaction.updateMany({
        where: { id, status: "selesai", payments: { none: {} } },
        data: {
          status: "batal",
          voidedAt: new Date(),
          voidReason: reason.slice(0, 300),
        },
      });
      if (changed.count !== 1) throw new Error("Transaksi sudah dibatalkan atau memiliki pembayaran.");
      for (const line of [...transaction.items].sort((a, b) => (a.itemId ?? 0) - (b.itemId ?? 0))) {
        if (line.itemId && line.category === "sparepart") {
          await returnStock(tx, { ...line, itemId: line.itemId }, {
            transactionId: id, invoiceNo: transaction.invoiceNo, createdById: user.id,
          });
        }
      }
    });
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Gagal membatalkan transaksi." };
  }

  revalidatePath("/");
  revalidatePath("/transaksi");
  revalidatePath(`/transaksi/${id}`);
  revalidatePath("/laporan");
  revalidatePath("/stok");
  for (const line of transaction.items) if (line.itemId) revalidatePath(`/stok/${line.itemId}`);
  return { ok: true, message: "Transaksi dibatalkan dan stok dikembalikan." };
}
