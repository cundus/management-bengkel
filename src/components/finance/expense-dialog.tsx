"use client";

import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AlertCircle, LoaderCircle, Plus, X } from "lucide-react";
import { createExpenseAction } from "@/actions/finance";
import { initialActionState } from "@/lib/action-state";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { todayISO } from "@/lib/dates";

export function ExpenseDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createExpenseAction, initialActionState);
  const today = todayISO();

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

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary">
        <Plus size={16} /> Catat pengeluaran
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-pine/45 backdrop-blur-sm sm:items-center sm:p-4">
          <button type="button" className="absolute inset-0 cursor-default" aria-label="Tutup" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="expense-dialog-title"
            className="relative z-10 max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-float sm:rounded-3xl sm:p-6"
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <div className="eyebrow mb-1">Kas keluar</div>
                <h2 id="expense-dialog-title" className="font-display text-lg font-extrabold tracking-tight text-ink">
                  Catat pengeluaran
                </h2>
                <p className="mt-0.5 text-[10px] text-muted">Biaya operasional akan mengurangi laba bersih.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex size-8 items-center justify-center rounded-lg border border-line text-muted hover:bg-[#f2eee6]"
                aria-label="Tutup dialog"
              >
                <X size={16} />
              </button>
            </div>

            <form action={action} className="space-y-3.5">
              {state.message && !state.ok && (
                <div className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-[10.5px] font-semibold text-danger">
                  <AlertCircle size={13} className="mt-0.5 shrink-0" /> {state.message}
                </div>
              )}
              <div>
                <label htmlFor="expense-date" className="label">
                  Tanggal
                </label>
                <input
                  id="expense-date"
                  type="date"
                  name="expenseDate"
                  defaultValue={today}
                  className="input"
                  required
                />
              </div>
              <div>
                <label htmlFor="expense-category" className="label">
                  Kategori
                </label>
                <select id="expense-category" name="category" className="select" defaultValue="Operasional" required>
                  {EXPENSE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="expense-description" className="label">
                  Keterangan
                </label>
                <input
                  id="expense-description"
                  name="description"
                  required
                  placeholder="Contoh: Bayar listrik bulan November"
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="expense-amount" className="label">
                  Nominal
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[12px] font-bold text-faint">Rp</span>
                  <input
                    id="expense-amount"
                    name="amount"
                    inputMode="numeric"
                    required
                    placeholder="0"
                    className="input h-12 pl-10 text-lg font-extrabold tabular"
                  />
                </div>
              </div>
              <button type="submit" disabled={pending} className="btn-primary h-11 w-full">
                {pending ? (
                  <>
                    <LoaderCircle size={14} className="animate-spin" /> Menyimpan…
                  </>
                ) : (
                  "Simpan pengeluaran"
                )}
              </button>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
