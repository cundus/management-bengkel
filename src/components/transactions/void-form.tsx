"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Ban, Check, LoaderCircle, Send, X } from "lucide-react";
import { rejectVoidRequestAction, requestVoidAction, voidTransactionAction } from "@/actions/transactions";
import { initialActionState } from "@/lib/action-state";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/constants";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/cn";

function Dialog({
  open,
  pending,
  onClose,
  titleId,
  title,
  subtitle,
  tone = "danger",
  children,
}: {
  open: boolean;
  pending: boolean;
  onClose: () => void;
  titleId: string;
  title: string;
  subtitle: string;
  tone?: "danger" | "neutral";
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, pending, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-pine/45 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Tutup"
        onClick={() => !pending && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-float sm:rounded-3xl sm:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl",
                tone === "danger" ? "bg-danger-soft text-danger" : "bg-[#f2eee6] text-muted",
              )}
            >
              <AlertTriangle size={18} />
            </span>
            <div>
              <h2 id={titleId} className="font-display text-lg font-extrabold tracking-tight text-ink">
                {title}
              </h2>
              <p className="mt-0.5 font-mono text-[10px] font-semibold text-faint">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="flex size-8 items-center justify-center rounded-lg border border-line text-muted transition hover:bg-[#f2eee6]"
            aria-label="Tutup dialog"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function ErrorText({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-2 text-[11px] font-semibold text-danger">
      {message}
    </p>
  );
}

// Pemilik membatalkan nota, sekaligus mencatat refund bila nota sudah dibayar.
// Dipakai juga untuk menyetujui pengajuan kasir (defaultReason terisi).
export function VoidTransactionButton({
  transactionId,
  invoiceNo,
  total,
  paid,
  hasSparepart,
  defaultReason = "",
  approving = false,
}: {
  transactionId: string;
  invoiceNo: string;
  total: number;
  paid: number;
  hasSparepart: boolean;
  defaultReason?: string;
  approving?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [refund, setRefund] = useState(String(paid));
  const [method, setMethod] = useState<PaymentMethod>("tunai");
  const [state, action, pending] = useActionState(voidTransactionAction, initialActionState);
  const refundAmount = Math.min(paid, Number(refund) || 0);
  const retained = paid - refundAmount;

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  return (
    <>
      {approving ? (
        <button type="button" onClick={() => setOpen(true)} className="btn-danger btn-sm">
          <Check size={13} /> Setujui & batalkan
        </button>
      ) : (
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
      )}

      <Dialog
        open={open}
        pending={pending}
        onClose={() => setOpen(false)}
        titleId="void-title"
        title="Batalkan transaksi?"
        subtitle={`${invoiceNo} · ${formatRupiah(total)}`}
      >
        <ul className="mb-4 space-y-1.5 rounded-xl border border-line bg-[#fbf9f4] px-3.5 py-3 text-[10.5px] leading-relaxed text-muted">
          <li>• Nota tidak dihitung lagi di omset, laba, dan piutang.</li>
          {hasSparepart && <li>• Stok sparepart di nota ini dikembalikan ke batch asalnya.</li>}
          {paid > 0 && <li>• Pembayaran lama tetap tercatat; refund dicatat sebagai kas keluar hari ini.</li>}
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
            defaultValue={defaultReason}
            placeholder="Contoh: salah input item"
            className="input h-11 text-[13px]"
          />

          {paid > 0 && (
            <div className="mt-4 space-y-3 rounded-xl border border-line px-3.5 py-3">
              <div className="flex justify-between text-[11px] text-muted">
                <span>Sudah dibayar pelanggan</span>
                <span className="font-extrabold text-ink tabular">{formatRupiah(paid)}</span>
              </div>
              <div>
                <label htmlFor="refund-amount" className="label">
                  Uang dikembalikan
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] font-bold text-faint">Rp</span>
                  <input
                    id="refund-amount"
                    name="refundAmount"
                    inputMode="numeric"
                    value={refund}
                    onChange={(event) => setRefund(event.target.value.replace(/\D/g, ""))}
                    className="input h-11 pl-10 text-[14px] font-extrabold tabular"
                  />
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setRefund(String(paid))}
                    className="rounded-md bg-[#f2eee6] px-2 py-1 text-[9.5px] font-extrabold text-muted hover:text-ink"
                  >
                    Semua
                  </button>
                  <button
                    type="button"
                    onClick={() => setRefund("0")}
                    className="rounded-md bg-[#f2eee6] px-2 py-1 text-[9.5px] font-extrabold text-muted hover:text-ink"
                  >
                    Tidak ada refund
                  </button>
                </div>
              </div>
              {refundAmount > 0 && (
                <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Metode refund">
                  <input type="hidden" name="refundMethod" value={method} />
                  {PAYMENT_METHODS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={method === option}
                      onClick={() => setMethod(option)}
                      className={cn(
                        "rounded-lg border py-2 text-[10.5px] font-extrabold transition",
                        method === option ? "border-pine bg-pine text-white" : "border-line bg-white text-muted hover:border-line-strong",
                      )}
                    >
                      {PAYMENT_METHOD_LABELS[option]}
                    </button>
                  ))}
                </div>
              )}
              {Number(refund) > paid && (
                <p className="text-[10px] font-semibold text-danger">Refund maksimal {formatRupiah(paid)}.</p>
              )}
              {retained > 0 && (
                <p className="text-[10px] leading-relaxed text-muted">
                  {formatRupiah(retained)} tidak dikembalikan dan dicatat sebagai{" "}
                  <span className="font-bold text-ink">pendapatan pembatalan</span>.
                </p>
              )}
            </div>
          )}

          <ErrorText message={!state.ok ? state.message : undefined} />
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <button type="button" onClick={() => setOpen(false)} disabled={pending} className="btn-secondary">
              Kembali
            </button>
            <button type="submit" disabled={pending || Number(refund) > paid} className="btn-danger">
              {pending ? <LoaderCircle size={14} className="animate-spin" /> : <Ban size={14} />}
              Batalkan nota
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

