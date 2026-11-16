"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AlertCircle, Info, LoaderCircle, Plus, TriangleAlert, Undo2, X } from "lucide-react";
import { createExpenseAction, reverseExpenseAction } from "@/actions/finance";
import { initialActionState } from "@/lib/action-state";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { formatDateID, todayISO } from "@/lib/dates";
import { formatRupiah } from "@/lib/format";

function useDialog(open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close]);
}

function DialogFrame({
  onClose,
  eyebrow,
  title,
  description,
  children,
}: {
  onClose: () => void;
  eyebrow: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  useDialog(true, onClose);
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-pine/45 backdrop-blur-sm sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Tutup" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-float sm:rounded-3xl sm:p-6"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="eyebrow mb-1">{eyebrow}</div>
            <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-[10px] text-muted">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg border border-line text-muted hover:bg-[#f2eee6]"
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

function ExpenseForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createExpenseAction, initialActionState);
  const [confirmed, setConfirmed] = useState(false);
  const today = todayISO();
  const [expenseDate, setExpenseDate] = useState(today);
  const [category, setCategory] = useState("Operasional");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const waitingConfirmation = Boolean(state.warning && !confirmed);

  useEffect(() => {
    if (!state.ok) return;
    onClose();
    router.refresh();
  }, [state.ok, onClose, router]);

  return (
    <DialogFrame
      onClose={() => !pending && onClose()}
      eyebrow="Kas keluar"
      title="Catat pengeluaran"
      description="Biaya operasional akan mengurangi laba bersih."
    >
      <form action={action} className="space-y-3.5">
        <p className="flex items-start gap-2 rounded-xl border border-line bg-[#fbf9f4] px-3.5 py-3 text-[10.5px] leading-relaxed text-muted">
          <Info size={13} className="mt-0.5 shrink-0 text-pine" />
          <span>
            Untuk membeli sparepart/stok, gunakan{" "}
            <Link href="/pembelian/baru" className="font-bold text-pine underline">
              menu Pembelian
            </Link>
            . Kas keluar dan stok dicatat sekaligus di sana, jadi tidak perlu dibuat sebagai pengeluaran.
          </span>
        </p>

        {state.warning ? (
          <div className="space-y-2.5 rounded-xl border border-warning/30 bg-warning-soft px-3.5 py-3">
            <p className="flex items-start gap-2 text-[10.5px] font-semibold leading-relaxed text-warning">
              <TriangleAlert size={14} className="mt-0.5 shrink-0" />
              {state.message}
            </p>
            <Link
              href={`/pembelian/${state.warning.purchaseId}`}
              className="inline-flex text-[10px] font-extrabold text-pine underline"
            >
              Lihat pembelian PB-{String(state.warning.purchaseId).padStart(5, "0")}
            </Link>
            <label className="flex items-start gap-2 text-[10px] font-semibold text-warning">
              <input
                type="checkbox"
                name="confirmDuplicate"
                value="1"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                className="mt-0.5"
              />
              Saya sudah cek; ini biaya lain, bukan pembelian stok yang sama.
            </label>
          </div>
        ) : (
          state.message &&
          !state.ok && (
            <div className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-[10.5px] font-semibold text-danger">
              <AlertCircle size={13} className="mt-0.5 shrink-0" /> {state.message}
            </div>
          )
        )}

        <div>
          <label htmlFor="expense-date" className="label">
            Tanggal
          </label>
          <input
            id="expense-date"
            type="date"
            name="expenseDate"
            value={expenseDate}
            className="input"
            required
            onChange={(event) => {
              setExpenseDate(event.target.value);
              setConfirmed(false);
            }}
          />
        </div>
        <div>
          <label htmlFor="expense-category" className="label">
            Kategori
          </label>
          <select
            id="expense-category"
            name="category"
            className="select"
            value={category}
            required
            onChange={(event) => {
              setCategory(event.target.value);
              setConfirmed(false);
            }}
          >
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
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
              setConfirmed(false);
            }}
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
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                setConfirmed(false);
              }}
            />
          </div>
        </div>
        <button type="submit" disabled={pending || waitingConfirmation} className="btn-primary h-11 w-full">
          {pending ? (
            <>
              <LoaderCircle size={14} className="animate-spin" /> Menyimpan…
            </>
          ) : waitingConfirmation ? (
            "Centang konfirmasi dulu"
          ) : state.warning ? (
            "Simpan sebagai biaya lain"
          ) : (
            "Simpan pengeluaran"
          )}
        </button>
      </form>
    </DialogFrame>
  );
}

export function ExpenseDialog() {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSession((current) => current + 1);
          setOpen(true);
        }}
        className="btn-primary"
      >
        <Plus size={16} /> Catat pengeluaran
      </button>
      {open && <ExpenseForm key={session} onClose={() => setOpen(false)} />}
    </>
  );
}

// Pemilik membalik pengeluaran yang salah input. Pengeluaran asli tetap tercatat
// dan entri koreksi bernominal negatif dicatat hari ini.
export function ExpenseReversalDialog({
  expenseId,
  description,
  category,
  amount,
  expenseDate,
}: {
  expenseId: number;
  description: string;
  category: string;
  amount: number;
  expenseDate: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(reverseExpenseAction, initialActionState);

  useEffect(() => {
    if (!state.ok) return;
    setOpen(false);
    router.refresh();
  }, [state, router]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-[9px] font-bold text-muted underline-offset-2 hover:text-danger hover:underline"
      >
        <Undo2 size={10} /> Koreksi
      </button>
      {open && (
        <DialogFrame
          onClose={() => !pending && setOpen(false)}
          eyebrow="Koreksi pengeluaran"
          title={`Balik ${formatRupiah(amount)}?`}
          description={`${description} · ${category} · ${formatDateID(expenseDate)}`}
        >
          <form action={action} className="space-y-3.5">
            <input type="hidden" name="expenseId" value={expenseId} />
            {state.message && !state.ok && (
              <div className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-[10.5px] font-semibold text-danger">
                <AlertCircle size={13} className="mt-0.5 shrink-0" /> {state.message}
              </div>
            )}
            <p className="rounded-xl border border-line bg-[#fbf9f4] px-3.5 py-3 text-[10.5px] leading-relaxed text-muted">
              Pengeluaran asli tetap tercatat. Entri koreksi −{formatRupiah(amount)} dicatat hari ini, sehingga total
              pengeluaran dan laba kembali seperti sebelum pengeluaran ini dibuat.
            </p>
            <div>
              <label htmlFor={`expense-reverse-reason-${expenseId}`} className="label">
                Alasan koreksi
              </label>
              <input
                id={`expense-reverse-reason-${expenseId}`}
                name="reason"
                required
                minLength={3}
                maxLength={300}
                placeholder="Contoh: pembelian stok sudah tercatat di menu Pembelian"
                className="input"
              />
            </div>
            <button type="submit" disabled={pending} className="btn-danger h-11 w-full">
              {pending ? <LoaderCircle size={14} className="animate-spin" /> : <Undo2 size={14} />}
              Balik pengeluaran
            </button>
          </form>
        </DialogFrame>
      )}
    </>
  );
}