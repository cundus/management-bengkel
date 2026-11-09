"use client";

import { useActionState } from "react";
import { receiveStockBatchAction } from "@/actions/inventory";
import { initialActionState } from "@/lib/action-state";

export function BatchForm({ itemId, cost, today }: { itemId: number; cost: number; today: string }) {
  const [state, action, pending] = useActionState(receiveStockBatchAction, initialActionState);
  return (
    <form action={action} className="card space-y-4 p-5">
      <h2 className="font-display text-lg font-extrabold">Terima batch baru</h2>
      <input type="hidden" name="itemId" value={itemId} />
      {state.message && <p role="status" className={state.ok ? "text-sm text-pine" : "text-sm text-danger"}>{state.message}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="batch-code" className="label">Kode batch / lot</label>
          <input id="batch-code" name="code" required maxLength={80} placeholder="Contoh: OLI-20261109-01" className="input uppercase" />
        </div>
        <div>
          <label htmlFor="batch-date" className="label">Tanggal masuk</label>
          <input id="batch-date" name="receivedDate" type="date" required defaultValue={today} max={today} className="input" />
        </div>
        <div>
          <label htmlFor="batch-qty" className="label">Jumlah masuk</label>
          <input id="batch-qty" name="quantity" type="number" required min={1} max={2147483647} step={1} className="input" />
        </div>
        <div>
          <label htmlFor="batch-cost" className="label">Harga modal per unit (Rp)</label>
          <input id="batch-cost" name="unitCost" type="number" required min={0} max={2147483647} step={1} defaultValue={cost} className="input" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="batch-notes" className="label">Catatan (opsional)</label>
          <input id="batch-notes" name="notes" maxLength={500} placeholder="Supplier atau nomor nota pembelian" className="input" />
        </div>
      </div>
      <p className="text-xs text-muted">Stok bertambah sesuai jumlah masuk. Penjualan memakai batch paling awal (FIFO).</p>
      <button type="submit" disabled={pending} className="btn-primary">{pending ? "Menyimpan…" : "Simpan batch"}</button>
    </form>
  );
}
