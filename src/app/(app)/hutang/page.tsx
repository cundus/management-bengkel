import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  Landmark,
  MessageCircle,
  Phone,
  Undo2,
} from "lucide-react";
import { requireOwner } from "@/lib/auth";
import { getPayableSummary, listPayables, listSuppliers } from "@/lib/queries/finance";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { DueBadge } from "@/components/ui/status-badge";
import {
  PayableDialog,
  PayablePaymentDialog,
  ReversePayablePaymentDialog,
  SupplierDialog,
} from "@/components/finance/payable-dialogs";
import { dueLabel, formatDateID } from "@/lib/dates";
import { formatPhoneForWhatsApp, formatRupiah, percent } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Hutang Supplier" };

export default async function PayablesPage({ searchParams }: { searchParams: Promise<{ semua?: string }> }) {
  await requireOwner();
  const includePaid = (await searchParams).semua === "1";
  const [payables, summary, suppliers] = await Promise.all([
    listPayables({ includePaid }),
    getPayableSummary(),
    listSuppliers(),
  ]);
  const overduePercent = percent(summary.overdue, summary.total);

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="Kewajiban usaha"
        title="Hutang supplier"
        description="Catat tagihan supplier dan pembayarannya. Semua kewajiban terpantau agar arus kas tetap sehat."
        actions={
          <>
            <SupplierDialog />
            <Link href="/pembelian/baru" className="btn-primary">Pembelian baru</Link>
            <PayableDialog suppliers={suppliers} />
          </>
        }
      />

      <section className="grid gap-3 sm:grid-cols-3 sm:gap-4">
        <div className="relative overflow-hidden rounded-3xl bg-pine p-5 text-white sm:col-span-2 sm:p-6">
          <div className="dot-grid pointer-events-none absolute inset-0 opacity-20 [mask-image:linear-gradient(120deg,black,transparent_75%)]" />
          <div className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full border-[38px] border-brand/20" />
          <div className="relative flex h-full flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
                <Landmark size={14} className="text-lime" /> Sisa hutang supplier
              </div>
              <div className="mt-2 font-display text-[2.2rem] font-extrabold leading-none tracking-[-0.05em] tabular sm:text-[2.8rem]">
                {formatRupiah(summary.total)}
              </div>
              <div className="mt-2 text-[11px] font-medium text-white/40">
                {summary.count} tagihan terbuka · {summary.overdueCount} lewat jatuh tempo
              </div>
            </div>
            <div className="flex gap-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5">
                <div className="text-[9px] font-bold text-white/40">Jatuh tempo</div>
                <div className="mt-1 text-[14px] font-extrabold text-[#ffb59d] tabular">{formatRupiah(summary.overdue)}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5">
                <div className="text-[9px] font-bold text-white/40">Dibayar bulan ini</div>
                <div className="mt-1 text-[14px] font-extrabold text-lime tabular">{formatRupiah(summary.paidThisMonth)}</div>
              </div>
            </div>
          </div>
          {summary.total > 0 && (
            <div className="relative mt-5">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-brand" style={{ width: `${overduePercent}%` }} />
              </div>
              <p className="mt-1.5 text-[9px] font-semibold text-white/35">
                {overduePercent}% dari hutang sudah melewati jatuh tempo
              </p>
            </div>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[12px] font-extrabold text-ink">Supplier terdaftar</h2>
            <Building2 size={15} className="text-faint" />
          </div>
          <div className="mt-3 space-y-2">
            {suppliers.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line px-3 py-5 text-center text-[10px] text-faint">
                Belum ada supplier.
              </p>
            ) : (
              suppliers.map((supplier) => {
                const phone = formatPhoneForWhatsApp(supplier.phone);
                return (
                  <div key={supplier.id} className="flex items-center gap-2 rounded-lg border border-line/70 bg-[#fbf9f4] px-2.5 py-2">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-white font-display text-[9px] font-extrabold text-muted">
                      {supplier.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[10.5px] font-bold text-ink">{supplier.name}</div>
                      <div className="truncate text-[9px] font-medium text-faint">{supplier.contactPerson || "—"}</div>
                    </div>
                    {phone && (
                      <a
                        href={`https://wa.me/${phone}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex size-6 items-center justify-center rounded-md text-faint hover:bg-white hover:text-success"
                        aria-label={`Hubungi ${supplier.name}`}
                      >
                        <MessageCircle size={12} />
                      </a>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {summary.overdueCount > 0 && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-danger/15 bg-danger-soft px-4 py-3.5">
          <AlertTriangle size={17} className="mt-0.5 shrink-0 text-danger" />
          <div>
            <p className="text-[12px] font-extrabold text-danger">{summary.overdueCount} hutang supplier lewat jatuh tempo</p>
            <p className="mt-0.5 text-[10.5px] font-medium text-danger/75">
              Total {formatRupiah(summary.overdue)}. Hubungi supplier untuk konfirmasi atau jadwalkan pembayaran.
            </p>
          </div>
        </div>
      )}

      <div className="card mt-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <div className="eyebrow">Daftar kewajiban</div>
            <h2 className="mt-1 section-title">{includePaid ? "Semua tagihan" : "Hutang berjalan"}</h2>
            <Link href={includePaid ? "/hutang" : "/hutang?semua=1"} className="text-xs font-bold text-pine underline">{includePaid ? "Hanya belum lunas" : "Lihat juga yang lunas"}</Link>
          </div>
          <span className="badge-neutral">{payables.length} tagihan</span>
        </div>

        {payables.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="Tidak ada hutang berjalan"
            description="Semua tagihan supplier sudah lunas. Kewajiban baru akan muncul di sini."
          />
        ) : (
          <div className="divide-y divide-line/70">
            {payables.map((payable) => {
              const due = dueLabel(payable.dueDate);
              const paidPercent = percent(payable.paid, payable.amount);
              const phone = formatPhoneForWhatsApp(payable.supplierPhone);
              return (
                <div key={payable.id} id={`tagihan-${payable.id}`} className="scroll-mt-24 p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#eef0ea] font-display text-[10px] font-extrabold text-pine">
                        {payable.supplierName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[12.5px] font-extrabold text-ink">{payable.supplierName}</span>
                          {due.tone === "overdue" && (
                            <span className="badge-danger">
                              <AlertTriangle size={9} /> Telat
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[11px] font-medium text-muted">{payable.description}</div>
                        {payable.purchaseId && <Link href={`/pembelian/${payable.purchaseId}`} className="text-xs font-bold text-pine underline">Lihat pembelian PB-{String(payable.purchaseId).padStart(5, "0")}</Link>}
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] font-medium text-faint">
                          {payable.referenceNo && <span className="font-mono">{payable.referenceNo}</span>}
                          <span>·</span>
                          <span>Dibuat {formatDateID(payable.businessDate)}</span>
                          {payable.dueDate && (
                            <>
                              <span>·</span>
                              <DueBadge label={`JT ${formatDateID(payable.dueDate)}`} tone={due.tone} />
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-end justify-between gap-4 sm:justify-end">
                      <div className="text-left sm:text-right">
                        <div className="font-display text-[15px] font-extrabold tracking-tight text-ink tabular">
                          {formatRupiah(payable.remaining)}
                        </div>
                        <div className="mt-0.5 text-[9px] font-medium text-faint">
                          dari {formatRupiah(payable.amount)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {phone && (
                          <a
                            href={`https://wa.me/${phone}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-secondary btn-sm"
                            aria-label={`Hubungi ${payable.supplierName}`}
                          >
                            <Phone size={12} />
                          </a>
                        )}
                        {payable.remaining > 0 ? <PayablePaymentDialog payableId={payable.id} supplierName={payable.supplierName} remaining={payable.remaining} /> : <span className="badge-success">Lunas</span>}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2.5">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#efe9de]">
                      <div className={cn("h-full rounded-full", paidPercent > 0 ? "bg-success" : "bg-line-strong")} style={{ width: `${paidPercent}%` }} />
                    </div>
                    <span className="whitespace-nowrap text-[9px] font-semibold text-faint">{paidPercent}% dibayar</span>
                  </div>

                  {payable.payments.length > 0 && (
                    <details className="mt-2.5">
                      <summary className="cursor-pointer text-[9.5px] font-bold text-brand hover:text-brand-dark">
                        {payable.payments.length} entri pembayaran tercatat
                      </summary>
                      <div className="mt-2 space-y-1.5 rounded-lg bg-[#fbf9f4] px-3 py-2">
                        {payable.payments.map((payment) => {
                          const isReversal = payment.reversesPaymentId !== null;
                          const canReverse = !isReversal && !payment.reversed;
                          return (
                            <div key={payment.id} className="text-[9.5px]">
                              <div className="flex items-center justify-between gap-2">
                                <span className="flex items-center gap-1.5 font-medium text-muted">
                                  {isReversal ? (
                                    <Undo2 size={10} className="text-danger" />
                                  ) : (
                                    <ArrowUpRight size={10} className={payment.reversed ? "text-faint" : "text-success"} />
                                  )}
                                  {formatDateID(payment.businessDate)} · {payment.method}
                                  {isReversal ? " · koreksi" : payment.reversed ? " · dibalik" : ""}
                                </span>
                                <span
                                  className={cn(
                                    "font-extrabold tabular",
                                    isReversal ? "text-danger" : payment.reversed ? "text-faint line-through" : "text-ink",
                                  )}
                                >
                                  {isReversal ? `−${formatRupiah(-payment.amount)}` : formatRupiah(payment.amount)}
                                </span>
                              </div>
                              {(payment.notes || canReverse) && (
                                <div className="mt-0.5 flex items-center justify-between gap-2 pl-4 text-[9px] text-faint">
                                  <span className="italic">{payment.notes}</span>
                                  {canReverse && (
                                    <ReversePayablePaymentDialog
                                      paymentId={payment.id}
                                      amount={payment.amount}
                                      method={payment.method}
                                      businessDate={payment.businessDate}
                                    />
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="border-t border-line px-4 py-3 text-[10px] font-medium text-faint sm:px-5">
          Pembayaran hutang tidak dihitung sebagai biaya baru; ia mengurangi kas dan kewajiban usaha.
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-line bg-surface/60 px-4 py-3">
        <CalendarClock size={14} className="mt-0.5 shrink-0 text-brand" />
        <p className="text-[10px] leading-relaxed text-muted">
          Catat hutang saat barang diterima, bukan saat dibayar. Ini membantu kamu tahu total kewajiban yang sebenarnya
          dan menghindari kejutan arus kas.
        </p>
      </div>
    </div>
  );
}
