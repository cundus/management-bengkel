"use server";

import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { ActionState } from "@/lib/action-state";
import { usernameSchema } from "@/lib/username";

const accountSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(100),
  email: z.email("Email tidak valid.").max(254),
  username: usernameSchema.nullable(),
  role: z.enum(["owner", "kasir"]),
});

export async function saveAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireOwner();
  const idRaw = String(formData.get("id") ?? "");
  const id = idRaw ? Number(idRaw) : null;
  if (id !== null && (!Number.isSafeInteger(id) || id <= 0)) {
    return { ok: false, message: "Akun tidak valid." };
  }
  const parsed = accountSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    username: String(formData.get("username") ?? "").trim() || null,
    role: String(formData.get("role") ?? ""),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const password = String(formData.get("password") ?? "");
  if ((!id || password) && (password.length < 8 || Buffer.byteLength(password, "utf8") > 72)) {
    return { ok: false, message: "Kata sandi minimal 8 karakter dan maksimal 72 byte." };
  }
  const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;

  try {
    const result = await prisma.$transaction(async (tx): Promise<ActionState> => {
      // Periksa ulang di transaksi agar perubahan role bersamaan tetap aman.
      const currentActor = await tx.user.findUnique({ where: { id: actor.id } });
      if (currentActor?.role !== "owner") return { ok: false, message: "Akses khusus pemilik." };
      if (id) {
        const target = await tx.user.findUnique({ where: { id } });
        if (!target) return { ok: false, message: "Akun tidak ditemukan." };
        if (target.role === "owner" && parsed.data.role !== "owner") {
          if (await tx.user.count({ where: { role: "owner" } }) <= 1) {
            return { ok: false, message: "Pemilik terakhir tidak dapat diubah menjadi kasir." };
          }
        }
        await tx.user.update({ where: { id }, data: { ...parsed.data, passwordHash } });
      } else {
        await tx.user.create({ data: { ...parsed.data, passwordHash: passwordHash! } });
      }
      return { ok: true, message: id ? "Akun berhasil diperbarui." : "Akun berhasil ditambahkan." };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (result.ok) revalidatePath("/", "layout");
    return result;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        const target = error.meta?.target;
        const usernameConflict = Array.isArray(target) && target.includes("username");
        return { ok: false, message: usernameConflict ? "Username sudah digunakan akun lain." : "Email sudah digunakan akun lain." };
      }
      if (error.code === "P2034") return { ok: false, message: "Data berubah saat disimpan. Silakan coba lagi." };
    }
    return { ok: false, message: "Gagal menyimpan akun. Silakan coba lagi." };
  }
}
