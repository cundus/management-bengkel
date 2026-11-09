"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS, type PaymentMethod } from "@/lib/constants";
import { isValidISODate, parseDateOnly, todayISO } from "@/lib/dates";
import { prisma } from "@/lib/db";
import type { ActionState } from "@/lib/action-state";

function rupiah(value: FormDataEntryValue | null): number {
  return Number(String(value ?? "").replace(/[^\d]/g, "")) || 0;
}

function text(value: FormDataEntryValue | null, max = 300): string {
  return String(value ?? "").trim().slice(0, max);
}

function isMethod(value: string): value is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value);
}

export async function createExpenseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireOwner();
  const expenseDate = text(formData.get("expenseDate")) || todayISO();
  const category = text(formData.get("category"), 50);
  const description = text(formData.get("description"), 300);
  const amount = rupiah(formData.get("amount"));
  const fieldErrors: Record<string, string> = {};

  if (!isValidISODate(expenseDate)) fieldErrors.expenseDate = "Tanggal tidak valid.";
  if (!(EXPENSE_CATEGORIES as readonly string[]).includes(category)) fieldErrors.category = "Pilih kategori.";
  if (description.length < 3) fieldErrors.description = "Keterangan minimal 3 karakter.";
  if (amount <= 0) fieldErrors.amount = "Nominal harus lebih dari 0.";

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Periksa data pengeluaran.", fieldErrors };
  }

  await prisma.expense.create({
    data: {
      expenseDate: parseDateOnly(expenseDate),
      category,
      description,
      amount,
      createdById: user.id,
    },
  });

  revalidatePath("/pengeluaran");
  revalidatePath("/laporan");
  revalidatePath("/");
  return { ok: true, message: "Pengeluaran berhasil dicatat." };
}

export async function createSupplierAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireOwner();
  const name = text(formData.get("name"), 120);
  const contactPerson = text(formData.get("contactPerson"), 80) || null;
  const phone = text(formData.get("phone"), 30) || null;
  const notes = text(formData.get("notes"), 300) || null;
  if (name.length < 2) return { ok: false, message: "Nama supplier minimal 2 karakter." };

  try {
    await prisma.supplier.create({ data: { name, contactPerson, phone, notes } });
  } catch {
    return { ok: false, message: "Gagal menyimpan supplier." };
  }

  revalidatePath("/hutang");
  return { ok: true, message: "Supplier berhasil ditambahkan." };
}

export async function createPayableAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireOwner();
  const supplierId = Number(formData.get("supplierId"));
  const referenceNo = text(formData.get("referenceNo"), 60) || null;
  const description = text(formData.get("description"), 300);
  const amount = rupiah(formData.get("amount"));
  const businessDate = text(formData.get("businessDate")) || todayISO();
  const dueDateRaw = text(formData.get("dueDate"));
  const dueDate = dueDateRaw || null;

  const fieldErrors: Record<string, string> = {};
  if (!Number.isInteger(supplierId) || supplierId <= 0) fieldErrors.supplierId = "Pilih supplier.";
  if (description.length < 3) fieldErrors.description = "Keterangan minimal 3 karakter.";
  if (amount <= 0) fieldErrors.amount = "Nominal harus lebih dari 0.";
  if (!isValidISODate(businessDate)) fieldErrors.businessDate = "Tanggal tidak valid.";
  if (dueDate && !isValidISODate(dueDate)) fieldErrors.dueDate = "Jatuh tempo tidak valid.";

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Periksa data hutang.", fieldErrors };
  }

  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) return { ok: false, message: "Supplier tidak ditemukan." };

  await prisma.payable.create({
    data: {
      supplierId,
      referenceNo,
      description,
      amount,
      businessDate: parseDateOnly(businessDate),
      dueDate: dueDate ? parseDateOnly(dueDate) : null,
      createdById: user.id,
    },
  });

  revalidatePath("/hutang");
  revalidatePath("/laporan");
  return { ok: true, message: "Hutang supplier berhasil dicatat." };
}

export async function recordPayablePaymentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireOwner();
  const payableId = Number(formData.get("payableId"));
  const amount = rupiah(formData.get("amount"));
  const method = text(formData.get("method"));
  const notes = text(formData.get("notes"), 300) || null;

  if (!Number.isInteger(payableId) || payableId <= 0) return { ok: false, message: "Hutang tidak valid." };
  if (amount <= 0) return { ok: false, message: "Nominal harus lebih dari 0." };
  if (!isMethod(method)) return { ok: false, message: "Metode pembayaran tidak valid." };

  const payable = await prisma.payable.findUnique({
    where: { id: payableId },
    include: { payments: { select: { amount: true } } },
  });
  if (!payable) return { ok: false, message: "Hutang tidak ditemukan." };
  const paid = payable.payments.reduce((sum, payment) => sum + payment.amount, 0);
  const remaining = payable.amount - paid;
  if (remaining <= 0) return { ok: false, message: "Hutang ini sudah lunas." };
  if (amount > remaining) return { ok: false, message: "Nominal melebihi sisa hutang." };

  await prisma.payablePayment.create({
    data: {
      payableId,
      amount,
      method,
      notes,
      businessDate: parseDateOnly(todayISO()),
      paidById: user.id,
    },
  });

  revalidatePath("/hutang");
  revalidatePath("/laporan");
  revalidatePath("/");
  return { ok: true, message: "Pembayaran hutang berhasil dicatat." };
}

export async function updateSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireOwner();
  const entries: [string, string][] = [
    ["workshop_name", text(formData.get("workshopName"), 100)],
    ["workshop_phone", text(formData.get("workshopPhone"), 40)],
    ["workshop_address", text(formData.get("workshopAddress"), 200)],
    ["workshop_tagline", text(formData.get("workshopTagline"), 160)],
    ["invoice_note", text(formData.get("invoiceNote"), 300)],
  ];
  if (!entries[0][1]) return { ok: false, message: "Nama bengkel wajib diisi." };

  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      }),
    ),
  );

  revalidatePath("/pengaturan");
  revalidatePath("/");
  return { ok: true, message: "Pengaturan bengkel disimpan." };
}
