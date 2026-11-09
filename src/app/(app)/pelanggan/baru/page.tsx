import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { CustomerForm } from "@/components/customers/customer-form";

export const metadata: Metadata = { title: "Pelanggan Baru" };

export default async function NewCustomerPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  await requireUser();
  const params = await searchParams;
  const next = params.next === "/transaksi/baru" ? "/transaksi/baru" : undefined;

  return (
    <div className="animate-fade-up">
      <PageHeader
        backHref={next || "/pelanggan"}
        eyebrow="Pelanggan"
        title="Pelanggan baru"
        description="Daftarkan pelanggan beserta kendaraan pertamanya. Data bisa dilengkapi kapan saja."
      />
      <CustomerForm next={next} />
    </div>
  );
}
