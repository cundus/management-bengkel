"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ITEM_CATEGORIES, type ItemCategory } from "@/lib/constants";
import type { ActionState } from "@/lib/action-state";
import { isValidISODate, parseDateOnly, todayISO } from "@/lib/dates";
import { adjustStock, lockStockItem, receiveStock } from "@/lib/stock";
import { adjustmentNumber, isAdjustmentReason } from "@/lib/stock-adjustments";

function rupiah(value: FormDataEntryValue | null): number {
  return Number(String(value ?? "").replace(/[^\d]/g, "")) || 0;
}

export async function saveItemAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireOwner();
  const id = Number(formData.get("id") ?? 0);
  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim().toUpperCase();
  const category = String(formData.get("category") ?? "") as ItemCategory;
  const unit = String(formData.get("unit") ?? "pcs").trim() || "pcs";
  const price = rupiah(formData.get("price"));
  const cost = rupiah(formData.get("cost"));
  const stock = Number(formData.get("stock") ?? 0);
  const minStock = Number(String(formData.get("minStock") ?? "0").replace(/\D/g, "")) || 0;

  const fieldErrors: Record<string, string> = {};
  if (!Number.isInteger(id) || id < 0) return { ok: false, message: "Item tidak valid." };
  if (!Number.isInteger(stock) || stock < 0 || stock > 2147483647) fieldErrors.stock = "Stok harus berupa bilangan bulat positif atau nol.";
  if (name.length < 2) fieldErrors.name = "Nama item minimal 2 karakter.";
  if (!sku) fieldErrors.sku = "SKU wajib diisi.";
  if (!ITEM_CATEGORIES.includes(category)) {
    fieldErrors.category = "Kategori tidak valid.";
  }
  if (price <= 0) fieldErrors.price = "Harga jual harus lebih dari 0.";
  if (cost > price) fieldErrors.cost = "Harga modal tidak boleh melebihi harga jual.";
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Periksa kembali data item.", fieldErrors };
  }

  try {
    if (id > 0) {
      await prisma.$transaction(async (tx) => {
        await lockStockItem(tx, id);
        const existing = await tx.item.findUniqueOrThrow({ where: { id } });
        if (existing.category === "sparepart" && category !== "sparepart") {
          throw new Error("Sparepart tidak dapat diubah menjadi jasa karena stok dikelola per batch.");
        }
        await tx.item.update({
          where: { id },
          data: { name, sku, category, unit, price, cost, minStock },
        });
      });
    } else {
      await prisma.$transaction(async (tx) => {
        const item = await tx.item.create({
          data: { sku, name, category, unit, price, cost, stock: 0, minStock, isActive: true },
        });
        if (category === "sparepart" && stock > 0) {
          await receiveStock(tx, {
            itemId: item.id, code: "STOK-AWAL", receivedDate: parseDateOnly(todayISO()), quantity: stock, unitCost: cost,
          }, { type: "saldo_awal", createdById: user.id });
        }
      });
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, message: "SKU sudah dipakai item lain." };
    }
    return { ok: false, message: error instanceof Error && !(error instanceof Prisma.PrismaClientKnownRequestError) ? error.message : "Gagal menyimpan item." };
  }

  revalidatePath("/stok");
  if (id > 0) revalidatePath(`/stok/${id}`);
  revalidatePath("/transaksi/baru");
  return { ok: true, message: id > 0 ? "Item diperbarui." : "Item baru ditambahkan." };
}

export async function receiveStockBatchAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireOwner();
  const itemId = Number(formData.get("itemId"));
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const receivedDate = String(formData.get("receivedDate") ?? "");
  const quantity = Number(formData.get("quantity"));
  const unitCost = Number(formData.get("unitCost"));
  if (!Number.isInteger(itemId) || itemId <= 0 || !code || code.length > 80 ||
      !isValidISODate(receivedDate) || receivedDate > todayISO() ||
      !Number.isInteger(quantity) || quantity <= 0 || quantity > 2147483647 ||
      !Number.isInteger(unitCost) || unitCost < 0 || unitCost > 2147483647 || !String(formData.get("unitCost") ?? "").trim()) {
    return { ok: false, message: "Isi kode batch (maksimal 80 karakter), tanggal masuk hingga hari ini, jumlah bulat di atas 0, dan modal bulat minimal 0." };
  }
  try {
    await prisma.$transaction(async (tx) => {
      await receiveStock(tx, {
        itemId, code, receivedDate: parseDateOnly(receivedDate), quantity, unitCost,
        notes: String(formData.get("notes") ?? "").trim().slice(0, 500) || null,
      }, { type: "penerimaan", createdById: user.id });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return { ok: false, message: error.code === "P2002" ? "Kode batch sudah dipakai untuk item ini." : "Gagal menyimpan batch. Coba lagi." };
    }
    return { ok: false, message: error instanceof Error ? error.message : "Gagal menyimpan batch." };
  }
  for (const path of ["/", "/stok", `/stok/${itemId}`, "/transaksi/baru"]) revalidatePath(path);
  return { ok: true, message: "Batch diterima dan stok bertambah." };
}

