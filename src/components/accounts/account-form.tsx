"use client";

import { useActionState, useId } from "react";
import { saveAccountAction } from "@/actions/accounts";
import { initialActionState } from "@/lib/action-state";
import { ROLE_LABELS, type UserRole } from "@/lib/constants";

type Account = { id: number; name: string; email: string; username: string | null; role: UserRole };

export function AccountForm({ account, lastOwner = false }: { account?: Account; lastOwner?: boolean }) {
  const prefix = useId();
  const [state, action, pending] = useActionState(saveAccountAction, initialActionState);

  return (
    <form action={action} className="space-y-3">
      {account && <input type="hidden" name="id" value={account.id} />}
      {state.message && (
        <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm text-success" : "text-sm text-danger"}>
          {state.message}
        </p>
      )}
      <div>
        <label htmlFor={`${prefix}-name`} className="label">Nama</label>
        <input id={`${prefix}-name`} name="name" defaultValue={account?.name} required minLength={2} maxLength={100} autoComplete="off" className="input" />
      </div>
      <div>
        <label htmlFor={`${prefix}-email`} className="label">Email</label>
        <input id={`${prefix}-email`} name="email" type="email" defaultValue={account?.email} required maxLength={254} autoComplete="off" className="input" />
      </div>
      <div>
        <label htmlFor={`${prefix}-username`} className="label">Username (opsional)</label>
        <input id={`${prefix}-username`} name="username" defaultValue={account?.username ?? ""} minLength={3} maxLength={30} pattern={"[A-Za-z0-9][A-Za-z0-9._\\-]{2,29}"} autoComplete="off" autoCapitalize="none" spellCheck={false} className="input" aria-describedby={`${prefix}-username-hint`} />
        <p id={`${prefix}-username-hint`} className="mt-1 text-xs text-muted">3–30 karakter, diawali huruf atau angka. Boleh memakai titik, garis bawah, dan tanda hubung. Huruf besar/kecil dianggap sama.</p>
      </div>
      <div>
        <label htmlFor={`${prefix}-role`} className="label">Role</label>
        <select id={`${prefix}-role`} name="role" defaultValue={account?.role ?? "kasir"} className="select" required aria-describedby={lastOwner ? `${prefix}-owner-hint` : undefined}>
          {(["kasir", "owner"] as const).map((role) => (
            <option key={role} value={role} disabled={lastOwner && role === "kasir"}>{ROLE_LABELS[role]}</option>
          ))}
        </select>
        {lastOwner && <p id={`${prefix}-owner-hint`} className="mt-1 text-xs text-muted">Minimal satu akun pemilik harus tersedia.</p>}
      </div>
      <div>
        <label htmlFor={`${prefix}-password`} className="label">{account ? "Kata sandi baru (opsional)" : "Kata sandi"}</label>
        <input id={`${prefix}-password`} name="password" type="password" autoComplete="new-password" required={!account} minLength={8} maxLength={72} className="input" aria-describedby={`${prefix}-password-hint`} />
        <p id={`${prefix}-password-hint`} className="mt-1 text-xs text-muted">
          {account ? "Kosongkan untuk mempertahankan kata sandi. Menggantinya mengakhiri sesi akun ini." : "Minimal 8 karakter. Akun dapat langsung digunakan untuk login."}
        </p>
      </div>
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "Menyimpan…" : account ? "Simpan perubahan" : "Tambah akun"}
      </button>
    </form>
  );
}
