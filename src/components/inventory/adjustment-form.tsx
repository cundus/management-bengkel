"use client";

import { useActionState, useEffect, useState } from "react";
import { adjustStockAction } from "@/actions/inventory";
import { initialActionState } from "@/lib/action-state";
import { ADJUSTMENT_REASONS, type AdjustmentDirection } from "@/lib/stock-adjustments";
import { formatNumber, formatRupiah } from "@/lib/format";
import { cn } from "@/lib/cn";

type Batch = { id: number; code: string; remaining: number; unitCost: number };

// Same FIFO order the server uses, only for the preview.
function estimateValue(batches: Batch[], qty: number, batchId: string): number | null {
  const pool = batchId ? batches.filter((batch) => String(batch.id) === batchId) : batches;
  let needed = qty;
  let value = 0;
  for (const batch of pool) {
    const taken = Math.min(needed, batch.remaining);
    value += taken * batch.unitCost;
    needed -= taken;
    if (needed === 0) break;
  }
  return needed > 0 ? null : value;
}

export function AdjustmentForm({ itemId, stock, unit, cost, batches }: {
  itemId: number; stock: number; unit: string; cost: number; batches: Batch[];
}) {
  const [state, action, pending] = useActionState(adjustStockAction, initialActionState);
  const [direction, setDirection] = useState<AdjustmentDirection>("kurang");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [batchId, setBatchId] = useState("");
  const [unitCost, setUnitCost] = useState(String(cost));
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!state.ok) return;
    setQty("");
    setReason("");
    setBatchId("");
    setNotes("");
  }, [state]);

  const reasons = ADJUSTMENT_REASONS.filter((entry) => entry.directions.includes(direction));
  const amount = Number(qty);
  const validQty = Number.isInteger(amount) && amount > 0;
  const after = validQty ? stock + (direction === "tambah" ? amount : -amount) : null;
  const value = !validQty ? null
    : direction === "tambah" ? amount * (Number(unitCost) || 0)
    : estimateValue(batches, amount, batchId);
  const errors = state.fieldErrors ?? {};

  const changeDirection = (next: AdjustmentDirection) => {
    setDirection(next);
    if (reason && !ADJUSTMENT_REASONS.find((entry) => entry.value === reason)?.directions.includes(next)) setReason("");
  };

  return (
    <form action={action} className="card space-y-4 p-5">
      <div>
        <h2 className="font-display text-lg font-extrabold">Penyesuaian stok manual</h2>
        <p className="mt-1 text-xs text-muted">Untuk barang rusak, hilang, dipakai sendiri, atau selisih hitung. Tercatat permanen di kartu stok dan laporan laba rugi. Kesalahan dikoreksi dengan penyesuaian baru.</p>
      </div>
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="expectedStock" value={stock} />
      <input type="hidden" name="direction" value={direction} />
      {state.message && <p role="status" className={state.ok ? "text-sm text-pine" : "text-sm text-danger"}>{state.message}</p>}

      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Arah penyesuaian">
        {([["kurang", "Kurangi stok"], ["tambah", "Tambah stok"]] as const).map(([value, label]) => (
          <button key={value} type="button" role="radio" aria-checked={direction === value} onClick={() => changeDirection(value)}
            className={cn("rounded-xl px-3 py-2.5 text-[12px] font-extrabold transition",
              direction === value ? "bg-pine text-white" : "border border-line bg-white text-muted hover:text-ink")}>
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="adj-qty" className="label">Jumlah ({unit})</label>
          <input id="adj-qty" name="qty" type="number" required min={1} max={direction === "kurang" ? stock : 2147483647} step={1}
            value={qty} onChange={(event) => setQty(event.target.value)} className="input" />
          {errors.qty && <p className="mt-1 text-[9px] font-semibold text-danger">{errors.qty}</p>}
        </div>
        <div>
          <label htmlFor="adj-reason" className="label">Alasan</label>
          <select id="adj-reason" name="reason" required value={reason} onChange={(event) => setReason(event.target.value)} className="select">
            <option value="" disabled>Pilih alasan</option>
            {reasons.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
          </select>
          {errors.reason && <p className="mt-1 text-[9px] font-semibold text-danger">{errors.reason}</p>}
        </div>
        {direction === "kurang" ? (
          <div className="sm:col-span-2">
            <label htmlFor="adj-batch" className="label">Ambil dari batch</label>
            <select id="adj-batch" name="stockBatchId" value={batchId} onChange={(event) => setBatchId(event.target.value)} className="select">
              <option value="">Otomatis FIFO (batch paling awal)</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>{batch.code} · sisa {formatNumber(batch.remaining)} · {formatRupiah(batch.unitCost)}/unit</option>
              ))}
            </select>
            {errors.stockBatchId && <p className="mt-1 text-[9px] font-semibold text-danger">{errors.stockBatchId}</p>}
          </div>
        ) : (
          <div className="sm:col-span-2">
            <label htmlFor="adj-cost" className="label">Modal per unit (Rp)</label>
            <input id="adj-cost" name="unitCost" type="number" required min={0} max={2147483647} step={1}
              value={unitCost} onChange={(event) => setUnitCost(event.target.value)} className="input" />
            <p className="mt-1 text-[10px] text-muted">Stok tambahan masuk sebagai batch baru dengan modal ini.</p>
            {errors.unitCost && <p className="mt-1 text-[9px] font-semibold text-danger">{errors.unitCost}</p>}
          </div>
        )}
        <div className="sm:col-span-2">
          <label htmlFor="adj-notes" className="label">Keterangan</label>
          <textarea id="adj-notes" name="notes" required minLength={5} maxLength={500} rows={2} value={notes}
            onChange={(event) => setNotes(event.target.value)} placeholder="Contoh: 2 botol bocor saat dicek rak belakang" className="textarea" />
          {errors.notes && <p className="mt-1 text-[9px] font-semibold text-danger">{errors.notes}</p>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-xl border border-line bg-[#fbf9f4] p-3 text-[11px]">
        <div><div className="text-faint">Stok sekarang</div><div className="font-extrabold tabular">{formatNumber(stock)} {unit}</div></div>
        <div><div className="text-faint">Setelah</div>
          <div className={cn("font-extrabold tabular", after !== null && after < 0 && "text-danger")}>{after === null ? "-" : `${formatNumber(after)} ${unit}`}</div>
        </div>
        <div><div className="text-faint">Nilai</div>
          <div className={cn("font-extrabold tabular", direction === "kurang" ? "text-danger" : "text-pine")}>
            {value === null ? "-" : `${direction === "kurang" ? "−" : "+"}${formatRupiah(value)}`}
          </div>
        </div>
      </div>

      <button type="submit" disabled={pending || (after !== null && after < 0)} className="btn-primary">
        {pending ? "Menyimpan…" : "Simpan penyesuaian"}
      </button>
    </form>
  );
}
