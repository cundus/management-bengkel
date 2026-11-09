import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bike,
  CalendarDays,
  Gauge,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  ReceiptText,
  Wallet,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getCustomerById } from "@/lib/queries/customers";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { PaymentBadge } from "@/components/ui/status-badge";
import { VehicleForm } from "@/components/customers/vehicle-form";
import { formatPhoneForWhatsApp, formatRupiah } from "@/lib/format";
import { formatDateID } from "@/lib/dates";
import { percent } from "@/lib/format";

export const metadata: Metadata = { title: "Profil Pelanggan" };

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const customer = await getCustomerById(Number(id));
  if (!customer) notFound();

  const phone = formatPhoneForWhatsApp(customer.phone);
  const totalPaid = customer.transactions.reduce((sum, transaction) => sum + transaction.paid, 0);
  const waMessage = encodeURIComponent(
    `Halo ${customer.name}, kami dari WMC 225. Terima kasih sudah servis di tempat kami. Ada yang bisa kami bantu lagi?`,
  );

  return (
    <div className="animate-fade-up">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/pelanggan" className="inline-flex items-center gap-1.5 text-[11px] font-bold text-muted hover:text-ink">
          <ArrowLeft size={14} /> Semua pelanggan
        </Link>
        <div className="flex items-center gap-2">
          {phone && (
            <a href={`https://wa.me/${phone}?text=${waMessage}`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">
              <MessageCircle size={13} />
              <span className="hidden sm:inline">WhatsApp</span>
            </a>
          )}
          <Link href={`/transaksi/baru?customerId=${customer.id}`} className="btn-primary btn-sm">
            <Plus size={14} />
            Servis baru
          </Link>
        </div>
      </div>

      <section className="relative overflow-hidden rounded-3xl bg-pine p-5 text-white sm:p-7">
        <div className="dot-grid pointer-events-none absolute inset-0 opacity-25 [mask-image:linear-gradient(115deg,black,transparent_70%)]" />
        <div className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full border-[34px] border-brand/20" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-brand font-display text-lg font-extrabold text-white">
              {customer.name
                .split(" ")
                .slice(0, 2)
                .map((part) => part[0])
                .join("")}
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">Profil pelanggan</div>
              <h1 className="mt-1 font-display text-2xl font-extrabold tracking-[-0.04em] sm:text-3xl">{customer.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] font-medium text-white/45">
                <span className="flex items-center gap-1">
                  <Phone size={11} /> {customer.phone || "Tanpa telepon"}
                </span>
                {customer.address && (
                  <span className="flex items-center gap-1">
                    <MapPin size={11} /> {customer.address}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <CalendarDays size={11} /> Sejak {formatDateID(customer.createdAt.slice(0, 10))}
                </span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-center">
              <div className="text-[8px] font-bold uppercase tracking-wider text-white/35">Total servis</div>
              <div className="mt-1 font-display text-base font-extrabold tabular">{customer.transactions.length}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-center">
              <div className="text-[8px] font-bold uppercase tracking-wider text-white/35">Total belanja</div>
              <div className="mt-1 font-display text-[13px] font-extrabold tabular">{formatRupiah(customer.totalSpend)}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-center">
              <div className="text-[8px] font-bold uppercase tracking-wider text-white/35">Piutang</div>
              <div className={`mt-1 font-display text-[13px] font-extrabold tabular ${customer.outstanding > 0 ? "text-[#ffb59d]" : "text-lime"}`}>
                {formatRupiah(customer.outstanding)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {customer.outstanding > 0 && (
        <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-warning/20 bg-warning-soft px-4 py-3">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warning" />
          <div>
            <p className="text-[11px] font-extrabold text-warning">Ada piutang berjalan sebesar {formatRupiah(customer.outstanding)}</p>
            <p className="mt-0.5 text-[10px] text-warning/75">
              Total yang sudah dibayar: {formatRupiah(totalPaid)} dari {formatRupiah(customer.totalSpend)}.
            </p>
          </div>
          <Link href="/piutang" className="ml-auto shrink-0 text-[10px] font-extrabold text-warning hover:underline">
            Kelola →
          </Link>
        </div>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <div className="eyebrow">Riwayat servis</div>
              <h2 className="mt-1 section-title">Semua transaksi</h2>
            </div>
            <span className="badge-neutral">{customer.transactions.length} nota</span>
          </div>

          {customer.transactions.length === 0 ? (
            <EmptyState
              icon={ReceiptText}
              title="Belum ada riwayat servis"
              description="Buat transaksi pertama untuk pelanggan ini."
              actionHref={`/transaksi/baru?customerId=${customer.id}`}
              actionLabel="Buat transaksi"
            />
          ) : (
            <div className="divide-y divide-line/70">
              {customer.transactions.map((transaction) => (
                <Link
                  key={transaction.id}
                  href={`/transaksi/${transaction.id}`}
                  className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-[#faf7f1] sm:px-5"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#f2eee6] text-muted">
                    <ReceiptText size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[11.5px] font-bold text-ink">{transaction.plateNumber ?? transaction.vehicleLabel ?? "Tanpa kendaraan"}</span>
                      {transaction.status === "batal" && <span className="badge-neutral">Void</span>}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[9.5px] font-medium text-faint">
                      <span className="font-mono">{transaction.invoiceNo}</span>
                      <span>·</span>
                      <span>{formatDateID(transaction.businessDate)}</span>
                      {transaction.mechanic && (
                        <>
                          <span>·</span>
                          <span>Mekanik {transaction.mechanic}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[11.5px] font-extrabold text-ink tabular">{formatRupiah(transaction.total)}</div>
                    <div className="mt-1 flex items-center justify-end gap-1.5">
                      <PaymentBadge status={transaction.paymentStatus} compact />
                      <ArrowRight size={12} className="text-faint" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <section className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="eyebrow">Garasi</div>
                <h2 className="mt-1 section-title">Kendaraan terdaftar</h2>
              </div>
              <Bike size={18} className="text-faint" />
            </div>
            <div className="mt-3 space-y-2">
              {customer.vehicles.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line px-3 py-5 text-center text-[10px] text-faint">
                  Belum ada kendaraan.
                </p>
              ) : (
                customer.vehicles.map((vehicle) => (
                  <div key={vehicle.id} className="rounded-xl border border-line bg-[#fbf9f4] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex rounded-md border border-line bg-white px-2 py-1 font-mono text-[10px] font-extrabold tracking-wider text-ink">
                        {vehicle.plateNumber}
                      </span>
                      {vehicle.year && <span className="text-[9px] font-bold text-faint">{vehicle.year}</span>}
                    </div>
                    <div className="mt-2 text-[11.5px] font-extrabold text-ink">
                      {vehicle.brand} {vehicle.model}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[9px] font-medium text-faint">
                      {vehicle.color && <span>{vehicle.color}</span>}
                      {vehicle.odometer != null && (
                        <span className="flex items-center gap-0.5">
                          <Gauge size={9} /> {vehicle.odometer.toLocaleString("id-ID")} km
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            <VehicleForm customerId={customer.id} />
          </section>

          <section className="card p-5">
            <div className="flex items-center gap-2">
              <Wallet size={15} className="text-muted" />
              <h2 className="text-[12px] font-extrabold text-ink">Ringkasan nilai pelanggan</h2>
            </div>
            <div className="mt-3 space-y-2.5 text-[10.5px]">
              <div className="flex justify-between">
                <span className="text-muted">Total nilai servis</span>
                <span className="font-extrabold text-ink tabular">{formatRupiah(customer.totalSpend)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Sudah dibayar</span>
                <span className="font-extrabold text-success tabular">{formatRupiah(totalPaid)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Sisa piutang</span>
                <span className={`font-extrabold tabular ${customer.outstanding > 0 ? "text-danger" : "text-success"}`}>
                  {formatRupiah(customer.outstanding)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[#efe9de]">
                <div className="h-full rounded-full bg-success" style={{ width: `${percent(totalPaid, customer.totalSpend)}%` }} />
              </div>
              <p className="text-[9px] text-faint">
                {percent(totalPaid, customer.totalSpend)}% dari total nilai servis sudah dibayar.
              </p>
            </div>
            {customer.notes && (
              <div className="mt-4 rounded-xl bg-[#fbf9f4] px-3 py-2.5">
                <div className="text-[8.5px] font-extrabold uppercase tracking-wider text-faint">Catatan</div>
                <p className="mt-1 text-[10px] leading-relaxed text-muted">{customer.notes}</p>
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
