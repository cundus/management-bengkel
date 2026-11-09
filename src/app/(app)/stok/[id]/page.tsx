import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatNumber, formatRupiah } from "@/lib/format";
import { dateOnlyToISO, formatDateID, todayISO } from "@/lib/dates";
import { PageHeader } from "@/components/ui/page-header";
import { BatchForm } from "@/components/inventory/batch-form";

export const metadata: Metadata = { title: "Batch stok" };

export default async function StockBatchesPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const item = await prisma.item.findUnique({ where: { id }, include: {
    stockBatches: { orderBy: [{ receivedDate: "asc" }, { id: "asc" }], include: { purchase: { select: { id: true, supplier: { select: { name: true } } } } } },
  } });
  if (!item || item.category !== "sparepart") notFound();
  const value = item.stockBatches.reduce((sum, batch) => sum + batch.remaining * batch.unitCost, 0);
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Persediaan per batch" title={item.name}
        description={`${item.sku} · Stok ${formatNumber(item.stock)} ${item.unit} · Nilai ${formatRupiah(value)}`}
        actions={<Link href="/stok" className="btn-secondary">Kembali ke stok</Link>} />
      {user.role === "owner" && item.isActive && <>
        <Link href="/pembelian/baru" className="btn-primary">Terima barang dari pembelian</Link>
        <details className="text-sm text-muted"><summary className="cursor-pointer">Tambah stok tanpa tagihan supplier</summary>
          <p className="my-3 text-xs">Gunakan untuk stok awal atau penambahan di luar pembelian. Pembelian supplier dicatat melalui menu Pembelian agar tagihan ikut tercatat.</p>
          <BatchForm itemId={item.id} cost={item.cost} today={todayISO()} />
        </details>
      </>}
      {!item.isActive && <p className="text-sm text-muted">Aktifkan item untuk menerima batch baru.</p>}
      <div className="card overflow-hidden">
        <div className="p-5">
          <h2 className="font-display text-lg font-extrabold">Riwayat batch</h2>
          <p className="mt-1 text-xs text-muted">Urutan pemakaian berdasarkan tanggal masuk, lalu urutan pencatatan. Harga modal batch tersimpan tetap.</p>
        </div>
        {item.stockBatches.length === 0 ? <p className="p-5 text-sm text-muted">Belum ada batch. Terima batch baru untuk menambah stok.</p> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Batch / lot</th><th>Masuk</th><th>Jumlah awal</th><th>Sisa</th><th>Modal / unit</th><th>Nilai sisa</th></tr></thead>
              <tbody>{item.stockBatches.map((batch) => (
                <tr key={batch.id}>
                  <td><div className="font-bold">{batch.code}</div>{batch.notes && <p className="max-w-xs whitespace-normal text-xs text-muted">{batch.notes}</p>}
                    {user.role === "owner" && batch.purchase && <Link href={`/pembelian/${batch.purchase.id}`} className="text-xs text-pine underline">PB-{String(batch.purchase.id).padStart(5, "0")} · {batch.purchase.supplier.name}</Link>}
                  </td>
                  <td>{formatDateID(dateOnlyToISO(batch.receivedDate))}</td>
                  <td>{formatNumber(batch.quantity)}</td>
                  <td>{formatNumber(batch.remaining)} {item.unit}{batch.remaining === 0 && <span className="ml-2 badge-neutral">Habis</span>}</td>
                  <td>{formatRupiah(batch.unitCost)}</td><td>{formatRupiah(batch.remaining * batch.unitCost)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
