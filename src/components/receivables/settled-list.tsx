import Link from "next/link";
import { ArrowRight, CheckCircle2, Search, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateID } from "@/lib/dates";
import { formatRupiah } from "@/lib/format";
import type { SettledReceivableRow } from "@/lib/types";

const METHOD_LABELS: Record<string, string> = {
  tunai: "Tunai",
  transfer: "Transfer",
  qris: "QRIS",
};

export function SettledReceivableList({
  data,
  query,
}: {
  data: { rows: SettledReceivableRow[]; count: number; total: number; monthCount: number; monthTotal: number };
  query: string;
}) {
  return (
    <div className="card mt-4 overflow-hidden">
      <div className="grid grid-cols-2 gap-2.5 border-b border-line p-4 sm:p-5">
        <div className="rounded-xl bg-success-soft px-3.5 py-3">
          <div className="text-[9px] font-bold text-success/70">Dilunasi bulan ini</div>
          <div className="mt-1 text-[14px] font-extrabold text-success tabular">{formatRupiah(data.monthTotal)}</div>
          <div className="mt-0.5 text-[9px] font-medium text-success/60">{data.monthCount} nota</div>
        </div>
        <div className="rounded-xl bg-[#fbf9f4] px-3.5 py-3">
          <div className="text-[9px] font-bold text-faint">Total piutang tertagih</div>
          <div className="mt-1 text-[14px] font-extrabold text-ink tabular">{formatRupiah(data.total)}</div>
          <div className="mt-0.5 text-[9px] font-medium text-faint">{data.count} nota sepanjang waktu</div>
        </div>
      </div>

      <div className="border-b border-line p-4 sm:p-5">
        <form method="get" action="/piutang" className="relative w-full sm:max-w-sm">
          <input type="hidden" name="view" value="lunas" />
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Cari nama, nota, atau nopol…"
            className="input h-11 pl-10 pr-10 text-[13px]"
            aria-label="Cari riwayat piutang lunas"
          />
          {query && (
            <Link
              href="/piutang?view=lunas"
              className="absolute right-2.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-faint hover:bg-[#f2eee6]"
              aria-label="Hapus pencarian"
            >
              <X size={14} />
            </Link>
          )}
        </form>
      </div>

      {data.rows.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title={query ? "Tidak ada riwayat yang cocok" : "Belum ada piutang yang dilunasi"}
          description={
            query
              ? "Coba ubah kata kunci pencarian."
              : "Nota yang dibayar menyusul akan muncul di sini setelah lunas."
          }
        />
      ) : (
        <div className="divide-y divide-line/70">
          {data.rows.map((row) => {
            const installments = row.payments.filter((payment) => payment.businessDate > row.businessDate);
            return (
              <div key={row.id} className="p-4 transition hover:bg-[#faf7f1] sm:px-5">
                <div className="flex items-start gap-3">
                  <Avatar name={row.customerName} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[13px] font-extrabold text-ink">{row.customerName}</span>
                          <span className="badge-success">
                            <CheckCircle2 size={9} /> Lunas
                          </span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9.5px] font-medium text-faint">
                          <span className="font-mono">{row.invoiceNo}</span>
                          <span>·</span>
                          <span>{row.plateNumber ?? "Tanpa kendaraan"}</span>
                          <span>·</span>
                          <span>Nota {formatDateID(row.businessDate)}</span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-display text-[15px] font-extrabold tracking-tight text-ink tabular">
                          {formatRupiah(row.total)}
                        </div>
                        <div className="mt-0.5 text-[9.5px] font-semibold text-success">
                          Lunas {formatDateID(row.settledDate)} · {row.daysToSettle} hari
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div className="space-y-1 text-[10px]">
                        <div className="flex gap-2 text-muted">
                          <span className="w-[86px] shrink-0 font-medium">{formatDateID(row.businessDate)}</span>
                          <span>
                            DP <span className="font-bold text-ink tabular">{formatRupiah(row.downPayment)}</span>
                          </span>
                        </div>
                        {installments.map((payment, index) => (
                          <div key={`${payment.businessDate}-${index}`} className="flex gap-2 text-muted">
                            <span className="w-[86px] shrink-0 font-medium">{formatDateID(payment.businessDate)}</span>
                            <span>
                              {index === installments.length - 1 ? "Pelunasan" : "Cicilan"}{" "}
                              <span className="font-bold text-ink tabular">{formatRupiah(payment.amount)}</span>{" "}
                              <span className="text-faint">({METHOD_LABELS[payment.method] ?? payment.method})</span>
                            </span>
                          </div>
                        ))}
                      </div>
                      <Link href={`/transaksi/${row.id}`} className="btn-secondary btn-sm self-start sm:self-auto">
                        Detail
                        <ArrowRight size={12} />
                      </Link>
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
          Menampilkan {data.rows.length} dari {data.count} nota yang dilunasi menyusul.
        </div>
      )}
    </div>
  );
}
