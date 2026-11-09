"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Banknote, X } from "lucide-react";
import { PaymentForm } from "./payment-form";
import { formatRupiah } from "@/lib/format";

export function QuickPayButton({
  transactionId,
  customerName,
  invoiceNo,
  remaining,
}: {
  transactionId: string;
  customerName: string;
  invoiceNo: string;
  remaining: number;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary btn-sm shrink-0">
        <Banknote size={13} />
        Bayar
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-pine/45 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Tutup"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-pay-title"
            className="relative z-10 max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-float sm:rounded-3xl sm:p-6"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="eyebrow mb-1">Pembayaran piutang</div>
                <h2 id="quick-pay-title" className="font-display text-lg font-extrabold tracking-tight text-ink">
                  {customerName}
                </h2>
                <p className="mt-0.5 font-mono text-[10px] font-semibold text-faint">{invoiceNo}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex size-8 items-center justify-center rounded-lg border border-line text-muted transition hover:bg-[#f2eee6]"
                aria-label="Tutup dialog"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mb-4 flex items-center justify-between rounded-xl bg-brand-soft px-3.5 py-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-dark">Sisa tagihan</span>
              <span className="font-display text-lg font-extrabold tracking-tight text-brand-dark tabular">
                {formatRupiah(remaining)}
              </span>
            </div>

            {done ? (
              <div className="rounded-xl bg-success-soft px-4 py-6 text-center">
                <div className="text-[12px] font-extrabold text-success">Pembayaran tercatat</div>
                <p className="mt-1 text-[10px] text-success/70">Data piutang akan diperbarui.</p>
                <button type="button" onClick={() => setOpen(false)} className="btn-secondary mt-4 btn-sm">
                  Tutup
                </button>
              </div>
            ) : (
              <PaymentForm
                transactionId={transactionId}
                remaining={remaining}
                onSuccess={() => {
                  setDone(true);
                  setTimeout(() => setOpen(false), 900);
                }}
              />
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
