import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatNumber, formatRupiah } from "@/lib/format";
import { dateOnlyToISO, formatDateID } from "@/lib/dates";
import { PageHeader } from "@/components/ui/page-header";
import { PayablePaymentDialog, ReversePayablePaymentDialog } from "@/components/finance/payable-dialogs";

export const metadata: Metadata = { title: "Detail pembelian" };

export default async function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOwner();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const purchase = await prisma.purchase.findUnique({ where: { id }, include: {
    supplier: true, createdBy: true, payable: { include: { payments: { include: { reversal: { select: { id: true } } }, orderBy: { paidAt: "desc" } } } },
    batches: { include: { item: true }, orderBy: { id: "asc" } },
  } });
  if (!purchase) notFound();
  const paid = purchase.payable.payments.reduce((sum, payment) => sum + payment.amount, 0);
  const remaining = Math.max(0, purchase.total - paid);
  return <div className="space-y-5">
    <PageHeader eyebrow="Barang diterima" title={`PB-${String(purchase.id).padStart(5, "0")}`} backHref="/pembelian"
      description={`${purchase.supplier.name} · ${formatDateID(dateOnlyToISO(purchase.businessDate))}${purchase.referenceNo ? ` · Nota ${purchase.referenceNo}` : ""}`}
      actions={<Link href={`/hutang?semua=1#tagihan-${purchase.payableId}`} className="btn-secondary">Lihat tagihan supplier</Link>} />
    <div className="grid gap-3 sm:grid-cols-3">
      {[['Total pembelian', purchase.total], ['Sudah dibayar', paid], ['Sisa hutang', remaining]].map(([label, amount]) => <div key={label} className="card p-5"><p className="text-xs text-muted">{label}</p><p className="mt-2 font-display text-xl font-extrabold">{formatRupiah(Number(amount))}</p></div>)}
    </div>
    <div className="card overflow-hidden"><div className="p-5"><h2 className="font-display text-lg font-extrabold">Barang & batch</h2></div>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Barang</th><th>Batch / lot</th><th>Jumlah masuk</th><th>Sisa batch</th><th>Modal / unit</th><th>Subtotal</th></tr></thead>
        <tbody>{purchase.batches.map((batch) => <tr key={batch.id}>
          <td><Link href={`/stok/${batch.itemId}`} className="font-bold text-pine underline">{batch.item.name}</Link><p className="text-xs text-muted">{batch.item.sku}</p></td>
          <td>{batch.code}</td><td>{formatNumber(batch.quantity)} {batch.item.unit}</td><td>{formatNumber(batch.remaining)}</td>
          <td>{formatRupiah(batch.unitCost)}</td><td>{formatRupiah(batch.quantity * batch.unitCost)}</td>
        </tr>)}</tbody></table></div>
    </div>
    <section className="card space-y-4 p-5">
      <h2 className="font-display text-lg font-extrabold">Pembayaran supplier</h2>
      <p className="text-sm text-muted">{remaining > 0 ? "Pembayaran di sini terhubung ke tagihan yang sama di Hutang Supplier." : "Pembelian sudah lunas."}{purchase.payable.dueDate ? ` Jatuh tempo ${formatDateID(dateOnlyToISO(purchase.payable.dueDate))}.` : ""}</p>
      {remaining > 0 && <PayablePaymentDialog payableId={purchase.payableId} supplierName={purchase.supplier.name} remaining={remaining} />}
      {purchase.payable.payments.map((payment) => {
        const isReversal = payment.reversesPaymentId !== null;
        const reversed = payment.reversal !== null;
        const businessDate = dateOnlyToISO(payment.businessDate);
        return <div key={payment.id} className="flex justify-between gap-3 border-t border-line pt-3 text-sm">
          <div>{formatDateID(businessDate)} · {payment.method}{isReversal ? " · koreksi" : reversed ? " · dibalik" : ""}
            {payment.notes && <p className="text-xs text-muted">{payment.notes}</p>}
            {!isReversal && !reversed && <ReversePayablePaymentDialog paymentId={payment.id} amount={payment.amount} method={payment.method} businessDate={businessDate} />}
          </div>
          <strong className={isReversal ? "text-danger" : reversed ? "text-faint line-through" : undefined}>
            {isReversal ? `−${formatRupiah(-payment.amount)}` : formatRupiah(payment.amount)}
          </strong>
        </div>;
      })}
    </section>
    <div className="text-xs text-muted">Dicatat oleh {purchase.createdBy.name}{purchase.notes && <p className="mt-2 whitespace-pre-wrap">{purchase.notes}</p>}</div>
  </div>;
}
