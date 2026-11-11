"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireOwner, requireUser } from "@/lib/auth";
import type { Prisma } from "@prisma/client";
import { canAcceptPayment, canRefund, generateInvoiceNumber, parseVoidMaxDays, voidWindowCheck } from "@/lib/calculations";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/constants";
import { addDaysISO, dateOnlyToISO, isValidISODate, parseDateOnly, todayISO } from "@/lib/dates";
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

async function getVoidMaxDays(tx: Prisma.TransactionClient): Promise<number | null> {
  const setting = await tx.setting.findUnique({ where: { key: "void_max_days" } });
  return parseVoidMaxDays(setting?.value);
}

function revalidateVoid(id: string, itemIds: (number | null)[] = []) {
  revalidatePath("/");
  revalidatePath("/transaksi");
  revalidatePath(`/transaksi/${id}`);
  revalidatePath("/piutang");
  revalidatePath("/laporan");
  revalidatePath("/pelanggan");
  revalidatePath("/stok");
  for (const itemId of itemIds) if (itemId) revalidatePath(`/stok/${itemId}`);
}

// Pemilik membatalkan nota. Pembayaran lama tetap tersimpan; uang yang dikembalikan dicatat
// sebagai Refund di tanggal hari ini. Pengajuan kasir yang masih pending ikut disetujui.
export async function voidTransactionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireOwner();
  const id = String(formData.get("transactionId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { ok: false, message: "Alasan pembatalan wajib diisi." };
  const refundAmount = Math.floor(Number(formData.get("refundAmount") ?? 0) || 0);
  const refundMethodRaw = String(formData.get("refundMethod") ?? "tunai");
  if (!isPaymentMethod(refundMethodRaw)) return { ok: false, message: "Metode refund tidak valid." };
  const refundMethod: PaymentMethod = refundMethodRaw;

  let itemIds: (number | null)[] = [];
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM transactions WHERE id = ${id} FOR UPDATE`;
      const transaction = await tx.transaction.findUnique({
        where: { id },
        include: {
          payments: { select: { amount: true } },
          items: { select: { id: true, itemId: true, qty: true, category: true, stockBatchId: true, unitCost: true } },
        },
      });
      if (!transaction) throw new Error("Transaksi tidak ditemukan.");
      if (transaction.status === "batal") throw new Error("Transaksi sudah dibatalkan.");

      const today = todayISO();
      const window = voidWindowCheck(dateOnlyToISO(transaction.businessDate), today, await getVoidMaxDays(tx));
      if (!window.ok) throw new Error(window.message);

      const paid = transaction.payments.reduce((sum, payment) => sum + payment.amount, 0);
      const refundCheck = canRefund(paid, refundAmount);
      if (!refundCheck.ok) throw new Error(refundCheck.message);

      const now = new Date();
      await tx.transaction.update({
        where: { id },
        data: {
          status: "batal",
          voidedAt: now,
          voidedDate: parseDateOnly(today),
          voidedById: user.id,
          voidReason: reason.slice(0, 300),
        },
      });
      if (refundAmount > 0) {
        await tx.refund.create({
          data: {
            transactionId: id,
            amount: refundAmount,
            method: refundMethod,
            notes: `Refund pembatalan ${transaction.invoiceNo}`,
            businessDate: parseDateOnly(today),
            refundedAt: now,
            createdById: user.id,
          },
        });
      }
      for (const line of [...transaction.items].sort((a, b) => (a.itemId ?? 0) - (b.itemId ?? 0))) {
        if (line.itemId && line.category === "sparepart") {
          await returnStock(tx, { ...line, itemId: line.itemId }, {
            transactionId: id, invoiceNo: transaction.invoiceNo, createdById: user.id,
          });
        }
      }
      await tx.voidRequest.updateMany({
        where: { transactionId: id, status: "pending" },
        data: { status: "disetujui", reviewedById: user.id, reviewedAt: now },
      });
      itemIds = transaction.items.map((line) => line.itemId);
    });
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Gagal membatalkan transaksi." };
  }

  revalidateVoid(id, itemIds);
  return {
    ok: true,
    message: refundAmount > 0
      ? "Transaksi dibatalkan, refund dicatat, dan stok dikembalikan."
      : "Transaksi dibatalkan dan stok dikembalikan.",
  };
}

// Kasir mengajukan pembatalan; pemilik memutuskan refund saat menyetujui.
export async function requestVoidAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (user.role === "owner") return { ok: false, message: "Pemilik dapat langsung membatalkan transaksi." };
  const id = String(formData.get("transactionId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { ok: false, message: "Alasan pembatalan wajib diisi." };

  try {
    await prisma.$transaction(async (tx) => {
      // Kunci baris nota agar dua pengajuan bersamaan tidak sama-sama lolos.
      await tx.$queryRaw`SELECT id FROM transactions WHERE id = ${id} FOR UPDATE`;
      const transaction = await tx.transaction.findUnique({ where: { id }, select: { status: true, businessDate: true } });
      if (!transaction) throw new Error("Transaksi tidak ditemukan.");
      if (transaction.status === "batal") throw new Error("Transaksi sudah dibatalkan.");
      const window = voidWindowCheck(dateOnlyToISO(transaction.businessDate), todayISO(), await getVoidMaxDays(tx));
      if (!window.ok) throw new Error(window.message);
      const pending = await tx.voidRequest.count({ where: { transactionId: id, status: "pending" } });
      if (pending > 0) throw new Error("Pengajuan pembatalan untuk nota ini masih menunggu persetujuan.");
      await tx.voidRequest.create({
        data: { transactionId: id, reason: reason.slice(0, 300), requestedById: user.id },
      });
    });
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Gagal mengajukan pembatalan." };
  }

  revalidatePath("/", "layout");
  revalidatePath(`/transaksi/${id}`);
  return { ok: true, message: "Pengajuan pembatalan dikirim ke pemilik." };
}

export async function rejectVoidRequestAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireOwner();
  const requestId = Number(formData.get("requestId"));
  const note = String(formData.get("note") ?? "").trim();
  if (!Number.isInteger(requestId) || requestId <= 0) return { ok: false, message: "Pengajuan tidak valid." };

  const request = await prisma.voidRequest.findUnique({ where: { id: requestId }, select: { transactionId: true } });
  if (!request) return { ok: false, message: "Pengajuan tidak ditemukan." };
  const changed = await prisma.voidRequest.updateMany({
    where: { id: requestId, status: "pending" },
    data: { status: "ditolak", reviewedById: user.id, reviewedAt: new Date(), reviewNote: note.slice(0, 300) || null },
  });
  if (changed.count !== 1) return { ok: false, message: "Pengajuan sudah diproses." };

  revalidatePath("/", "layout");
  revalidatePath(`/transaksi/${request.transactionId}`);
  return { ok: true, message: "Pengajuan pembatalan ditolak." };
}

// Koreksi salah input pembayaran: pemilik membalik pembayaran dengan entri bernominal negatif
// di tanggal hari ini. Pembayaran asli tetap tersimpan sehingga kas hari itu tidak berubah.
export async function reversePaymentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireOwner();
  const id = String(formData.get("transactionId") ?? "");
  const paymentId = Number(formData.get("paymentId"));
  const reason = String(formData.get("reason") ?? "").trim();
  if (!Number.isInteger(paymentId) || paymentId <= 0) return { ok: false, message: "Pembayaran tidak valid." };
  if (!reason) return { ok: false, message: "Alasan koreksi wajib diisi." };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM transactions WHERE id = ${id} FOR UPDATE`;
      const transaction = await tx.transaction.findUnique({ where: { id }, select: { status: true } });
      if (!transaction) throw new Error("Transaksi tidak ditemukan.");
      if (transaction.status === "batal") {
        throw new Error("Pembayaran pada nota yang dibatalkan tidak bisa dikoreksi; gunakan refund saat pembatalan.");
      }
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        select: { transactionId: true, amount: true, method: true, reversesPaymentId: true, reversal: { select: { id: true } } },
      });
      if (!payment || payment.transactionId !== id) throw new Error("Pembayaran tidak ditemukan.");
      if (payment.reversesPaymentId !== null) throw new Error("Entri koreksi tidak bisa dibalik lagi.");
      if (payment.reversal) throw new Error("Pembayaran ini sudah dikoreksi.");

      await tx.payment.create({
        data: {
          transactionId: id,
          amount: -payment.amount,
          method: payment.method,
          notes: reason.slice(0, 300),
          businessDate: parseDateOnly(todayISO()),
          paidAt: new Date(),
          receivedById: user.id,
          reversesPaymentId: paymentId,
        },
      });
    });
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Gagal mengoreksi pembayaran." };
  }

  revalidatePath("/");
  revalidatePath("/transaksi");
  revalidatePath(`/transaksi/${id}`);
  revalidatePath("/piutang");
  revalidatePath("/laporan", "layout");
  revalidatePath("/pelanggan");
  return { ok: true, message: "Pembayaran dibalik. Catat ulang pembayaran yang benar bila perlu." };
}
