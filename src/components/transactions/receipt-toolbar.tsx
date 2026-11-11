"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";

export function ReceiptToolbar({
  backHref,
  width,
  autoPrint,
  widthHrefs,
}: {
  backHref: string;
  width: 58 | 80;
  autoPrint: boolean;
  widthHrefs: Record<58 | 80, string>;
}) {
  useEffect(() => {
    if (!autoPrint) return;
    let cancelled = false;
    const run = async () => {
      try {
        await document.fonts?.ready;
      } catch {
        // abaikan, tetap cetak
      }
      if (!cancelled) window.setTimeout(() => window.print(), 150);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [autoPrint]);

  return (
    <div className="no-print mx-auto mb-4 flex w-full max-w-[360px] flex-wrap items-center justify-between gap-2">
      <Link href={backHref} className="btn-secondary">
        <ArrowLeft size={15} /> Kembali
      </Link>
      <div className="flex items-center gap-2">
        <div className="flex overflow-hidden rounded-xl border border-line text-[11px] font-bold">
          {([58, 80] as const).map((option) => (
            <Link
              key={option}
              href={widthHrefs[option]}
              replace
              className={option === width ? "bg-ink px-2.5 py-2 text-white" : "bg-surface px-2.5 py-2 text-muted"}
            >
              {option}mm
            </Link>
          ))}
        </div>
        <button type="button" onClick={() => window.print()} className="btn-primary">
          <Printer size={15} /> Cetak
        </button>
      </div>
    </div>
  );
}
