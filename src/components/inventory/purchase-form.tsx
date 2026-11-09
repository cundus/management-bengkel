"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { createPurchaseAction } from "@/actions/purchases";
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
  const [pending, startTransition] = useTransition();
  const total = lines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unitCost), 0);
  const payNow = payment === "lunas" ? total : payment === "sebagian" ? Number(partial) : 0;
  const update = (key: number, patch: Partial<Line>) => setLines((current) => current.map((line) => line.key === key ? { ...line, ...patch } : line));

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
            requestId, supplierId: Number(form.get("supplierId")), referenceNo: String(form.get("referenceNo") ?? ""),
            businessDate: String(form.get("businessDate")), dueDate: payNow < total ? String(form.get("dueDate")) : null,
            notes: String(form.get("notes") ?? ""), payNow, method: String(form.get("method")) as PaymentMethod,
            lines: lines.map((line) => ({ itemId: Number(line.itemId), code: line.code, quantity: Number(line.quantity), unitCost: Number(line.unitCost) })),
          });
          if (result.ok) { router.push(`/pembelian/${result.id}`); router.refresh(); }
          else setMessage(result.message);
        } catch { setMessage("Koneksi terganggu. Coba simpan kembali; pembelian yang sama tidak akan digandakan."); }
      });
    }} className="space-y-5">
      {message && <p role="alert" className="rounded-xl bg-danger-soft p-4 text-sm text-danger">{message}</p>}
      <fieldset disabled={pending} className="space-y-5">
        <section className="card grid gap-4 p-5 sm:grid-cols-2">
          <div><label htmlFor="purchase-supplier" className="label">Supplier</label>
            <select id="purchase-supplier" name="supplierId" required defaultValue="" className="select">
              <option value="" disabled>Pilih supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select></div>
          <div><label htmlFor="purchase-reference" className="label">Nomor nota supplier (opsional)</label>
            <input id="purchase-reference" name="referenceNo" maxLength={80} className="input" placeholder="Nomor faktur / nota pembelian" /></div>
          <div><label htmlFor="purchase-date" className="label">Tanggal barang diterima</label>
            <input id="purchase-date" name="businessDate" type="date" required defaultValue={today} max={today} className="input" /></div>
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
            <div className="mt-2 flex justify-between"><span>Dibayar sekarang</span><strong>{formatRupiah(payNow)}</strong></div>
            <div className="mt-2 flex justify-between"><span>Sisa hutang supplier</span><strong>{formatRupiah(Math.max(0, total - payNow))}</strong></div>
          </div>
          <p className="text-xs leading-relaxed text-muted">Simpan saat barang sudah diterima. Stok bertambah per batch dan sisa tagihan masuk ke Hutang Supplier. Pembayaran berikutnya dicatat dari tagihan yang sama.</p>
          <button type="submit" disabled={pending || total <= 0} className="btn-primary">{pending ? "Menyimpan pembelian…" : "Simpan & terima barang"}</button>
        </section>
      </fieldset>
    </form>
  );
}
