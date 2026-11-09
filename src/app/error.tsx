"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { BrandMark } from "@/components/brand";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-5">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-danger-soft text-danger">
          <AlertTriangle size={28} />
        </div>
        <div className="eyebrow mb-2">Terjadi kendala</div>
        <h1 className="font-display text-3xl font-extrabold tracking-[-0.04em] text-ink">Halaman gagal dimuat</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Data kamu tetap aman. Coba muat ulang halaman ini. Jika masih gagal, kembali ke beranda dan coba lagi nanti.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button type="button" onClick={reset} className="btn-primary">
            <RotateCcw size={15} /> Coba lagi
          </button>
          <Link href="/" className="btn-secondary">
            <BrandMark size={18} /> Beranda
          </Link>
        </div>
        {error.digest && <p className="mt-4 font-mono text-[9px] text-faint">Kode: {error.digest}</p>}
      </div>
    </main>
  );
}
