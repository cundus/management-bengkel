import type { Metadata } from "next";
import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatRupiah } from "@/lib/format";
import { dateOnlyToISO, formatDateID } from "@/lib/dates";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";

export const metadata: Metadata = { title: "Pembelian" };

export default async function PurchasesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireOwner();
  const rawPage = Number((await searchParams).page ?? 1);
  const page = Number.isInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 100000) : 1;
  const [purchases, total] = await Promise.all([
    prisma.purchase.findMany({ orderBy: [{ businessDate: "desc" }, { id: "desc" }], take: 20, skip: (page - 1) * 20,
      include: { supplier: true, payable: { include: { payments: { select: { amount: true } } } }, _count: { select: { batches: true } } } }),
    prisma.purchase.count(),
  ]);
  return <div>
    <PageHeader eyebrow="Purchasing" title="Pembelian" description="Riwayat barang masuk, batch stok, dan pembayaran supplier."
      actions={<><Link href="/hutang" className="btn-secondary">Hutang supplier</Link><Link href="/pembelian/baru" className="btn-primary">Pembelian baru</Link></>} />
    <div className="card overflow-hidden">
      {!purchases.length ? <p className="p-6 text-sm text-muted">Belum ada pembelian. Catat pembelian saat barang diterima dari supplier.</p> : <div className="divide-y divide-line">
        {purchases.map((purchase) => {
          const paid = purchase.payable.payments.reduce((sum, payment) => sum + payment.amount, 0);
          const remaining = Math.max(0, purchase.total - paid);
          return <Link key={purchase.id} href={`/pembelian/${purchase.id}`} className="flex flex-wrap items-center justify-between gap-3 p-5 hover:bg-[#faf7f1]">
            <div><div className="text-sm font-extrabold">PB-{String(purchase.id).padStart(5, "0")} · {purchase.supplier.name}</div>
              <p className="mt-1 text-xs text-muted">{formatDateID(dateOnlyToISO(purchase.businessDate))} · {purchase._count.batches} batch{purchase.referenceNo ? ` · ${purchase.referenceNo}` : ""}</p></div>
            <div className="text-right"><div className="font-bold">{formatRupiah(purchase.total)}</div><div className="mt-1 text-xs text-muted">{remaining > 0 ? `Sisa hutang ${formatRupiah(remaining)}` : "Lunas"}</div></div>
          </Link>;
        })}
      </div>}
    </div>
    <Pagination page={page} pageCount={Math.max(1, Math.ceil(total / 20))} total={total} makeHref={(target) => `/pembelian?page=${target}`} />
  </div>;
}
