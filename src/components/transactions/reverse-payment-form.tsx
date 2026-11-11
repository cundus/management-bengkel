"use client";

import { useActionState, useEffect, useState } from "react";
import { LoaderCircle, Undo2 } from "lucide-react";
import { reversePaymentAction } from "@/actions/transactions";
import { initialActionState } from "@/lib/action-state";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/constants";
import { formatDateID } from "@/lib/dates";
import { formatRupiah } from "@/lib/format";
import { Dialog, ErrorText } from "./void-form";

// Pemilik membalik pembayaran yang salah input (nominal/metode). Pembayaran asli tetap tercatat.
export function ReversePaymentButton({
  transactionId,
  paymentId,
  amount,
  method,
  businessDate,
}: {
  transactionId: string;
  paymentId: number;
  amount: number;
  method: PaymentMethod;
  businessDate: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(reversePaymentAction, initialActionState);

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-[9px] font-bold text-muted underline-offset-2 hover:text-danger hover:underline"
      >
        <Undo2 size={10} /> Koreksi
      </button>
      <Dialog
        open={open}
        pending={pending}
        onClose={() => setOpen(false)}
        titleId={`reverse-payment-${paymentId}`}
        title="Balik pembayaran?"
        subtitle={`${formatRupiah(amount)} · ${PAYMENT_METHOD_LABELS[method]} · ${formatDateID(businessDate)}`}
      >
        <ul className="mb-4 space-y-1.5 rounded-xl border border-line bg-[#fbf9f4] px-3.5 py-3 text-[10.5px] leading-relaxed text-muted">
          <li>• Pembayaran asli tetap tercatat; entri koreksi −{formatRupiah(amount)} dicatat hari ini.</li>
          <li>• Sisa tagihan nota bertambah {formatRupiah(amount)} dan kas {PAYMENT_METHOD_LABELS[method]} hari ini berkurang.</li>
          <li>• Bila nominal atau metode salah, catat ulang pembayaran yang benar setelah ini.</li>
          <li>• Koreksi tidak bisa dibatalkan.</li>
        </ul>
        <form action={action}>
          <input type="hidden" name="transactionId" value={transactionId} />
          <input type="hidden" name="paymentId" value={paymentId} />
          <label htmlFor={`reverse-reason-${paymentId}`} className="label">
            Alasan koreksi
          </label>
          <input
            id={`reverse-reason-${paymentId}`}
            name="reason"
            required
            autoFocus
            maxLength={300}
            placeholder="Contoh: salah metode, seharusnya transfer"
            className="input h-11 text-[13px]"
          />
          <ErrorText message={!state.ok ? state.message : undefined} />
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <button type="button" onClick={() => setOpen(false)} disabled={pending} className="btn-secondary">
              Kembali
            </button>
            <button type="submit" disabled={pending} className="btn-danger">
              {pending ? <LoaderCircle size={14} className="animate-spin" /> : <Undo2 size={14} />}
              Balik pembayaran
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
