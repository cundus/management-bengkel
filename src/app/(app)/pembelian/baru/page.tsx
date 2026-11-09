import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listSuppliers } from "@/lib/queries/finance";
import { todayISO } from "@/lib/dates";
import { PageHeader } from "@/components/ui/page-header";
import { PurchaseForm } from "@/components/inventory/purchase-form";
import { SupplierDialog } from "@/components/finance/payable-dialogs";

export const metadata: Metadata = { title: "Pembelian baru" };

export default async function NewPurchasePage() {
  await requireOwner();
  const [suppliers, items] = await Promise.all([
    listSuppliers(),
    prisma.item.findMany({ where: { category: "sparepart", isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, sku: true, cost: true, unit: true } }),
  ]);
  return <div>
    <PageHeader eyebrow="Purchasing" title="Pembelian baru" description="Terima barang, catat batch, dan hubungkan tagihan supplier dalam satu langkah." backHref="/pembelian" actions={<SupplierDialog />} />
    <PurchaseForm suppliers={suppliers} items={items} today={todayISO()} requestId={randomUUID()} />
  </div>;
}
