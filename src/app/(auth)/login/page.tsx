import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckCircle2, ShieldCheck, TrendingUp, Wrench } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";
import { BrandLogo, BrandMark } from "@/components/brand";

export const metadata: Metadata = {
  title: "Masuk",
  description: "Masuk ke dashboard manajemen bengkel WMC 225.",
};

const FEATURES = [
  "Setiap servis tercatat jadi nota digital",
  "Piutang dan jatuh tempo terpantau otomatis",
  "Laba, kas masuk, dan pengeluaran dalam satu laporan",
];

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <main className="min-h-dvh bg-canvas lg:grid lg:grid-cols-[1.08fr_0.92fr]">
      <section className="relative isolate overflow-hidden bg-pine px-6 pb-10 pt-6 text-white sm:px-10 lg:flex lg:min-h-dvh lg:flex-col lg:justify-between lg:px-14 lg:py-10">
        <div className="dot-grid pointer-events-none absolute inset-0 opacity-30 [mask-image:linear-gradient(to_bottom,black_20%,transparent_85%)]" />
        <div className="pointer-events-none absolute -right-40 -top-32 size-[34rem] rounded-full border-[70px] border-brand/20" />
        <div className="pointer-events-none absolute -bottom-28 -left-24 size-80 rounded-full bg-brand/10 blur-3xl" />
        <div className="relative z-10 flex items-center justify-between">
          <BrandLogo light />
          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/55 sm:flex">
            <span className="size-1.5 rounded-full bg-lime" />
            Mobile-first
          </div>
        </div>

        <div className="relative z-10 mt-14 max-w-xl lg:mt-0">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-lime/20 bg-lime/10 px-3 py-1.5 text-[11px] font-bold text-lime">
            <Wrench size={13} />
            Manajemen bengkel tanpa buku catatan
          </div>
          <h1 className="font-display text-[2.6rem] font-extrabold leading-[1.04] tracking-[-0.055em] text-balance sm:text-6xl">
            Bengkel rapi.
            <br />
            <span className="text-brand">Kas jelas.</span>
            <br />
            Piutang aman.
          </h1>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-white/55 sm:text-[15px]">
            Catat setiap servis, terima pembayaran, dan pantau siapa yang masih berhutang — dari ponsel, langsung di
            bengkel.
          </p>

          <ul className="mt-7 space-y-3">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-3 text-[13px] font-semibold text-white/75">
                <CheckCircle2 size={17} className="shrink-0 text-lime" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 mt-12 hidden items-end justify-between lg:flex">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {["BS", "SW", "JK"].map((initial, index) => (
                <div
                  key={initial}
                  className="flex size-8 items-center justify-center rounded-full border-2 border-pine text-[9px] font-extrabold"
                  style={{
                    background: ["#D8F28A", "#F05A28", "#4A6154"][index],
                    color: index === 0 ? "#17231D" : "#fff",
                  }}
                >
                  {initial}
                </div>
              ))}
            </div>
            <p className="text-[11px] leading-tight text-white/40">
              Dibuat untuk bengkel kecil
              <br />
              yang ingin naik kelas.
            </p>
          </div>
          <div className="text-right text-[10px] font-bold uppercase tracking-[0.2em] text-white/25">
            WMC 225 / 2026
          </div>
        </div>
      </section>

      <section className="relative flex items-center justify-center px-5 py-9 sm:px-10 lg:py-14">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <BrandMark size={40} />
            <span className="badge bg-white text-muted shadow-sm">
              <ShieldCheck size={12} />
              Akses aman
            </span>
          </div>

          <div className="mb-7">
            <div className="eyebrow mb-2 flex items-center gap-2">
              <span className="h-px w-6 bg-brand" />
              Portal bengkel
            </div>
            <h2 className="font-display text-[2rem] font-extrabold leading-tight tracking-[-0.045em] text-ink sm:text-[2.4rem]">
              Selamat datang
              <br />
              kembali.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Masuk untuk melihat kondisi bengkel hari ini dan melanjutkan pekerjaan.
            </p>
          </div>

          <LoginForm />

          <div className="mt-6 grid grid-cols-3 gap-2 text-center">
            {[
              { icon: Wrench, label: "Nota servis" },
              { icon: TrendingUp, label: "Laporan laba" },
              { icon: ShieldCheck, label: "Data aman" },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-line bg-white/50 px-2 py-3">
                <item.icon size={16} className="mx-auto mb-1.5 text-brand" />
                <div className="text-[10px] font-bold text-muted">{item.label}</div>
              </div>
            ))}
          </div>

          <p className="mt-7 text-center text-[10px] leading-relaxed text-faint">
            WMC 225 menyimpan data secara aman di database bengkel Anda.
            <br />
            Data pelanggan tersimpan di database bengkel Anda.
          </p>
        </div>
      </section>
    </main>
  );
}
