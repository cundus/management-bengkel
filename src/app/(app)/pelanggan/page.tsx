import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bike, Car, Plus, Search, Users, X } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { searchCustomers } from "@/lib/queries/customers";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCompactRupiah, formatRupiah } from "@/lib/format";
import { formatDateID } from "@/lib/dates";

export const metadata: Metadata = { title: "Pelanggan" };

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireUser();
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const customers = await searchCustomers(query);
  const totalVehicles = customers.reduce((sum, customer) => sum + (customer.vehicleCount ?? 0), 0);
  const totalOutstanding = customers.reduce((sum, customer) => sum + (customer.outstanding ?? 0), 0);

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="Buku pelanggan"
        title="Pelanggan & kendaraan"
        description="Riwayat servis, kendaraan, dan sisa tagihan setiap pelanggan tersimpan dalam satu profil."
        actions={
          <Link href="/pelanggan/baru" className="btn-primary">
            <Plus size={16} />
            Pelanggan baru
          </Link>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-2.5 sm:gap-4">
        <div className="card p-4">
          <div className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-faint">Pelanggan</div>
          <div className="mt-1 font-display text-[1.3rem] font-extrabold tracking-tight text-ink tabular">{customers.length}</div>
        </div>
        <div className="card p-4">
          <div className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-faint">Kendaraan</div>
          <div className="mt-1 font-display text-[1.3rem] font-extrabold tracking-tight text-ink tabular">{totalVehicles}</div>
        </div>
        <div className="card p-4">
          <div className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-faint">Total piutang</div>
          <div className="mt-1 font-display text-[1.3rem] font-extrabold tracking-tight text-ink tabular">
            {formatCompactRupiah(totalOutstanding)}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <form method="get" action="/pelanggan" className="relative w-full sm:max-w-sm">
            <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Cari nama, telepon, atau nopol…"
              className="input h-11 pl-10 pr-10 text-[13px]"
              aria-label="Cari pelanggan"
            />
            {query && (
              <Link
                href="/pelanggan"
                className="absolute right-2.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-faint hover:bg-[#f2eee6]"
                aria-label="Hapus pencarian"
              >
                <X size={14} />
              </Link>
            )}
          </form>
          <div className="text-[10px] font-semibold text-faint">
            {query ? `${customers.length} hasil untuk “${query}”` : `${customers.length} pelanggan terdaftar`}
          </div>
        </div>

        {customers.length === 0 ? (
          <EmptyState
            icon={Users}
            title={query ? "Pelanggan tidak ditemukan" : "Belum ada pelanggan"}
            description={query ? "Coba kata kunci lain atau daftarkan pelanggan baru." : "Tambahkan pelanggan pertama untuk mulai mencatat servis."}
            actionHref="/pelanggan/baru"
            actionLabel="Tambah pelanggan"
          />
        ) : (
          <div className="grid gap-px bg-line/70 sm:grid-cols-2">
            {customers.map((customer) => {
              const hasOverdue = (customer.outstanding ?? 0) > 0;
              return (
                <Link
                  key={customer.id}
                  href={`/pelanggan/${customer.id}`}
                  className="group flex items-start gap-3 bg-surface p-4 transition hover:bg-[#faf7f1] sm:p-5"
                >
                  <Avatar name={customer.name} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-[13.5px] font-extrabold text-ink">{customer.name}</div>
                        <div className="mt-0.5 text-[10.5px] font-medium text-muted">{customer.phone ?? "Tanpa telepon"}</div>
                      </div>
                      <ArrowRight size={15} className="mt-1 shrink-0 text-faint transition group-hover:translate-x-0.5 group-hover:text-brand" />
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#f2eee6] px-2 py-1 text-[9px] font-bold text-muted">
                        <Bike size={10} /> {customer.vehicleCount} kendaraan
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#f2eee6] px-2 py-1 text-[9px] font-bold text-muted">
                        <Car size={10} /> {customer.transactionCount} servis
                      </span>
                      {hasOverdue && (
                        <span className="badge-danger">
                          Piutang {formatRupiah(customer.outstanding ?? 0)}
                        </span>
                      )}
                    </div>

                    <div className="mt-2.5 flex items-center justify-between text-[9px] font-medium text-faint">
                      <span>
                        {customer.lastVisit
                          ? `Servis terakhir ${formatDateID(customer.lastVisit.slice(0, 10))}`
                          : "Belum pernah servis"}
                      </span>
                      {customer.outstanding === 0 && customer.transactionCount ? (
                        <span className="font-bold text-success">Tidak ada piutang</span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
