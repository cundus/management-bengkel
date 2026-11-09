import type { Metadata } from "next";
import Link from "next/link";
import { Download, Plus, ReceiptText, Search, SlidersHorizontal, X } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listTransactions } from "@/lib/queries/transactions";
import { PageHeader } from "@/components/ui/page-header";
import { PaymentBadge } from "@/components/ui/status-badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { formatRupiah } from "@/lib/format";
import { formatDateID, formatTimeID } from "@/lib/dates";
import { cn } from "@/lib/cn";
import type { TransaksiStatusFilter } from "@/lib/types";

export const metadata: Metadata = { title: "Transaksi" };

const FILTERS: { value: TransaksiStatusFilter; label: string }[] = [
  { value: "semua", label: "Semua" },
  { value: "lunas", label: "Lunas" },
  { value: "sebagian", label: "Sebagian" },
  { value: "belum_bayar", label: "Belum bayar" },
];

function isStatus(value: string | undefined): value is TransaksiStatusFilter {
  return !!value && ["semua", "lunas", "sebagian", "belum_bayar"].includes(value);
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  await requireUser();
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const status: TransaksiStatusFilter = isStatus(params.status) ? params.status : "semua";
  const page = Math.max(1, Number(params.page) || 1);
  const result = await listTransactions({ search: query, status, page, pageSize: 15 });

  function makeHref(nextPage: number, nextStatus = status): string {
    const search = new URLSearchParams();
    if (query) search.set("q", query);
    if (nextStatus !== "semua") search.set("status", nextStatus);
    if (nextPage > 1) search.set("page", String(nextPage));
    const suffix = search.toString();
    return suffix ? `/transaksi?${suffix}` : "/transaksi";
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="Buku kasir"
        title="Transaksi"
        description={`${result.total} nota tercatat. Semua penjualan jasa dan sparepart tersusun rapi di sini.`}
        actions={
          <>
            <a
              href={`/api/export/transaksi?q=${encodeURIComponent(query)}&status=${status}`}
              className="btn-secondary"
            >
              <Download size={15} />
              <span className="hidden sm:inline">Ekspor CSV</span>
            </a>
            <Link href="/transaksi/baru" className="btn-primary">
              <Plus size={16} />
              Transaksi baru
            </Link>
          </>
        }
      />

      <div className="card mb-4 overflow-hidden">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <form method="get" action="/transaksi" className="relative w-full sm:max-w-sm">
            {status !== "semua" && <input type="hidden" name="status" value={status} />}
            <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Cari nota, pelanggan, atau nopol…"
              className="input h-11 pl-10 pr-10 text-[13px]"
              aria-label="Cari transaksi"
            />
            {query && (
              <Link
                href={status === "semua" ? "/transaksi" : `/transaksi?status=${status}`}
                className="absolute right-2.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-faint hover:bg-[#f2eee6]"
                aria-label="Hapus pencarian"
              >
                <X size={14} />
              </Link>
            )}
          </form>

          <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto">
            <SlidersHorizontal size={14} className="mr-1 hidden shrink-0 text-faint sm:block" />
            {FILTERS.map((filter) => (
              <Link
                key={filter.value}
                href={makeHref(1, filter.value)}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-extrabold transition",
                  status === filter.value
                    ? "bg-pine text-white"
                    : "border border-line bg-white text-muted hover:border-line-strong hover:text-ink",
                )}
              >
                {filter.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {result.rows.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title={query || status !== "semua" ? "Tidak ada nota yang cocok" : "Belum ada transaksi"}
            description={
              query || status !== "semua"
                ? "Coba ubah kata kunci atau filter status pembayaran."
                : "Transaksi pertama akan muncul di sini setelah kamu menyimpan nota."
            }
            actionHref="/transaksi/baru"
            actionLabel="Buat transaksi baru"
          />
        ) : (
          <>
            <div className="hidden sm:block">
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nota</th>
                      <th>Pelanggan</th>
                      <th>Tanggal</th>
                      <th className="text-right">Total</th>
                      <th className="text-right">Dibayar</th>
                      <th>Status</th>
                      <th className="text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <div className="font-mono text-[11px] font-bold text-ink">{row.invoiceNo}</div>
                          {row.status === "batal" && <span className="badge-neutral mt-1">Dibatalkan</span>}
                        </td>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <Avatar name={row.customerName} size="sm" />
                            <div>
                              <div className="text-[12px] font-bold text-ink">{row.customerName}</div>
                              <div className="mt-0.5 text-[10px] font-medium text-faint">
                                {row.plateNumber ?? row.vehicleLabel ?? "Tanpa kendaraan"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="text-[11px] font-semibold text-ink">{formatDateID(row.businessDate)}</div>
                          <div className="mt-0.5 text-[10px] text-faint">{formatTimeID(row.createdAt)}</div>
                        </td>
                        <td className="text-right text-[12px] font-extrabold tabular">{formatRupiah(row.total)}</td>
                        <td className="text-right">
                          <div className="text-[12px] font-semibold text-muted tabular">{formatRupiah(row.paid)}</div>
                          {row.remaining > 0 && (
                            <div className="mt-0.5 text-[10px] font-bold text-danger tabular">
                              sisa {formatRupiah(row.remaining)}
                            </div>
                          )}
                        </td>
                        <td>
                          <PaymentBadge status={row.paymentStatus} />
                        </td>
                        <td className="text-right">
                          <Link
                            href={`/transaksi/${row.id}`}
                            className="text-[10px] font-extrabold text-brand hover:text-brand-dark"
                          >
                            Detail →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="divide-y divide-line/70 sm:hidden">
              {result.rows.map((row) => (
                <Link key={row.id} href={`/transaksi/${row.id}`} className="flex gap-3 p-4 transition active:bg-[#faf7f1]">
                  <Avatar name={row.customerName} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-[12.5px] font-extrabold text-ink">{row.customerName}</div>
                        <div className="mt-0.5 truncate text-[10px] font-medium text-faint">
                          {row.plateNumber ?? "Tanpa kendaraan"} · {formatDateID(row.businessDate)}
                        </div>
                      </div>
                      <PaymentBadge status={row.paymentStatus} compact />
                    </div>
                    <div className="mt-2 flex items-end justify-between">
                      <span className="font-mono text-[9px] font-semibold text-faint">{row.invoiceNo}</span>
                      <div className="text-right">
                        <span className="text-[13px] font-extrabold tabular">{formatRupiah(row.total)}</span>
                        {row.remaining > 0 && (
                          <div className="text-[9.5px] font-bold text-danger">sisa {formatRupiah(row.remaining)}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
        {result.rows.length > 0 && (
          <div className="px-4 pb-4 sm:px-5">
            <Pagination page={result.page} pageCount={result.pageCount} total={result.total} makeHref={makeHref} />
          </div>
        )}
      </div>
    </div>
  );
}
