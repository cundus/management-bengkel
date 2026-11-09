import Link from "next/link";
import { ArrowLeft, Wrench } from "lucide-react";
import { BrandMark } from "@/components/brand";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-5">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-pine">
          <BrandMark size={56} />
        </div>
        <div className="eyebrow mb-2">Error 404</div>
        <h1 className="font-display text-3xl font-extrabold tracking-[-0.04em] text-ink">Halaman tidak ditemukan</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Sepertinya halaman ini sudah pindah atau alamatnya salah ketik. Kembali ke dashboard untuk melanjutkan.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link href="/" className="btn-primary">
            <ArrowLeft size={15} /> Kembali ke beranda
          </Link>
          <Link href="/transaksi/baru" className="btn-secondary">
            <Wrench size={15} /> Transaksi baru
          </Link>
        </div>
      </div>
    </main>
  );
}
