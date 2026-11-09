"use server";

import { Prisma } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PAYMENT_METHODS } from "@/lib/constants";
import { isValidISODate, parseDateOnly, todayISO } from "@/lib/dates";
import { receiveStock } from "@/lib/stock";

const integer = z.number().int().min(0).max(2147483647);
const purchaseSchema = z.object({
  requestId: z.uuid(),
  supplierId: integer.positive(),
  referenceNo: z.string().trim().max(80).transform((value) => value.toUpperCase() || null),
  businessDate: z.string().refine(isValidISODate, "Tanggal pembelian tidak valid."),
  dueDate: z.string().nullable(),
  notes: z.string().trim().max(500),
  payNow: integer,
  method: z.enum(PAYMENT_METHODS),
  lines: z.array(z.object({
    itemId: integer.positive(),
    code: z.string().trim().min(1).max(80).transform((value) => value.toUpperCase()),
    quantity: integer.positive(),
    unitCost: integer,
  })).min(1).max(100),
});

export type PurchaseResult = { ok: true; id: number } | { ok: false; message: string };

export async function createPurchaseAction(input: unknown): Promise<PurchaseResult> {
  const user = await requireOwner();
  const parsed = purchaseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Periksa supplier, tanggal, kode batch, jumlah bulat, dan modal setiap barang (maksimal 100 baris)." };
  const data = parsed.data;
  if (data.businessDate > todayISO()) return { ok: false, message: "Tanggal pembelian tidak boleh melewati hari ini." };
  const total = data.lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0);
  if (!Number.isSafeInteger(total) || total <= 0 || total > 2147483647) return { ok: false, message: "Total pembelian harus lebih dari 0 dan maksimal Rp 2.147.483.647." };
  if (data.payNow > total) return { ok: false, message: "Pembayaran melebihi total pembelian." };
  if (data.payNow < total && (!data.dueDate || !isValidISODate(data.dueDate) || data.dueDate < data.businessDate)) {
    return { ok: false, message: "Isi jatuh tempo pada atau setelah tanggal pembelian untuk sisa hutang." };
  }
  if (new Set(data.lines.map((line) => `${line.itemId}:${line.code}`)).size !== data.lines.length) {
    return { ok: false, message: "Kode batch untuk barang yang sama tidak boleh berulang dalam pembelian." };
  }

  let id: number;
  try {
    id = await prisma.$transaction(async (tx) => {
      // Retrying the same form, including simultaneous submissions, must not receive stock twice.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${data.requestId}, 0))::text AS lock`;
      const existing = await tx.purchase.findUnique({ where: { requestId: data.requestId } });
      if (existing) return existing.id;
      await tx.$queryRaw`SELECT id FROM suppliers WHERE id = ${data.supplierId} FOR UPDATE`;
      if (!await tx.supplier.findUnique({ where: { id: data.supplierId } })) throw new Error("Supplier tidak ditemukan.");
      if (data.referenceNo && await tx.payable.findFirst({ where: { supplierId: data.supplierId, referenceNo: { equals: data.referenceNo, mode: "insensitive" } } })) {
        throw new Error("Nomor nota ini sudah memiliki tagihan supplier. Periksa pencatatan sebelumnya agar tidak tercatat dua kali.");
      }
      const payable = await tx.payable.create({ data: {
        supplierId: data.supplierId, referenceNo: data.referenceNo, description: "Pembelian sparepart",
        amount: total, businessDate: parseDateOnly(data.businessDate),
        dueDate: data.payNow < total ? parseDateOnly(data.dueDate!) : null, createdById: user.id,
        payments: data.payNow > 0 ? { create: {
          amount: data.payNow, method: data.method, notes: "Pembayaran awal pembelian",
          businessDate: parseDateOnly(data.businessDate), paidById: user.id,
        } } : undefined,
      } });
      const purchase = await tx.purchase.create({ data: {
        requestId: data.requestId, supplierId: data.supplierId, referenceNo: data.referenceNo,
        businessDate: parseDateOnly(data.businessDate), total, notes: data.notes || null,
        payableId: payable.id, createdById: user.id,
      } });
      for (const line of [...data.lines].sort((a, b) => a.itemId - b.itemId)) {
        await receiveStock(tx, { ...line, receivedDate: parseDateOnly(data.businessDate), purchaseId: purchase.id });
      }
      return purchase.id;
    }, { timeout: 15000 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        const existing = await prisma.purchase.findUnique({ where: { requestId: data.requestId } });
        if (existing) return { ok: true, id: existing.id };
        return { ok: false, message: "Nomor nota supplier atau kode batch sudah tercatat. Periksa agar pembelian tidak diduplikasi." };
      }
      return { ok: false, message: "Pembelian gagal disimpan. Tidak ada perubahan stok atau hutang. Coba lagi." };
    }
    return { ok: false, message: error instanceof Error ? error.message : "Pembelian gagal disimpan." };
  }
  for (const path of ["/", "/pembelian", "/stok", "/hutang", "/laporan", "/transaksi/baru"]) revalidatePath(path);
  for (const line of data.lines) revalidatePath(`/stok/${line.itemId}`);
  return { ok: true, id };
}
