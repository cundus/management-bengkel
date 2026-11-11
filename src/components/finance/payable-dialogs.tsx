"use client";

import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AlertCircle, LoaderCircle, Plus, Store, Undo2, Wallet, X } from "lucide-react";
import {
  createPayableAction,
  createSupplierAction,
  recordPayablePaymentAction,
  reversePayablePaymentAction,
} from "@/actions/finance";
import { initialActionState } from "@/lib/action-state";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/constants";
import { formatDateID, todayISO } from "@/lib/dates";
import { formatRupiah } from "@/lib/format";
import type { Supplier } from "@/lib/types";

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
  open,
  onClose,
  eyebrow,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  eyebrow: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  useDialog(open, onClose);
  if (!open) return null;
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

export function SupplierDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createSupplierAction, initialActionState);

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary">
        <Store size={15} /> Supplier baru
      </button>
      <DialogFrame
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Pemasok"
        title="Tambah supplier"
        description="Simpan pemasok untuk memudahkan pencatatan hutang usaha."
      >
        <form action={action} className="space-y-3.5">
          {state.message && !state.ok && (
            <div className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-[10.5px] font-semibold text-danger">
              <AlertCircle size={13} className="mt-0.5 shrink-0" /> {state.message}
            </div>
          )}
          <div>
            <label htmlFor="supplier-name" className="label">
              Nama supplier
            </label>
            <input id="supplier-name" name="name" required placeholder="PT Sumber Motor Jaya" className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="supplier-contact" className="label">
                Kontak
              </label>
              <input id="supplier-contact" name="contactPerson" placeholder="Hendra" className="input" />
            </div>
            <div>
              <label htmlFor="supplier-phone" className="label">
                Telepon
              </label>
              <input id="supplier-phone" name="phone" inputMode="tel" placeholder="0812…" className="input" />
            </div>
          </div>
          <div>
            <label htmlFor="supplier-notes" className="label">
              Catatan
            </label>
            <input id="supplier-notes" name="notes" placeholder="Supplier sparepart utama" className="input" />
          </div>
          <button type="submit" disabled={pending} className="btn-primary h-11 w-full">
            {pending ? <LoaderCircle size={14} className="animate-spin" /> : <Plus size={14} />}
            Simpan supplier
          </button>
        </form>
      </DialogFrame>
    </>
  );
}

export function PayableDialog({ suppliers }: { suppliers: Supplier[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createPayableAction, initialActionState);
  const today = todayISO();

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary">
        <Plus size={16} /> Tagihan lain
      </button>
      <DialogFrame
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Hutang usaha"
        title="Catat hutang supplier"
        description="Untuk tagihan di luar penerimaan barang. Pembelian sparepart dicatat dari menu Pembelian agar stok dan hutang terhubung."
      >
        {suppliers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-[10.5px] text-muted">
            Tambahkan supplier terlebih dahulu sebelum mencatat hutang.
          </div>
        ) : (
          <form action={action} className="space-y-3.5">
            {state.message && !state.ok && (
              <div className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-[10.5px] font-semibold text-danger">
                <AlertCircle size={13} className="mt-0.5 shrink-0" /> {state.message}
              </div>
            )}
            <div>
              <label htmlFor="payable-supplier" className="label">
                Supplier
              </label>
              <select id="payable-supplier" name="supplierId" required className="select" defaultValue="">
                <option value="" disabled>
                  Pilih supplier…
                </option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="payable-ref" className="label">
                  No. referensi
                </label>
                <input id="payable-ref" name="referenceNo" placeholder="SMJ-8841" className="input" />
              </div>
              <div>
                <label htmlFor="payable-date" className="label">
                  Tanggal
                </label>
                <input id="payable-date" type="date" name="businessDate" defaultValue={today} className="input" />
              </div>
            </div>
            <div>
              <label htmlFor="payable-description" className="label">
                Keterangan
              </label>
              <input
                id="payable-description"
                name="description"
                required
                placeholder="Pembelian kampas rem & busi"
                className="input"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="payable-amount" className="label">
                  Nominal
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-faint">Rp</span>
                  <input
                    id="payable-amount"
                    name="amount"
                    required
                    inputMode="numeric"
                    placeholder="0"
                    className="input pl-8 font-bold tabular"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="payable-due" className="label">
                  Jatuh tempo
                </label>
                <input id="payable-due" type="date" name="dueDate" className="input" />
              </div>
            </div>
            <button type="submit" disabled={pending} className="btn-primary h-11 w-full">
              {pending ? <LoaderCircle size={14} className="animate-spin" /> : <Plus size={14} />}
              Simpan hutang
            </button>
          </form>
        )}
      </DialogFrame>
    </>
  );
}

