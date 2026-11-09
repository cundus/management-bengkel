import type { Metadata } from "next";
import { CalendarDays, Database, LogOut, MapPin, Phone, ShieldCheck, Store } from "lucide-react";
import { requireOwner } from "@/lib/auth";
import { getSettings } from "@/lib/queries/finance";
import { logoutAction } from "@/actions/auth";
import { PageHeader } from "@/components/ui/page-header";
import { SettingsForm } from "@/components/settings/settings-form";
import { ROLE_LABELS } from "@/lib/constants";

export const metadata: Metadata = { title: "Pengaturan" };

export default async function SettingsPage() {
  const user = await requireOwner();
  const settings = await getSettings();

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="Konfigurasi"
        title="Pengaturan"
        description="Identitas bengkel, informasi nota, dan detail akun yang digunakan di aplikasi."
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <section className="card p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-2.5 border-b border-line pb-4">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-soft text-brand">
              <Store size={16} />
            </span>
            <div>
              <h2 className="section-title">Profil bengkel</h2>
              <p className="text-[10px] text-faint">Digunakan pada nota dan aplikasi.</p>
            </div>
          </div>
          <SettingsForm settings={settings} />
        </section>

        <aside className="space-y-4">
          <section className="card p-5">
            <div className="eyebrow">Akun aktif</div>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-pine font-display text-[12px] font-extrabold text-lime">
                {user.name
                  .split(" ")
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")}
              </div>
              <div className="min-w-0">
                <div className="truncate text-[12px] font-extrabold text-ink">{user.name}</div>
                <div className="mt-0.5 text-[9.5px] font-semibold text-faint">{ROLE_LABELS[user.role]}</div>
                <div className="mt-0.5 truncate text-[9px] text-faint">{user.email}</div>
              </div>
            </div>
            <div className="mt-4 space-y-2 border-t border-line pt-3 text-[10px]">
              <div className="flex items-center gap-2 text-muted">
                <Phone size={11} className="text-faint" /> {settings.workshop_phone || "—"}
              </div>
              <div className="flex items-start gap-2 text-muted">
                <MapPin size={11} className="mt-0.5 shrink-0 text-faint" /> {settings.workshop_address || "—"}
              </div>
              <div className="flex items-center gap-2 text-muted">
                <CalendarDays size={11} className="text-faint" /> Zona waktu WIB
              </div>
            </div>
            <form action={logoutAction} className="mt-4">
              <button type="submit" className="btn-secondary w-full text-[11px]">
                <LogOut size={13} /> Keluar dari akun
              </button>
            </form>
          </section>

          <section className="card p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck size={15} className="text-success" />
              <h2 className="text-[12px] font-extrabold text-ink">Akses & keamanan</h2>
            </div>
            <div className="mt-3 space-y-2 text-[10px] leading-relaxed text-muted">
              <p>
                <span className="font-bold text-ink">Pemilik</span> dapat mengelola pengeluaran, hutang, stok, pengaturan,
                dan membatalkan transaksi.
              </p>
              <p>
                <span className="font-bold text-ink">Kasir</span> dapat membuat transaksi, mencatat pembayaran, dan
                mengelola pelanggan.
              </p>
            </div>
            <div className="mt-3 rounded-lg bg-[#faf7f1] px-3 py-2 text-[9px] font-medium text-faint">
              Sesi berakhir otomatis setelah 7 hari. Kata sandi disimpan dalam bentuk hash.
            </div>
          </section>

          <section className="card p-5">
            <div className="flex items-center gap-2">
              <Database size={15} className="text-muted" />
              <h2 className="text-[12px] font-extrabold text-ink">Data aplikasi</h2>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-muted">
              Data tersimpan di PostgreSQL melalui Prisma. Backup dan retensi dikelola oleh provider database
              (Vercel Postgres, Neon, Supabase, atau PostgreSQL mandiri).
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
