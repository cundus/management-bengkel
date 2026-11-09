import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpen,
  ChevronRight,
  HandCoins,
  Landmark,
  LogOut,
  PackageSearch,
  Settings2,
  ShieldCheck,
  Smartphone,
  Users,
  WalletCards,
  Wrench,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getCounts } from "@/lib/queries/finance";
import { logoutAction } from "@/actions/auth";
import { PageHeader } from "@/components/ui/page-header";
import { InstallPrompt } from "@/components/pwa-install-prompt";
import { ROLE_LABELS } from "@/lib/constants";
import { initials } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Lainnya" };

export default async function MorePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const counts = await getCounts();
  const params = await searchParams;
  const isOwner = user.role === "owner";

  const menus = [
    {
      href: "/pelanggan",
      label: "Pelanggan & kendaraan",
      description: "Profil, riwayat servis, dan kendaraan",
      icon: Users,
      stat: `${counts.customers} pelanggan`,
      color: "bg-[#eef1e7] text-[#4b6143]",
      show: true,
    },
    {
      href: "/stok",
      label: "Stok & jasa",
      description: "Katalog harga, HPP, dan persediaan",
      icon: PackageSearch,
      stat: counts.lowStock > 0 ? `${counts.lowStock} stok menipis` : `${counts.items} item aktif`,
      color: "bg-[#f6e8e2] text-[#a54a2d]",
      show: true,
    },
    {
      href: "/piutang",
      label: "Piutang pelanggan",
      description: "Tagihan yang belum dibayar",
      icon: HandCoins,
      stat: `${counts.outstandingTransactions} nota terbuka`,
      color: "bg-warning-soft text-warning",
      show: true,
    },
    {
      href: "/pengeluaran",
      label: "Pengeluaran",
      description: "Biaya operasional bengkel",
      icon: WalletCards,
      stat: "Khusus pemilik",
      color: "bg-[#f3e5cc] text-[#7a5a18]",
      show: isOwner,
    },
    {
      href: "/hutang",
      label: "Hutang supplier",
      description: "Kewajiban usaha dan pembayarannya",
      icon: Landmark,
      stat: `${counts.suppliers} supplier`,
      color: "bg-[#e1e9f3] text-[#365575]",
      show: isOwner,
    },
    {
      href: "/pengaturan",
      label: "Pengaturan bengkel",
      description: "Profil, nota, dan preferensi aplikasi",
      icon: Settings2,
      stat: "Konfigurasi",
      color: "bg-[#ece3ef] text-[#62436b]",
      show: isOwner,
    },
    {
      href: "/akun",
      label: "Manajemen akun",
      description: "Akun pemilik, kasir, dan kata sandi",
      icon: ShieldCheck,
      stat: "Khusus pemilik",
      color: "bg-[#ece3ef] text-[#62436b]",
      show: isOwner,
    },
  ].filter((menu) => menu.show);

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

      <section className="mt-4">
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-faint">Semua fitur</h2>
          <span className="text-[9px] font-semibold text-faint">{menus.length} menu</span>
        </div>
        <div className="card overflow-hidden divide-y divide-line/70">
          {menus.map((menu) => (
            <Link key={menu.href} href={menu.href} className="group flex items-center gap-3 px-4 py-3.5 transition hover:bg-[#faf7f1] sm:px-5">
              <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", menu.color)}>
                <menu.icon size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-extrabold text-ink">{menu.label}</div>
                <div className="mt-0.5 truncate text-[10px] font-medium text-faint">{menu.description}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="hidden text-[9px] font-bold text-faint sm:inline">{menu.stat}</span>
                <ChevronRight size={15} className="text-faint transition group-hover:translate-x-0.5 group-hover:text-ink" />
              </div>
            </Link>
          ))}
        </div>
      </section>

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
