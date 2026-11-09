import type { Metadata } from "next";
import {
  Banknote,
  CalendarDays,
  Layers,
  ReceiptText,
  TrendingDown,
  WalletCards,
} from "lucide-react";
import { requireOwner } from "@/lib/auth";
import { listExpenses } from "@/lib/queries/finance";
import { monthOptions } from "@/lib/queries/reports";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ExpenseDialog } from "@/components/finance/expense-dialog";
import { currentMonthISO, formatDateID, isValidMonth, monthLabel } from "@/lib/dates";
import { formatCompactRupiah, formatRupiah, percent } from "@/lib/format";

export const metadata: Metadata = { title: "Pengeluaran" };

const CATEGORY_COLORS = ["bg-brand", "bg-pine", "bg-warning", "bg-info", "bg-success", "bg-[#8a6d3b]", "bg-[#92483c]"];

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await requireOwner();
  const params = await searchParams;
  const month = isValidMonth(params.month) ? params.month : currentMonthISO();
  const data = await listExpenses({ month, limit: 100 });
  const options = monthOptions(12);
  const largest = data.byCategory[0];

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="Kas keluar"
        title="Pengeluaran"
        description="Catat biaya operasional agar laba bersih di laporan benar-benar mencerminkan kondisi bengkel."
        actions={
          <>
            <form method="get" action="/pengeluaran" className="flex items-center gap-1.5">
              <div className="relative">
                <CalendarDays size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                <select
                  name="month"
                  defaultValue={month}
                  className="h-10 appearance-none rounded-xl border border-line-strong bg-surface pl-8 pr-8 text-[11.5px] font-extrabold text-ink outline-none focus:border-brand"
                  aria-label="Pilih bulan"
                >
                  {options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn-secondary h-10 px-3 text-[11px]">
                Lihat
              </button>
            </form>
            <ExpenseDialog />
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
        <div className="card p-4 sm:p-5">
          <div className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.1em] text-faint">
            <WalletCards size={11} /> Total pengeluaran
          </div>
          <div className="mt-1.5 font-display text-[1.3rem] font-extrabold tracking-tight text-ink tabular">
            {formatRupiah(data.total)}
          </div>
          <div className="mt-1 text-[9px] font-medium text-muted">{monthLabel(month)}</div>
        </div>
        <div className="card p-4 sm:p-5">
          <div className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.1em] text-faint">
            <ReceiptText size={11} /> Jumlah catatan
          </div>
          <div className="mt-1.5 font-display text-[1.3rem] font-extrabold tracking-tight text-ink tabular">{data.rows.length}</div>
          <div className="mt-1 text-[9px] font-medium text-muted">transaksi pengeluaran</div>
        </div>
        <div className="card p-4 sm:p-5">
          <div className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.1em] text-faint">
            <Layers size={11} /> Kategori terbesar
          </div>
          <div className="mt-1.5 truncate font-display text-[1.1rem] font-extrabold tracking-tight text-ink">
            {largest?.category ?? "—"}
          </div>
          <div className="mt-1 text-[9px] font-medium text-muted">{largest ? formatRupiah(largest.amount) : "Belum ada data"}</div>
        </div>
        <div className="card p-4 sm:p-5">
          <div className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.1em] text-faint">
            <TrendingDown size={11} /> Rata-rata / catatan
          </div>
          <div className="mt-1.5 font-display text-[1.3rem] font-extrabold tracking-tight text-ink tabular">
            {formatRupiah(data.rows.length ? Math.round(data.total / data.rows.length) : 0)}
          </div>
          <div className="mt-1 text-[9px] font-medium text-muted">per pengeluaran</div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <div className="eyebrow">Buku pengeluaran</div>
              <h2 className="mt-1 section-title">{monthLabel(month)}</h2>
            </div>
            <span className="badge-neutral">{data.rows.length} catatan</span>
          </div>

          {data.rows.length === 0 ? (
            <EmptyState
              icon={Banknote}
              title="Belum ada pengeluaran"
              description="Catat biaya operasional bulan ini supaya laporan laba lebih akurat."
            />
          ) : (
            <>
              <div className="hidden sm:block">
                <div className="table-wrap">
                  <table className="data-table min-w-[560px]">
                    <thead>
                      <tr>
                        <th>Keterangan</th>
                        <th>Kategori</th>
                        <th>Tanggal</th>
                        <th className="text-right">Nominal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((expense) => (
                        <tr key={expense.id}>
                          <td>
                            <div className="text-[12px] font-bold text-ink">{expense.description}</div>
                            <div className="mt-0.5 text-[9px] font-medium text-faint">oleh {expense.createdByName}</div>
                          </td>
                          <td>
                            <span className="badge-neutral">{expense.category}</span>
                          </td>
                          <td className="text-[11px] font-semibold text-muted">{formatDateID(expense.expenseDate)}</td>
                          <td className="text-right text-[12px] font-extrabold text-ink tabular">{formatRupiah(expense.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="divide-y divide-line/70 sm:hidden">
                {data.rows.map((expense) => (
                  <div key={expense.id} className="flex items-center gap-3 p-4">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-warning">
                      <Banknote size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11.5px] font-bold text-ink">{expense.description}</div>
                      <div className="mt-0.5 text-[9px] font-medium text-faint">
                        {expense.category} · {formatDateID(expense.expenseDate)}
                      </div>
                    </div>
                    <div className="shrink-0 text-[11.5px] font-extrabold text-ink tabular">{formatRupiah(expense.amount)}</div>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="border-t border-line px-4 py-3 text-[10px] font-medium text-faint sm:px-5">
            Pengeluaran dikelola oleh pemilik bengkel.
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card p-5">
            <div className="eyebrow">Komposisi biaya</div>
            <h2 className="mt-1 section-title">Per kategori</h2>
            {data.byCategory.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-line px-3 py-6 text-center text-[10px] text-faint">
                Belum ada data kategori.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {data.byCategory.map((category, index) => (
                  <div key={category.category}>
                    <div className="flex justify-between text-[10.5px]">
                      <span className="flex items-center gap-1.5 font-semibold text-muted">
                        <span className={`size-2 rounded-full ${CATEGORY_COLORS[index % CATEGORY_COLORS.length]}`} />
                        {category.category}
                      </span>
                      <span className="font-extrabold text-ink tabular">{formatCompactRupiah(category.amount)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#efe9de]">
                      <div
                        className={`h-full rounded-full ${CATEGORY_COLORS[index % CATEGORY_COLORS.length]}`}
                        style={{ width: `${percent(category.amount, data.total)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-pine p-5 text-white">
            <div className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-white/35">Tips pencatatan</div>
            <p className="mt-2 text-[11px] leading-relaxed text-white/60">
              Catat pengeluaran di hari yang sama. Pisahkan pembelian stok dan biaya operasional agar laporan HPP tetap
              akurat dan mudah diaudit.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
