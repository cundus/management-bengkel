"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { ActionState } from "@/lib/action-state";

function optionalText(value: FormDataEntryValue | null, max = 300): string | null {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, max) : null;
}

export async function createCustomerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const phone = optionalText(formData.get("phone"), 30);
  const address = optionalText(formData.get("address"), 300);
  const notes = optionalText(formData.get("notes"), 500);

  const plateNumber = String(formData.get("plateNumber") ?? "").trim().toUpperCase();
  const brand = String(formData.get("brand") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const yearRaw = String(formData.get("year") ?? "").trim();
  const year = yearRaw ? Number(yearRaw) : null;
  const color = optionalText(formData.get("color"), 30);
  const odometerRaw = String(formData.get("odometer") ?? "").replace(/\D/g, "");
  const odometer = odometerRaw ? Number(odometerRaw) : null;
  const next = String(formData.get("next") ?? "");

  const fieldErrors: Record<string, string> = {};
  if (name.length < 2) fieldErrors.name = "Nama minimal 2 karakter.";
  if (!plateNumber) fieldErrors.plateNumber = "Nomor polisi wajib diisi.";
  if (!brand) fieldErrors.brand = "Merek kendaraan wajib diisi.";
  if (!model) fieldErrors.model = "Model kendaraan wajib diisi.";
  if (year != null && (!Number.isInteger(year) || year < 1950 || year > 2100)) {
    fieldErrors.year = "Tahun tidak valid.";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Lengkapi data pelanggan dan kendaraan.", fieldErrors };
  }

  try {
    const customer = await prisma.customer.create({
      data: {
        name,
        phone,
        address,
        notes,
        vehicles: {
          create: {
            plateNumber,
            brand,
            model,
            year,
            color,
            odometer,
          },
        },
      },
    });

    revalidatePath("/pelanggan");
    revalidatePath("/transaksi/baru");
    const redirectTo = next === "/transaksi/baru" ? `/transaksi/baru?customerId=${customer.id}` : `/pelanggan/${customer.id}`;
    return { ok: true, message: "Pelanggan berhasil ditambahkan.", redirectTo };
  } catch {
    return { ok: false, message: "Gagal menyimpan pelanggan. Coba lagi." };
  }
}

export async function addVehicleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const customerId = Number(formData.get("customerId"));
  const plateNumber = String(formData.get("plateNumber") ?? "").trim().toUpperCase();
  const brand = String(formData.get("brand") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const yearRaw = String(formData.get("year") ?? "").trim();
  const year = yearRaw ? Number(yearRaw) : null;
  const color = optionalText(formData.get("color"), 30);
  const odometerRaw = String(formData.get("odometer") ?? "").replace(/\D/g, "");
  const odometer = odometerRaw ? Number(odometerRaw) : null;

  if (!Number.isInteger(customerId) || !plateNumber || !brand || !model) {
    return { ok: false, message: "Nomor polisi, merek, dan model wajib diisi." };
  }
  if (year != null && (!Number.isInteger(year) || year < 1950 || year > 2100)) {
    return { ok: false, message: "Tahun kendaraan tidak valid." };
  }

  try {
    await prisma.vehicle.create({
      data: { customerId, plateNumber, brand, model, year, color, odometer },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return { ok: false, message: "Pelanggan tidak ditemukan." };
    }
    return { ok: false, message: "Gagal menambahkan kendaraan." };
  }

  revalidatePath(`/pelanggan/${customerId}`);
  revalidatePath("/pelanggan");
  return { ok: true, message: "Kendaraan berhasil ditambahkan." };
}
