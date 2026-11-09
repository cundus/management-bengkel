"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ITEM_CATEGORIES, type ItemCategory } from "@/lib/constants";
import type { ActionState } from "@/lib/action-state";

function rupiah(value: FormDataEntryValue | null): number {
  return Number(String(value ?? "").replace(/[^\d]/g, "")) || 0;
}

export async function saveItemAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireOwner();
  const id = Number(formData.get("id") ?? 0);
  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim().toUpperCase();
  const category = String(formData.get("category") ?? "") as ItemCategory;
  const unit = String(formData.get("unit") ?? "pcs").trim() || "pcs";
  const price = rupiah(formData.get("price"));
  const cost = rupiah(formData.get("cost"));
  const stock = Number(String(formData.get("stock") ?? "0").replace(/\D/g, "")) || 0;
  const minStock = Number(String(formData.get("minStock") ?? "0").replace(/\D/g, "")) || 0;

  const fieldErrors: Record<string, string> = {};
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
      await prisma.item.update({
        where: { id },
        data: {
          name,
          sku,
          category,
          unit,
          price,
          cost,
          stock: category === "sparepart" ? stock : 0,
          minStock,
        },
      });
    } else {
      await prisma.item.create({
        data: {
          sku,
          name,
          category,
          unit,
          price,
          cost,
          stock: category === "sparepart" ? stock : 0,
          minStock,
          isActive: true,
        },
      });
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, message: "SKU sudah dipakai item lain." };
    }
    return { ok: false, message: "Gagal menyimpan item." };
  }

  revalidatePath("/stok");
  revalidatePath("/transaksi/baru");
  return { ok: true, message: id > 0 ? "Item diperbarui." : "Item baru ditambahkan." };
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
