"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { createSession, destroySession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { ActionState } from "@/lib/action-state";

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const identifier = String(formData.get("identifier") ?? formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!identifier || !password) {
    return { ok: false, message: "Username/email dan kata sandi wajib diisi." };
  }

  const user = await prisma.user.findUnique({
    where: identifier.includes("@") ? { email: identifier } : { username: identifier },
  });

  // Pesan gagal sama untuk akun yang tidak ditemukan dan kata sandi salah.
  const hash = user?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin";
  const valid = await bcrypt.compare(password, hash);

  if (!user || !valid) {
    return { ok: false, message: "Username/email atau kata sandi salah. Coba lagi." };
  }

  await createSession({ id: user.id, name: user.name, email: user.email, role: user.role }, user.passwordHash);
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
