"use client";

import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Ban, LoaderCircle, X } from "lucide-react";
import { voidTransactionAction } from "@/actions/transactions";
import { initialActionState } from "@/lib/action-state";
import { formatRupiah } from "@/lib/format";

export function VoidTransactionButton({
  transactionId,
  invoiceNo,
  total,
  hasSparepart,
}: {
  transactionId: string;
  invoiceNo: string;
  total: number;
  hasSparepart: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(voidTransactionAction, initialActionState);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, pending]);

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Batalkan transaksi"
        title="Batalkan transaksi"
        className="btn-secondary text-danger hover:border-danger/40 hover:text-danger"
      >
        <Ban size={15} />
        <span className="hidden sm:inline">Batalkan</span>
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[70] flex items-end justify-center bg-pine/45 p-0 backdrop-blur-sm sm:items-center sm:p-4">
            <button
              type="button"
              className="absolute inset-0 cursor-default"
              aria-label="Tutup"
              onClick={() => !pending && setOpen(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="void-title"
              className="relative z-10 max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-float sm:rounded-3xl sm:p-6"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-danger-soft text-danger">
                    <AlertTriangle size={18} />
                  </span>
                  <div>
                    <h2 id="void-title" className="font-display text-lg font-extrabold tracking-tight text-ink">
                      Batalkan transaksi?
                    </h2>
                    <p className="mt-0.5 font-mono text-[10px] font-semibold text-faint">
                      {invoiceNo} · {formatRupiah(total)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="flex size-8 items-center justify-center rounded-lg border border-line text-muted transition hover:bg-[#f2eee6]"
                  aria-label="Tutup dialog"
                >
                  <X size={16} />
                </button>
              </div>

              <ul className="mb-4 space-y-1.5 rounded-xl border border-line bg-[#fbf9f4] px-3.5 py-3 text-[10.5px] leading-relaxed text-muted">
                <li>• Nota tidak dihitung lagi di omset, laba, dan piutang.</li>
                {hasSparepart && <li>• Stok sparepart di nota ini dikembalikan.</li>}
                <li>• Nota tetap tersimpan dengan status dibatalkan dan tidak bisa diaktifkan lagi.</li>
              </ul>

              <form action={action}>
                <input type="hidden" name="transactionId" value={transactionId} />
                <label htmlFor="void-reason" className="label">
                  Alasan pembatalan
                </label>
                <input
                  id="void-reason"
                  name="reason"
                  required
                  autoFocus
                  maxLength={300}
                  placeholder="Contoh: salah input item"
                  className="input h-11 text-[13px]"
                />
                {state.message && !state.ok && (
                  <p role="alert" className="mt-2 text-[11px] font-semibold text-danger">
                    {state.message}
                  </p>
                )}
                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  <button type="button" onClick={() => setOpen(false)} disabled={pending} className="btn-secondary">
                    Kembali
                  </button>
                  <button type="submit" disabled={pending} className="btn-danger">
                    {pending ? <LoaderCircle size={14} className="animate-spin" /> : <Ban size={14} />}
                    Batalkan nota
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
