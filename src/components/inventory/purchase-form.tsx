"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, TriangleAlert } from "lucide-react";
import { createPurchaseAction, type PurchaseWarning } from "@/actions/purchases";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/constants";
import { formatRupiah } from "@/lib/format";
import type { Supplier } from "@/lib/types";

type Part = { id: number; name: string; sku: string; cost: number; unit: string };
type Line = { key: number; itemId: string; code: string; quantity: string; unitCost: string };
const blankLine = (key: number): Line => ({ key, itemId: "", code: "", quantity: "1", unitCost: "" });

export function PurchaseForm({ suppliers, items, today, requestId }: {
  suppliers: Supplier[]; items: Part[]; today: string; requestId: string;
}) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([blankLine(0)]);
  const [payment, setPayment] = useState("tempo");
  const [partial, setPartial] = useState("");
  const [message, setMessage] = useState("");
  const [requestIdValue, setRequestIdValue] = useState(requestId);
  const [duplicateWarning, setDuplicateWarning] = useState<PurchaseWarning | null>(null);
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);
  const [pending, startTransition] = useTransition();
  const total = lines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unitCost), 0);
  const payNow = payment === "lunas" ? total : payment === "sebagian" ? Number(partial) : 0;
  const resetDuplicate = () => {
    setDuplicateWarning(null);
    setDuplicateConfirmed(false);
    setMessage("");
  };
  const update = (key: number, patch: Partial<Line>) => {
    resetDuplicate();
    setLines((current) => current.map((line) => line.key === key ? { ...line, ...patch } : line));
  };

  if (!suppliers.length || !items.length) return (
    <div className="card space-y-3 p-5 text-sm text-muted">
      <p>Tambahkan supplier dan sparepart aktif sebelum mencatat pembelian.</p>
      <Link href="/hutang" className="btn-secondary">Kelola supplier</Link>{" "}<Link href="/stok" className="btn-secondary">Kelola barang</Link>
    </div>
  );

  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      setMessage("");
      startTransition(async () => {
        try {
          const result = await createPurchaseAction({
            requestId: requestIdValue, supplierId: Number(form.get("supplierId")), referenceNo: String(form.get("referenceNo") ?? ""),
            businessDate: String(form.get("businessDate")), dueDate: payNow < total ? String(form.get("dueDate")) : null,
            notes: String(form.get("notes") ?? ""), payNow, method: String(form.get("method")) as PaymentMethod,
            confirmDuplicate: duplicateConfirmed,
            lines: lines.map((line) => ({ itemId: Number(line.itemId), code: line.code, quantity: Number(line.quantity), unitCost: Number(line.unitCost) })),
          });
          if (result.ok) {
            setRequestIdValue(crypto.randomUUID());
            router.push(`/pembelian/${result.id}?baru=1`);
            router.refresh();
          } else if (result.warning) {
            setDuplicateWarning(result.warning);
            setDuplicateConfirmed(false);
            setMessage(result.message);
          } else {
            resetDuplicate();
            setMessage(result.message);
          }
        } catch {
          resetDuplicate();
          setMessage("Koneksi terganggu. Coba simpan kembali; pembelian yang sama tidak akan digandakan.");
        }
      });
    }} className="space-y-5">
      {duplicateWarning ? (
        <div className="space-y-2.5 rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm">
          <p role="alert" className="flex items-start gap-2 text-[11px] font-semibold leading-relaxed text-warning">
            <TriangleAlert size={15} className="mt-0.5 shrink-0" /> {message}
          </p>
          <Link
            href="/pengeluaran"
            className="inline-flex text-[10px] font-extrabold text-pine underline"
          >
            Koreksi pengeluaran #{duplicateWarning.expenseId} di menu Pengeluaran
          </Link>
          <label className="flex items-start gap-2 text-[10px] font-semibold text-warning">
            <input
              type="checkbox"
              checked={duplicateConfirmed}
              onChange={(event) => setDuplicateConfirmed(event.target.checked)}
              className="mt-0.5"
            />
            Saya sudah koreksi pengeluaran tersebut, atau ini transaksi berbeda.
          </label>
        </div>
      ) : (
        message && <p role="alert" className="rounded-xl bg-danger-soft p-4 text-sm text-danger">{message}</p>
      )}
      <fieldset disabled={pending} className="space-y-5">
        <section className="card grid gap-4 p-5 sm:grid-cols-2">
          <div><label htmlFor="purchase-supplier" className="label">Supplier</label>
            <select id="purchase-supplier" name="supplierId" required defaultValue="" className="select">
              <option value="" disabled>Pilih supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select></div>
          <div><label htmlFor="purchase-reference" className="label">Nomor nota supplier (opsional)</label>
            <input id="purchase-reference" name="referenceNo" maxLength={80} className="input" placeholder="Nomor faktur / nota pembelian" /></div>
          <div><label htmlFor="purchase-date" className="label">Tanggal barang diterima</label>
            <input id="purchase-date" name="businessDate" type="date" required defaultValue={today} max={today} className="input" onChange={resetDuplicate} /></div>
          <div><label htmlFor="purchase-notes" className="label">Catatan (opsional)</label>
            <input id="purchase-notes" name="notes" maxLength={500} className="input" /></div>
        </section>

        <section className="card space-y-4 p-5">
          <h2 className="font-display text-lg font-extrabold">Barang diterima</h2>
          {lines.map((line, index) => (
            <div key={line.key} className="grid gap-3 rounded-xl border border-line p-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="sm:col-span-2 xl:col-span-1"><label htmlFor={`part-${line.key}`} className="label">Barang {index + 1}</label>
                <select id={`part-${line.key}`} required value={line.itemId} className="select" onChange={(event) => {
                  const part = items.find((item) => item.id === Number(event.target.value));
                  update(line.key, { itemId: event.target.value, unitCost: String(part?.cost ?? 0) });
                }}>
                  <option value="" disabled>Pilih sparepart</option>{items.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.sku}</option>)}
                </select></div>
              <div><label htmlFor={`lot-${line.key}`} className="label">Kode batch / lot {index + 1}</label>
                <input id={`lot-${line.key}`} required maxLength={80} value={line.code} onChange={(event) => update(line.key, { code: event.target.value })} className="input uppercase" placeholder="Contoh: LOT-20261109-01" /></div>
              <div><label htmlFor={`qty-${line.key}`} className="label">Jumlah {index + 1}</label>
                <input id={`qty-${line.key}`} required type="number" min={1} max={2147483647} step={1} value={line.quantity} onChange={(event) => update(line.key, { quantity: event.target.value })} className="input" /></div>
              <div><label htmlFor={`cost-${line.key}`} className="label">Modal per unit {index + 1} (Rp)</label>
                <input id={`cost-${line.key}`} required type="number" min={0} max={2147483647} step={1} value={line.unitCost} onChange={(event) => update(line.key, { unitCost: event.target.value })} className="input" /></div>
              <div className="flex items-center justify-between text-xs sm:col-span-2 xl:col-span-4">
                <span className="font-bold">Subtotal {formatRupiah(Number(line.quantity) * Number(line.unitCost))}</span>
                {lines.length > 1 && <button type="button" aria-label={`Hapus barang ${index + 1}`} onClick={() => setLines((current) => current.filter((row) => row.key !== line.key))} className="btn-ghost text-danger"><Trash2 size={14} /> Hapus</button>}
              </div>
            </div>
          ))}
          <button type="button" disabled={lines.length >= 100} className="btn-secondary" onClick={() => setLines((current) => [...current, blankLine(Math.max(...current.map((line) => line.key)) + 1)])}><Plus size={15} /> Tambah barang</button>
        </section>

        <section className="card space-y-4 p-5">
          <h2 className="font-display text-lg font-extrabold">Pembayaran</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="purchase-payment" className="label">Cara pembayaran</label>
              <select id="purchase-payment" value={payment} onChange={(event) => setPayment(event.target.value)} className="select">
                <option value="tempo">Tempo / belum dibayar</option><option value="sebagian">Bayar sebagian</option><option value="lunas">Lunas</option>
              </select></div>
            <div><label htmlFor="purchase-method" className="label">Metode pembayaran</label>
              <select id="purchase-method" name="method" defaultValue="transfer" className="select">{PAYMENT_METHODS.map((method) => <option key={method} value={method}>{PAYMENT_METHOD_LABELS[method]}</option>)}</select></div>
            {payment === "sebagian" && <div><label htmlFor="purchase-pay-now" className="label">Dibayar sekarang (Rp)</label>
              <input id="purchase-pay-now" type="number" required min={1} max={Math.max(0, total - 1)} step={1} value={partial} onChange={(event) => setPartial(event.target.value)} className="input" /></div>}
            {payNow < total && <div><label htmlFor="purchase-due" className="label">Jatuh tempo</label><input id="purchase-due" name="dueDate" type="date" required className="input" /></div>}
          </div>
          <div className="rounded-xl bg-[#f8f5ef] p-4 text-sm">
            <div className="flex justify-between"><span>Total pembelian</span><strong>{formatRupiah(total)}</strong></div>
            <div className="mt-2 flex justify-between"><span>Kas keluar saat simpan</span><strong>{formatRupiah(payNow)}</strong></div>
            <div className="mt-2 flex justify-between"><span>Hutang supplier bertambah</span><strong>{formatRupiah(Math.max(0, total - payNow))}</strong></div>
          </div>
          <p className="text-xs leading-relaxed text-muted">
            Pembelian lunas atau tunai <strong>otomatis tercatat sebagai kas keluar</strong> di Laporan Arus Kas. Jangan
            catat lagi di menu Pengeluaran. Untuk tempo, kas baru keluar saat pembayaran supplier dicatat.
          </p>
          <button
            type="submit"
            disabled={pending || total <= 0 || (duplicateWarning !== null && !duplicateConfirmed)}
            className="btn-primary"
          >
            {pending
              ? "Menyimpan pembelian…"
              : duplicateWarning && !duplicateConfirmed
                ? "Centang konfirmasi dulu"
                : duplicateWarning
                  ? "Simpan meski bukan duplikat"
                  : payment === "tempo"
                    ? "Simpan & catat hutang"
                    : "Simpan, terima barang & catat kas"}
          </button>
        </section>
      </fieldset>
    </form>
  );
}
