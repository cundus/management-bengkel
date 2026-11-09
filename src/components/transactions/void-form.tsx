"use client";

import { useActionState } from "react";
import { AlertTriangle, LoaderCircle } from "lucide-react";
import { voidTransactionAction } from "@/actions/transactions";
import { initialActionState } from "@/lib/action-state";

export function VoidForm({ transactionId }: { transactionId: string }) {
  const [state, action, pending] = useActionState(voidTransactionAction, initialActionState);

  return (
    <details className="group rounded-xl border border-line bg-[#fbf9f4]">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-3 text-[10.5px] font-extrabold text-muted transition hover:text-danger">
        <AlertTriangle size={13} />
        Batalkan transaksi
        <span className="ml-auto text-[9px] font-semibold text-faint group-open:hidden">Khusus pemilik</span>
      </summary>
      <form action={action} className="border-t border-line p-3.5">
        <input type="hidden" name="transactionId" value={transactionId} />
        <label htmlFor="void-reason" className="mb-1.5 block text-[10px] font-bold text-muted">
          Alasan pembatalan
        </label>
        <input
          id="void-reason"
          name="reason"
          required
          placeholder="Contoh: salah input item"
          className="input h-9 text-[11px]"
        />
        {state.message && (
          <p className={`mt-2 text-[10px] font-semibold ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p>
        )}
        <button type="submit" disabled={pending} className="btn-danger mt-2.5 w-full btn-sm">
          {pending ? <LoaderCircle size={12} className="animate-spin" /> : <AlertTriangle size={12} />}
          Konfirmasi pembatalan
        </button>
      </form>
    </details>
  );
}