// Kasir mengajukan pembatalan ke pemilik.
export function RequestVoidButton({ transactionId, invoiceNo, total }: { transactionId: string; invoiceNo: string; total: number }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(requestVoidAction, initialActionState);

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ajukan pembatalan"
        title="Ajukan pembatalan"
        className="btn-secondary text-danger hover:border-danger/40 hover:text-danger"
      >
        <Ban size={15} />
        <span className="hidden sm:inline">Ajukan batal</span>
      </button>
      <Dialog
        open={open}
        pending={pending}
        onClose={() => setOpen(false)}
        titleId="request-void-title"
        title="Ajukan pembatalan?"
        subtitle={`${invoiceNo} · ${formatRupiah(total)}`}
      >
        <p className="mb-4 rounded-xl border border-line bg-[#fbf9f4] px-3.5 py-3 text-[10.5px] leading-relaxed text-muted">
          Pemilik akan meninjau pengajuan ini. Nota tetap aktif sampai pemilik menyetujui, dan refund diputuskan oleh
          pemilik.
        </p>
        <form action={action}>
          <input type="hidden" name="transactionId" value={transactionId} />
          <label htmlFor="request-void-reason" className="label">
            Alasan pembatalan
          </label>
          <input
            id="request-void-reason"
            name="reason"
            required
            autoFocus
            maxLength={300}
            placeholder="Contoh: pelanggan batal servis"
            className="input h-11 text-[13px]"
          />
          <ErrorText message={!state.ok ? state.message : undefined} />
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <button type="button" onClick={() => setOpen(false)} disabled={pending} className="btn-secondary">
              Kembali
            </button>
            <button type="submit" disabled={pending} className="btn-danger">
              {pending ? <LoaderCircle size={14} className="animate-spin" /> : <Send size={14} />}
              Kirim pengajuan
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function RejectVoidRequestButton({ requestId, invoiceNo }: { requestId: number; invoiceNo: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(rejectVoidRequestAction, initialActionState);

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary btn-sm">
        <X size={13} /> Tolak
      </button>
      <Dialog
        open={open}
        pending={pending}
        onClose={() => setOpen(false)}
        titleId="reject-void-title"
        title="Tolak pengajuan?"
        subtitle={invoiceNo}
        tone="neutral"
      >
        <form action={action}>
          <input type="hidden" name="requestId" value={requestId} />
          <label htmlFor="reject-void-note" className="label">
            Catatan untuk kasir <span className="font-medium text-faint">(opsional)</span>
          </label>
          <input id="reject-void-note" name="note" autoFocus maxLength={300} className="input h-11 text-[13px]" />
          <ErrorText message={!state.ok ? state.message : undefined} />
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <button type="button" onClick={() => setOpen(false)} disabled={pending} className="btn-secondary">
              Kembali
            </button>
            <button type="submit" disabled={pending} className="btn-dark">
              {pending ? <LoaderCircle size={14} className="animate-spin" /> : <X size={14} />}
              Tolak pengajuan
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
