"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { createSession, destroySession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { ActionState } from "@/lib/action-state";

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { ok: false, message: "Email dan kata sandi wajib diisi." };
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Selalu jalankan compare agar timing tidak membocorkan apakah email terdaftar.
  const hash = user?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin";
  const valid = await bcrypt.compare(password, hash);

  if (!user || !valid) {
    return { ok: false, message: "Email atau kata sandi salah. Coba lagi." };
  }

  await createSession({ id: user.id, name: user.name, email: user.email, role: user.role });
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
