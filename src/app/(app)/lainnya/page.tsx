import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ChevronRight, LogOut, ShieldCheck, Smartphone, Wrench } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getCounts } from "@/lib/queries/finance";
import { logoutAction } from "@/actions/auth";
import { PageHeader } from "@/components/ui/page-header";
import { InstallPrompt } from "@/components/pwa-install-prompt";
import { ROLE_LABELS } from "@/lib/constants";
import { initials } from "@/lib/format";
import { cn } from "@/lib/cn";
import { navGroupsForRole } from "@/components/shell/nav-config";

const GROUP_COLORS: Record<string, string> = {
  penjualan: "bg-warning-soft text-warning",
  inventori: "bg-[#f6e8e2] text-[#a54a2d]",
  keuangan: "bg-[#f3e5cc] text-[#7a5a18]",
  laporan: "bg-[#eef1e7] text-[#4b6143]",
  sistem: "bg-[#ece3ef] text-[#62436b]",
};

export const metadata: Metadata = { title: "Lainnya" };

export default async function MorePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const counts = await getCounts();
  const params = await searchParams;

  const stats: Record<string, string> = {
    "/transaksi": "Nota servis & penjualan",
    "/piutang": `${counts.outstandingTransactions} nota terbuka`,
    "/pelanggan": `${counts.customers} pelanggan`,
    "/stok": counts.lowStock > 0 ? `${counts.lowStock} stok menipis` : `${counts.items} item aktif`,
    "/hutang": `${counts.suppliers} supplier`,
  };
  const groups = navGroupsForRole(user.role)
    .map((group) => ({ ...group, items: group.items.filter((item) => item.href !== "/") }))
    .filter((group) => group.items.length > 0);
  const menuCount = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <div className="animate-fade-up">
      <PageHeader eyebrow="Pusat kontrol" title="Lainnya" description="Semua fitur, profil, dan pengaturan dalam satu tempat." />

      {params.error === "akses-terbatas" && (
        <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-danger/15 bg-danger-soft px-4 py-3">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-danger" />
          <div>
            <p className="text-[11.5px] font-extrabold text-danger">Akses khusus pemilik</p>
            <p className="mt-0.5 text-[10px] font-medium text-danger/75">
              Halaman tersebut hanya bisa dibuka dengan akun pemilik bengkel.
            </p>
          </div>
        </div>
      )}

      <section className="relative overflow-hidden rounded-3xl bg-pine p-5 text-white sm:p-6">
        <div className="dot-grid pointer-events-none absolute inset-0 opacity-25 [mask-image:linear-gradient(115deg,black,transparent_70%)]" />
        <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full border-[30px] border-brand/20" />
        <div className="relative flex items-center gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-brand font-display text-base font-extrabold text-white">
            {initials(user.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/40">{ROLE_LABELS[user.role]} bengkel</div>
            <div className="mt-1 font-display text-xl font-extrabold tracking-[-0.03em]">{user.name}</div>
            <div className="mt-0.5 truncate text-[10.5px] font-medium text-white/40">{user.email}</div>
          </div>
          <span className="badge bg-lime/15 text-lime">
            <ShieldCheck size={11} /> Aktif
          </span>
        </div>
        <div className="relative mt-5 grid grid-cols-3 divide-x divide-white/[0.08] rounded-xl border border-white/[0.08] bg-white/[0.04] py-3">
          <div className="px-3 text-center">
            <div className="font-display text-base font-extrabold tabular">{counts.customers}</div>
            <div className="mt-0.5 text-[8.5px] font-semibold text-white/35">Pelanggan</div>
          </div>
          <div className="px-3 text-center">
            <div className="font-display text-base font-extrabold tabular">{counts.vehicles}</div>
            <div className="mt-0.5 text-[8.5px] font-semibold text-white/35">Kendaraan</div>
          </div>
          <div className="px-3 text-center">
            <div className="font-display text-base font-extrabold tabular">{counts.outstandingTransactions}</div>
            <div className="mt-0.5 text-[8.5px] font-semibold text-white/35">Piutang aktif</div>
          </div>
        </div>
      </section>

      <div className="mt-4">
        <InstallPrompt />
      </div>

      <div className="mt-4 mb-2 flex items-center justify-between px-1">
        <h2 className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-faint">Semua fitur</h2>
        <span className="text-[9px] font-semibold text-faint">{menuCount} menu</span>
      </div>
      {groups.map((group) => (
        <section key={group.id} className="mt-3" aria-labelledby={`grup-${group.id}`}>
          <h3 id={`grup-${group.id}`} className="mb-1.5 px-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-faint">
            {group.label}
          </h3>
          <div className="card overflow-hidden divide-y divide-line/70">
            {group.items.map((menu) => (
              <Link key={menu.href} href={menu.href} className="group flex items-center gap-3 px-4 py-3.5 transition hover:bg-[#faf7f1] sm:px-5">
                <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", GROUP_COLORS[group.id] ?? "bg-[#f2eee6] text-muted")}>
                  <menu.icon size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-extrabold text-ink">{menu.label}</div>
                  <div className="mt-0.5 truncate text-[10px] font-medium text-faint">{menu.description}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {stats[menu.href] && <span className="hidden text-[9px] font-bold text-faint sm:inline">{stats[menu.href]}</span>}
                  <ChevronRight size={15} className="text-faint transition group-hover:translate-x-0.5 group-hover:text-ink" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <section className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="card p-4">
          <div className="flex items-center gap-2">
            <BookOpen size={15} className="text-brand" />
            <h3 className="text-[12px] font-extrabold text-ink">Panduan singkat</h3>
          </div>
          <ol className="mt-3 space-y-2 text-[10.5px] leading-relaxed text-muted">
            <li className="flex gap-2"><span className="font-extrabold text-brand">1.</span> Buat transaksi setiap servis selesai.</li>
            <li className="flex gap-2"><span className="font-extrabold text-brand">2.</span> Catat pembayaran; sisa otomatis menjadi piutang.</li>
            <li className="flex gap-2"><span className="font-extrabold text-brand">3.</span> Cek laporan tiap akhir minggu.</li>
          </ol>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2">
            <Smartphone size={15} className="text-success" />
            <h3 className="text-[12px] font-extrabold text-ink">Tentang aplikasi</h3>
          </div>
          <div className="mt-3 space-y-1.5 text-[10.5px]">
            <div className="flex justify-between text-muted">
              <span>Versi</span>
              <span className="font-bold text-ink">1.1.0</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Mode</span>
              <span className="font-bold text-ink">Mobile-first PWA</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Penyimpanan</span>
              <span className="font-bold text-ink">PostgreSQL</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Zona waktu</span>
              <span className="font-bold text-ink">WIB (Asia/Jakarta)</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-4 card p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#f2eee6] text-muted">
            <Wrench size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[11.5px] font-extrabold text-ink">WMC 225</h3>
            <p className="mt-0.5 text-[10px] leading-relaxed text-muted">
              Aplikasi manajemen bengkel: transaksi, pendapatan, piutang, hutang, dan stok dalam satu alur.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="chip">Next.js</span>
              <span className="chip">Prisma</span>
              <span className="chip">PostgreSQL</span>
              <span className="chip">PWA</span>
              <span className="chip">Mobile-first</span>
            </div>
          </div>
        </div>
        <form action={logoutAction} className="mt-4 border-t border-line pt-3">
          <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[11px] font-extrabold text-danger transition hover:bg-danger-soft">
            <LogOut size={14} />
            Keluar dari akun
          </button>
        </form>
      </section>

      <p className="mt-5 text-center text-[9px] font-medium text-faint">
        Dibuat untuk bengkel yang ingin tumbuh lebih rapi.
      </p>
    </div>
  );
}
