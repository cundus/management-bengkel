import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/constants";
import { PageHeader } from "@/components/ui/page-header";
import { AccountForm } from "@/components/accounts/account-form";

export const metadata: Metadata = { title: "Manajemen akun" };

export default async function AccountsPage() {
  const actor = await requireOwner();
  const accounts = await prisma.user.findMany({
    select: { id: true, name: true, email: true, username: true, role: true },
    orderBy: { id: "asc" },
  });
  const owners = accounts.filter((account) => account.role === "owner").length;

  return (
    <div className="animate-fade-up">
      <PageHeader eyebrow="Akses & keamanan" title="Manajemen akun" description="Kelola akun pemilik dan kasir, hak akses, serta kata sandi." />
      <div className="grid items-start gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <section className="card p-5">
          <h2 className="section-title mb-4">Tambah akun</h2>
          <AccountForm />
        </section>
        <section className="card p-5">
          <h2 className="section-title mb-2">Daftar akun ({accounts.length})</h2>
          <p className="mb-4 text-xs text-muted">Pemilik memiliki akses penuh. Kasir mengikuti pembatasan akses operasional yang berlaku.</p>
          <div className="divide-y divide-line">
            {accounts.map((account) => (
              <details key={account.id} className="py-4">
                <summary className="cursor-pointer break-words text-sm font-bold">
                  {account.name}{account.id === actor.id ? " (Anda)" : ""}
                  <span className="ml-2 badge-neutral">{ROLE_LABELS[account.role]}</span>
                  <span className="mt-1 block text-xs font-normal text-muted">{account.email}</span>
                  <span className="mt-1 block text-xs font-normal text-muted">Username: {account.username ?? "Belum diatur"}</span>
                </summary>
                <div className="mt-4">
                  <AccountForm key={`${account.name}-${account.email}-${account.username}-${account.role}`} account={account} lastOwner={account.role === "owner" && owners === 1} />
                </div>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
