import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock, HandCoins, MessageCircle, Search, X } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getAgingSummary, getReceivables } from "@/lib/queries/transactions";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { DueBadge } from "@/components/ui/status-badge";
import { QuickPayButton } from "@/components/transactions/quick-pay-button";
import { dueLabel, formatDateID } from "@/lib/dates";
import { formatCompactRupiah, formatPhoneForWhatsApp, formatRupiah, percent } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { ReceivableFilter } from "@/lib/types";

export const metadata: Metadata = { title: "Piutang" };

const FILTERS: { value: ReceivableFilter; label: string }[] = [
  { value: "semua", label: "Semua" },
  { value: "jatuh_tempo", label: "Jatuh tempo" },
  { value: "lancar", label: "Masih lancar" },
];

function isFilter(value: string | undefined): value is ReceivableFilter {
  return !!value && ["semua", "jatuh_tempo", "lancar"].includes(value);
}

export default async function ReceivablesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  await requireUser();
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const filter: ReceivableFilter = isFilter(params.filter) ? params.filter : "semua";
  const [data, aging] = await Promise.all([
    getReceivables({ search: query, filter, limit: 100 }),
    getAgingSummary(),
  ]);
  const overduePercent = percent(data.overdueTotal, data.total);
  const avgAge = data.rows.length
    ? Math.round(
        data.rows.reduce((sum, row) => {
          if (!row.dueDate) return sum;
          const days = Math.floor(
            (new Date().getTime() - new Date(`${row.dueDate}T12:00:00Z`).getTime()) / 86_400_000,
          );
          return sum + Math.max(0, days);
        }, 0) / data.rows.length,
      )
    : 0;

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="Hutang pelanggan"
        title="Piutang"
        description="Pantau setiap rupiah yang belum masuk. Prioritaskan nota yang sudah lewat jatuh tempo."
      />

      <section className="grid gap-3 sm:grid-cols-3 sm:gap-4">
        <div className="relative overflow-hidden rounded-3xl bg-pine p-5 text-white sm:col-span-2 sm:p-6">
          <div className="dot-grid pointer-events-none absolute inset-0 opacity-20 [mask-image:linear-gradient(120deg,black,transparent_75%)]" />
          <div className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full border-[38px] border-brand/20" />
          <div className="relative flex h-full flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
                <HandCoins size={14} className="text-lime" /> Total piutang berjalan
              </div>
              <div className="mt-2 font-display text-[2.2rem] font-extrabold leading-none tracking-[-0.05em] tabular sm:text-[2.8rem]">
                {formatRupiah(data.total)}
              </div>
              <div className="mt-2 text-[11px] font-medium text-white/40">
                dari <span className="font-bold text-white/70">{data.count} nota</span> yang belum lunas
              </div>
            </div>
            <div className="flex gap-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5">
                <div className="text-[9px] font-bold text-white/40">Lewat tempo</div>
                <div className="mt-1 text-[14px] font-extrabold text-[#ffb59d] tabular">
                  {formatCompactRupiah(data.overdueTotal)}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5">
                <div className="text-[9px] font-bold text-white/40">Rata-rata telat</div>
                <div className="mt-1 text-[14px] font-extrabold text-white tabular">{avgAge} hari</div>
              </div>
            </div>
          </div>
          {data.total > 0 && (
            <div className="relative mt-5">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-brand" style={{ width: `${overduePercent}%` }} />
              </div>
              <p className="mt-1.5 text-[9px] font-semibold text-white/35">
                {overduePercent}% dari nilai piutang sudah melewati jatuh tempo
              </p>
            </div>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[12px] font-extrabold text-ink">Umur piutang</h2>
            <CalendarClock size={15} className="text-faint" />
          </div>
          <div className="mt-4 space-y-3">
            {aging.map((bucket) => {
              const max = Math.max(...aging.map((item) => item.total), 1);
              return (
                <div key={bucket.bucket}>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-semibold text-muted">{bucket.bucket}</span>
                    <span className="font-extrabold text-ink tabular">{formatCompactRupiah(bucket.total)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#efe9de]">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        bucket.bucket === ">30 hari"
                          ? "bg-danger"
                          : bucket.bucket === "8–30 hari"
                            ? "bg-warning"
                            : bucket.bucket === "1–7 hari"
                              ? "bg-brand"
                              : "bg-success",
                      )}
                      style={{ width: `${(bucket.total / max) * 100}%` }}
                    />
                  </div>
                  <div className="mt-1 text-[9px] font-medium text-faint">{bucket.count} nota</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {data.overdueCount > 0 && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-danger/15 bg-danger-soft px-4 py-3.5">
          <AlertTriangle size={17} className="mt-0.5 shrink-0 text-danger" />
          <div>
            <p className="text-[12px] font-extrabold text-danger">
              {data.overdueCount} nota sudah melewati jatuh tempo
            </p>
            <p className="mt-0.5 text-[10.5px] font-medium text-danger/75">
              Total {formatRupiah(data.overdueTotal)}. Segera hubungi pelanggan lewat WhatsApp.
            </p>
          </div>
        </div>
      )}

      <div className="card mt-4 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <form method="get" action="/piutang" className="relative w-full sm:max-w-sm">
            {filter !== "semua" && <input type="hidden" name="filter" value={filter} />}
            <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Cari nama, nota, atau nopol…"
              className="input h-11 pl-10 pr-10 text-[13px]"
              aria-label="Cari piutang"
            />
            {query && (
              <Link
                href={filter === "semua" ? "/piutang" : `/piutang?filter=${filter}`}
                className="absolute right-2.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-faint hover:bg-[#f2eee6]"
                aria-label="Hapus pencarian"
              >
                <X size={14} />
              </Link>
            )}
          </form>
          <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto">
            {FILTERS.map((item) => {
              const href = `/piutang?${new URLSearchParams({
                ...(query ? { q: query } : {}),
                ...(item.value !== "semua" ? { filter: item.value } : {}),
              }).toString()}`;
              return (
                <Link
                  key={item.value}
                  href={item.value === "semua" && !query ? "/piutang" : href}
                  className={cn(
                    "shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-extrabold transition",
                    filter === item.value
                      ? "bg-pine text-white"
                      : "border border-line bg-white text-muted hover:border-line-strong hover:text-ink",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        {data.rows.length === 0 ? (
          <EmptyState
            icon={HandCoins}
            title={query || filter !== "semua" ? "Tidak ada piutang yang cocok" : "Semua tagihan lunas"}
            description={
              query || filter !== "semua"
                ? "Coba ubah filter atau kata kunci pencarian."
                : "Tidak ada piutang berjalan. Kerja bagus!"
            }
          />
        ) : (
          <div className="divide-y divide-line/70">
            {data.rows.map((row) => {
              const due = dueLabel(row.dueDate);
              const phone = formatPhoneForWhatsApp(row.customerPhone);
              const remainingPercent = 100 - percent(row.paid, row.total);
              const waMessage = encodeURIComponent(
                `Halo ${row.customerName}, kami dari WMC 225. Mengingatkan tagihan nota ${row.invoiceNo} sebesar ${formatRupiah(
                  row.remaining,
                )}. Mohon konfirmasi pembayarannya. Terima kasih.`,
              );
              return (
                <div key={row.id} className="p-4 transition hover:bg-[#faf7f1] sm:px-5">
                  <div className="flex items-start gap-3">
                    <Avatar name={row.customerName} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-[13px] font-extrabold text-ink">{row.customerName}</span>
                            {due.tone === "overdue" && (
                              <span className="badge-danger">
                                <AlertTriangle size={9} /> Telat
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9.5px] font-medium text-faint">
                            <span className="font-mono">{row.invoiceNo}</span>
                            <span>·</span>
                            <span>{row.plateNumber ?? "Tanpa kendaraan"}</span>
                            <span>·</span>
                            <span>{formatDateID(row.businessDate)}</span>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="font-display text-[15px] font-extrabold tracking-tight text-ink tabular">
                            {formatRupiah(row.remaining)}
                          </div>
                          <div className="mt-0.5">
                            <DueBadge label={due.label} tone={due.tone} />
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-1 items-center gap-2.5">
                          <div className="h-1.5 w-full max-w-[160px] overflow-hidden rounded-full bg-[#efe9de]">
                            <div className="h-full rounded-full bg-success" style={{ width: `${100 - remainingPercent}%` }} />
                          </div>
                          <span className="whitespace-nowrap text-[9px] font-semibold text-faint">
                            {formatCompactRupiah(row.paid)} / {formatCompactRupiah(row.total)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {phone && (
                            <a
                              href={`https://wa.me/${phone}?text=${waMessage}`}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-secondary btn-sm"
                              aria-label={`Tagih ${row.customerName} via WhatsApp`}
                            >
                              <MessageCircle size={12} />
                              <span className="hidden sm:inline">Ingatkan</span>
                            </a>
                          )}
                          <Link href={`/transaksi/${row.id}`} className="btn-secondary btn-sm">
                            Detail
                            <ArrowRight size={12} />
                          </Link>
                          <QuickPayButton
                            transactionId={row.id}
                            customerName={row.customerName}
                            invoiceNo={row.invoiceNo}
                            remaining={row.remaining}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {data.rows.length > 0 && (
          <div className="border-t border-line px-4 py-3 text-[10px] font-medium text-faint sm:px-5">
            Menampilkan {data.rows.length} dari {data.count} nota piutang.
          </div>
        )}
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-line bg-surface/60 px-4 py-3">
        <MessageCircle size={14} className="mt-0.5 shrink-0 text-brand" />
        <p className="text-[10px] leading-relaxed text-muted">
          Gunakan tombol <span className="font-bold text-ink">Ingatkan</span> untuk mengirim pesan WhatsApp berisi
          nominal dan nomor nota. Pembayaran yang dicatat otomatis mengurangi sisa piutang dan menambah pendapatan.
        </p>
      </div>
    </div>
  );
}