export function PayablePaymentDialog({
  payableId,
  supplierName,
  remaining,
}: {
  payableId: number;
  supplierName: string;
  remaining: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(recordPayablePaymentAction, initialActionState);

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-dark btn-sm shrink-0">
        <Wallet size={12} /> Bayar
      </button>
      <DialogFrame
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Pembayaran hutang"
        title={supplierName}
        description={`Sisa hutang ${formatRupiah(remaining)}`}
      >
        <form action={action} className="space-y-3.5">
          <input type="hidden" name="payableId" value={payableId} />
          {state.message && !state.ok && (
            <div className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-[10.5px] font-semibold text-danger">
              <AlertCircle size={13} className="mt-0.5 shrink-0" /> {state.message}
            </div>
          )}
          <div>
            <label htmlFor="payable-payment-amount" className="label">
              Nominal dibayar
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[12px] font-bold text-faint">Rp</span>
              <input
                id="payable-payment-amount"
                name="amount"
                required
                inputMode="numeric"
                defaultValue={remaining}
                className="input h-12 pl-10 text-lg font-extrabold tabular"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                const input = document.getElementById("payable-payment-amount") as HTMLInputElement | null;
                if (input) input.value = String(remaining);
              }}
              className="mt-2 rounded-md bg-[#f2eee6] px-2 py-1 text-[9.5px] font-extrabold text-muted hover:text-ink"
            >
              Lunasi penuh
            </button>
          </div>
          <div>
            <label htmlFor="payable-payment-method" className="label">
              Metode
            </label>
            <select id="payable-payment-method" name="method" className="select" defaultValue="transfer">
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {PAYMENT_METHOD_LABELS[method]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="payable-payment-notes" className="label">
              Catatan
            </label>
            <input id="payable-payment-notes" name="notes" placeholder="Pembayaran termin…" className="input" />
          </div>
          <button type="submit" disabled={pending} className="btn-primary h-11 w-full">
            {pending ? <LoaderCircle size={14} className="animate-spin" /> : <Wallet size={14} />}
            Catat pembayaran
          </button>
        </form>
      </DialogFrame>
    </>
  );
}

// Pemilik membalik pembayaran hutang yang salah input. Pembayaran asli tetap tercatat.
export function ReversePayablePaymentDialog({
  paymentId,
  amount,
  method,
  businessDate,
}: {
  paymentId: number;
  amount: number;
  method: PaymentMethod;
  businessDate: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(reversePayablePaymentAction, initialActionState);

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      router.refresh();
    }
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
      <DialogFrame
        open={open}
        onClose={() => !pending && setOpen(false)}
        eyebrow="Koreksi pembayaran hutang"
        title={`Balik ${formatRupiah(amount)}?`}
        description={`${PAYMENT_METHOD_LABELS[method]} · ${formatDateID(businessDate)}`}
      >
        <form action={action} className="space-y-3.5">
          <input type="hidden" name="paymentId" value={paymentId} />
          {state.message && !state.ok && (
            <div className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-[10.5px] font-semibold text-danger">
              <AlertCircle size={13} className="mt-0.5 shrink-0" /> {state.message}
            </div>
          )}
          <p className="rounded-xl border border-line bg-[#fbf9f4] px-3.5 py-3 text-[10.5px] leading-relaxed text-muted">
            Pembayaran asli tetap tercatat. Entri koreksi −{formatRupiah(amount)} dicatat hari ini, sisa hutang bertambah,
            dan kas keluar hari ini berkurang. Catat ulang pembayaran yang benar bila perlu.
          </p>
          <div>
            <label htmlFor={`payable-reverse-reason-${paymentId}`} className="label">
              Alasan koreksi
            </label>
            <input
              id={`payable-reverse-reason-${paymentId}`}
              name="reason"
              required
              maxLength={300}
              placeholder="Contoh: nominal salah ketik"
              className="input"
            />
          </div>
          <button type="submit" disabled={pending} className="btn-danger h-11 w-full">
            {pending ? <LoaderCircle size={14} className="animate-spin" /> : <Undo2 size={14} />}
            Balik pembayaran
          </button>
        </form>
      </DialogFrame>
    </>
  );
}
