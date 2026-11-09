"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, LoaderCircle, Wallet } from "lucide-react";
import { recordPaymentAction } from "@/actions/transactions";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/constants";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/cn";

export function PaymentForm({
  transactionId,
  remaining,
  defaultMethod = "tunai",
  onSuccess,
}: {
  transactionId: string;
  remaining: number;
  defaultMethod?: PaymentMethod;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState(String(remaining));
  const [method, setMethod] = useState<PaymentMethod>(defaultMethod);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const nominal = Number(amount.replace(/\D/g, "")) || 0;
    startTransition(async () => {
      const result = await recordPaymentAction(transactionId, nominal, method, notes);
      if (!result.ok) {
        setMessage({ type: "error", text: result.message });
        return;
      }
      setMessage({ type: "success", text: result.message });
      setNotes("");
      router.refresh();
      onSuccess?.();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3.5">
      {message && (
        <div
          className={cn(
            "flex items-start gap-2 rounded-xl px-3 py-2.5 text-[11px] font-semibold",
            message.type === "error" ? "bg-danger-soft text-danger" : "bg-success-soft text-success",
          )}
        >
          {message.type === "error" ? (
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
          ) : (
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
          )}
          {message.text}
        </div>
      )}

      <div>
        <label htmlFor="payment-amount" className="label">
          Nominal diterima
        </label>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] font-bold text-faint">Rp</span>
          <input
            id="payment-amount"
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))}
            className="input h-12 pl-10 text-lg font-extrabold tabular"
          />
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setAmount(String(remaining))}
            className="rounded-md bg-[#f2eee6] px-2 py-1 text-[9.5px] font-extrabold text-muted hover:text-ink"
          >
            Lunasi {formatRupiah(remaining)}
          </button>
          <button
            type="button"
            onClick={() => setAmount(String(Math.round(remaining / 2 / 1000) * 1000))}
            className="rounded-md bg-[#f2eee6] px-2 py-1 text-[9.5px] font-extrabold text-muted hover:text-ink"
          >
            50%
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {PAYMENT_METHODS.map((paymentMethod) => (
          <button
            key={paymentMethod}
            type="button"
            onClick={() => setMethod(paymentMethod)}
            className={cn(
              "rounded-lg border py-2 text-[10.5px] font-extrabold transition",
              method === paymentMethod
                ? "border-pine bg-pine text-white"
                : "border-line bg-white text-muted hover:border-line-strong",
            )}
          >
            {PAYMENT_METHOD_LABELS[paymentMethod]}
          </button>
        ))}
      </div>

      <div>
        <label htmlFor="payment-notes" className="label">
          Catatan <span className="font-medium text-faint">(opsional)</span>
        </label>
        <input
          id="payment-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Contoh: pelunasan via transfer BCA"
          className="input h-10 text-[12px]"
        />
      </div>

      <button type="submit" disabled={pending} className="btn-primary h-11 w-full text-[12px]">
        {pending ? (
          <>
            <LoaderCircle size={15} className="animate-spin" /> Mencatat pembayaran…
          </>
        ) : (
          <>
            <Wallet size={15} /> Catat pembayaran
          </>
        )}
      </button>
    </form>
  );
}