export async function adjustStockAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireOwner();
  const field = (name: string) => String(formData.get(name) ?? "").trim();
  const itemId = Number(field("itemId"));
  const direction = field("direction");
  const qty = Number(field("qty"));
  const reason = field("reason");
  const notes = field("notes");
  const expectedStock = Number(field("expectedStock"));
  const stockBatchId = field("stockBatchId") ? Number(field("stockBatchId")) : undefined;
  const unitCost = field("unitCost") ? Number(field("unitCost")) : undefined;

  const fieldErrors: Record<string, string> = {};
  if (!Number.isInteger(itemId) || itemId <= 0 || !Number.isInteger(expectedStock) || expectedStock < 0) {
    return { ok: false, message: "Data item tidak valid. Muat ulang halaman." };
  }
  if (direction !== "kurang" && direction !== "tambah") fieldErrors.direction = "Pilih tambah atau kurangi stok.";
  if (!Number.isInteger(qty) || qty <= 0 || qty > 2147483647) fieldErrors.qty = "Jumlah harus bilangan bulat di atas 0.";
  if (!isAdjustmentReason(reason)) fieldErrors.reason = "Pilih alasan penyesuaian.";
  if (notes.length < 5 || notes.length > 500) fieldErrors.notes = "Tulis keterangan 5–500 karakter (contoh: kemasan bocor saat dicek).";
  if (direction === "kurang" && stockBatchId !== undefined && (!Number.isInteger(stockBatchId) || stockBatchId <= 0)) {
    fieldErrors.stockBatchId = "Batch tidak valid.";
  }
  if (direction === "tambah" && (unitCost === undefined || !Number.isInteger(unitCost) || unitCost < 0 || unitCost > 2147483647)) {
    fieldErrors.unitCost = "Modal per unit harus bilangan bulat minimal 0.";
  }
  if (Object.keys(fieldErrors).length > 0) return { ok: false, message: "Periksa kembali data penyesuaian.", fieldErrors };

  let number: string;
  try {
    const adjustment = await prisma.$transaction((tx) => adjustStock(tx, {
      itemId, direction: direction as "kurang" | "tambah", qty, reason: reason as Parameters<typeof adjustStock>[1]["reason"], notes, expectedStock,
      stockBatchId: direction === "kurang" ? stockBatchId : undefined,
      unitCost: direction === "tambah" ? unitCost : undefined,
    }, { createdById: user.id }));
    number = adjustmentNumber(adjustment.id);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return { ok: false, message: error.code === "P2002" ? "Kode batch penyesuaian bentrok dengan batch lain. Coba lagi." : "Gagal menyimpan penyesuaian. Coba lagi." };
    }
    return { ok: false, message: error instanceof Error ? error.message : "Gagal menyimpan penyesuaian." };
  }
  for (const path of ["/", "/stok", `/stok/${itemId}`, "/stok/penyesuaian", "/transaksi/baru", "/laporan"]) revalidatePath(path);
  return { ok: true, message: `Penyesuaian ${number} tersimpan.` };
}

export async function toggleItemAction(formData: FormData): Promise<void> {
  await requireOwner();
  const id = Number(formData.get("id"));
  if (Number.isInteger(id) && id > 0) {
    const item = await prisma.item.findUnique({ where: { id }, select: { isActive: true } });
    if (item) {
      await prisma.item.update({ where: { id }, data: { isActive: !item.isActive } });
      revalidatePath("/stok");
    }
  }
}
