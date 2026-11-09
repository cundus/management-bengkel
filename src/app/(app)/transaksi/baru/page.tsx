import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getCustomersWithVehicles } from "@/lib/queries/customers";
import { getCatalog } from "@/lib/queries/items";
import { getSettings } from "@/lib/queries/finance";
import { PageHeader } from "@/components/ui/page-header";
import { TransactionForm } from "@/components/transactions/transaction-form";
import { todayISO } from "@/lib/dates";

export const metadata: Metadata = { title: "Transaksi Baru" };

export default async function NewTransactionPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  await requireUser();
  const [customers, items, settings] = await Promise.all([
    getCustomersWithVehicles(),
    getCatalog(),
    getSettings(),
  ]);
  const today = todayISO();
  const params = await searchParams;
  const initialCustomerId = Number(params.customerId) || undefined;

  return (
    <div className="animate-fade-up">
      <PageHeader
        backHref="/transaksi"
        eyebrow="Kasir bengkel"
        title="Transaksi baru"
        description="Catat jasa, sparepart, dan pembayaran dalam satu nota. Total dan sisa piutang dihitung otomatis."
        actions={
          <Link href="/pelanggan/baru?next=/transaksi/baru" className="btn-secondary">
            <Plus size={15} />
            Pelanggan baru
          </Link>
        }
      />
      <TransactionForm
        customers={customers}
        items={items}
        today={today}
        defaultDueDays={Number(settings.default_due_days || 14)}
        initialCustomerId={initialCustomerId}
      />
    </div>
  );
}
