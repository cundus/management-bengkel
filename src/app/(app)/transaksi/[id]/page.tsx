import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Download,
  MapPin,
  MessageCircle,
  Phone,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  Undo2,
  User,
  Wrench,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getTransactionById } from "@/lib/queries/transactions";
import { getSettings } from "@/lib/queries/finance";
import { dueLabel, formatDateID, formatDateTimeID, todayISO } from "@/lib/dates";
import { parseVoidMaxDays, voidWindowCheck } from "@/lib/calculations";
import { formatPhoneForWhatsApp, formatRupiah } from "@/lib/format";
import { PaymentBadge, DueBadge } from "@/components/ui/status-badge";
import { PrintButton, ReceiptButton } from "@/components/transactions/print-button";
import { PaymentForm } from "@/components/transactions/payment-form";
import { ReversePaymentButton } from "@/components/transactions/reverse-payment-form";
import {
  RejectVoidRequestButton,
  RequestVoidButton,
  VoidTransactionButton,
} from "@/components/transactions/void-form";
import { Avatar } from "@/components/ui/avatar";
import { Check } from "lucide-react";

export const metadata: Metadata = { title: "Detail Transaksi" };

export default async function TransactionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { created } = await searchParams;
  const [transaction, settings] = await Promise.all([getTransactionById(id), getSettings()]);
  if (!transaction) notFound();

  const workshopName = settings.workshop_name || "WMC 225";
  const due = dueLabel(transaction.dueDate);
  const phone = formatPhoneForWhatsApp(transaction.customerPhone);
  const reminderMessage = encodeURIComponent(
    `Halo ${transaction.customerName}, kami dari ${workshopName}. Mengingatkan tagihan nota ${transaction.invoiceNo} sebesar ${formatRupiah(
      transaction.remaining,
    )}${transaction.dueDate ? ` dengan jatuh tempo ${formatDateID(transaction.dueDate)}` : ""}. Terima kasih.`,
  );
  const active = transaction.status === "selesai";
  const voidWindow = voidWindowCheck(transaction.businessDate, todayISO(), parseVoidMaxDays(settings.void_max_days));
  const pendingRequest = transaction.voidRequests.find((request) => request.status === "pending") ?? null;
  const lastRequest = transaction.voidRequests[0] ?? null;
  const canVoid = user.role === "owner" && active && voidWindow.ok;
  const canRequestVoid = user.role === "kasir" && active && voidWindow.ok && !pendingRequest;
  const hasSparepart = transaction.items.some((item) => item.category === "sparepart" && item.itemId != null);
  const retained = Math.max(0, transaction.paid - transaction.refunded);
  const paidPercent = Math.min(100, Math.round((transaction.paid / Math.max(transaction.total, 1)) * 100));

  return (
    <div className="animate-fade-up">
      <h1 className="sr-only">Nota {transaction.invoiceNo} untuk {transaction.customerName}</h1>
      <div className="no-print mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/transaksi"
          className="inline-flex items-center gap-1.5 text-[11px] font-bold text-muted transition hover:text-ink"
        >
          <ArrowLeft size={14} /> Kembali ke transaksi
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {phone && transaction.remaining > 0 && (
            <a
              href={`https://wa.me/${phone}?text=${reminderMessage}`}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary"
            >
              <MessageCircle size={15} />
              Tagih via WA
            </a>
          )}
          <a href={`/api/export/nota/${transaction.id}`} className="btn-secondary">
            <Download size={15} />
            <span className="hidden sm:inline">Unduh</span>
          </a>
          <ReceiptButton transactionId={transaction.id} />
          <PrintButton />
          {canVoid && (
            <VoidTransactionButton
              transactionId={transaction.id}
              invoiceNo={transaction.invoiceNo}
              total={transaction.total}
              paid={transaction.paid}
              hasSparepart={hasSparepart}
            />
          )}
          {canRequestVoid && (
            <RequestVoidButton transactionId={transaction.id} invoiceNo={transaction.invoiceNo} total={transaction.total} />
          )}
        </div>
      </div>

      {active && pendingRequest && (
        <div className="no-print mb-4 flex flex-col gap-3 rounded-2xl border border-warning/25 bg-warning-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <Undo2 size={16} className="mt-0.5 shrink-0 text-warning" />
            <div>
              <p className="text-[12px] font-extrabold text-ink">
                {user.role === "owner"
                  ? "Kasir mengajukan pembatalan nota ini"
                  : "Pengajuan pembatalan menunggu persetujuan pemilik"}
              </p>
              <p className="mt-0.5 text-[10.5px] font-medium text-muted">
                &ldquo;{pendingRequest.reason}&rdquo; · {pendingRequest.requestedByName} ·{" "}
                {formatDateTimeID(pendingRequest.requestedAt)} WIB
              </p>
              {user.role === "owner" && !voidWindow.ok && (
                <p className="mt-1 text-[10px] font-semibold text-danger">{voidWindow.message}</p>
              )}
            </div>
          </div>
          {user.role === "owner" && (
            <div className="flex shrink-0 items-center gap-2">
              <RejectVoidRequestButton requestId={pendingRequest.id} invoiceNo={transaction.invoiceNo} />
              {voidWindow.ok && (
                <VoidTransactionButton
                  transactionId={transaction.id}
                  invoiceNo={transaction.invoiceNo}
                  total={transaction.total}
                  paid={transaction.paid}
                  hasSparepart={hasSparepart}
                  defaultReason={pendingRequest.reason}
                  approving
                />
              )}
            </div>
          )}
        </div>
      )}

      {active && !pendingRequest && lastRequest?.status === "ditolak" && (
        <div className="no-print mb-4 flex items-start gap-2.5 rounded-2xl border border-line bg-[#fbf9f4] px-4 py-3">
          <Undo2 size={16} className="mt-0.5 shrink-0 text-faint" />
          <div>
            <p className="text-[12px] font-extrabold text-ink">Pengajuan pembatalan ditolak</p>
            <p className="mt-0.5 text-[10.5px] font-medium text-muted">
              {lastRequest.reviewedByName ?? "Pemilik"}
              {lastRequest.reviewedAt ? ` · ${formatDateTimeID(lastRequest.reviewedAt)} WIB` : ""}
              {lastRequest.reviewNote ? ` · ${lastRequest.reviewNote}` : ""}
            </p>
          </div>
        </div>
      )}

      {created === "1" && (
        <div className="no-print mb-4 flex flex-col gap-3 rounded-2xl border border-success/20 bg-success-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-success" />
            <div>
              <p className="text-[12px] font-extrabold text-success">Transaksi berhasil disimpan</p>
              <p className="mt-0.5 text-[10.5px] font-medium text-success/75">
                Stok sudah diperbarui. Nota siap dicetak atau dibagikan ke pelanggan.
              </p>
            </div>
          </div>
          <ReceiptButton transactionId={transaction.id} variant="primary" />
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <div className="card relative overflow-hidden print:border-0">
          {transaction.status === "batal" && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden"
            >
              <span className="-rotate-[24deg] rounded-2xl border-[6px] border-danger/25 px-8 py-2 font-display text-[4.5rem] font-extrabold tracking-[0.2em] text-danger/20 sm:text-[6rem]">
                BATAL
              </span>
            </div>
          )}
          <div className="relative overflow-hidden border-b border-line bg-[#fbf9f4] px-5 py-6 sm:px-8 sm:py-7">
            <div className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full border-[22px] border-brand/10" />
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-pine font-display text-[16px] font-extrabold text-lime">
                    P
                  </div>
                  <div>
                    <div className="font-display text-[17px] font-extrabold tracking-tight text-ink">{workshopName}</div>
                    <div className="mt-0.5 flex items-center gap-1 text-[9px] font-medium text-faint">
                      <MapPin size={9} /> {settings.workshop_address || "Bandung"}
                    </div>
                  </div>
                </div>
                <p className="mt-4 max-w-xs text-[10px] leading-relaxed text-muted">
                  {settings.workshop_tagline || "Servis jujur, harga transparan."}
                </p>
              </div>
              <div className="sm:text-right">
                <div className="eyebrow">Nota servis</div>
                <div className="mt-1 font-mono text-[13px] font-extrabold text-ink">{transaction.invoiceNo}</div>
                <div className="mt-2 flex items-center gap-1.5 sm:justify-end">
                  <PaymentBadge status={transaction.paymentStatus} />
                  {transaction.status === "batal" && <span className="badge-danger">Dibatalkan</span>}
                </div>
                <div className="mt-2 text-[9.5px] font-medium text-faint">
                  {formatDateTimeID(transaction.createdAt)} WIB
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-5 border-b border-line px-5 py-5 sm:grid-cols-2 sm:px-8">
            <div>
              <div className="eyebrow mb-2">Ditagihkan kepada</div>
              <div className="flex items-center gap-2.5">
                <Avatar name={transaction.customerName} size="sm" />
                <div>
                  <div className="text-[12.5px] font-extrabold text-ink">{transaction.customerName}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted">
                    <Phone size={10} /> {transaction.customerPhone || "—"}
                  </div>
                </div>
              </div>
              {transaction.customerAddress && (
                <div className="mt-2.5 flex items-start gap-1 text-[10px] leading-relaxed text-muted">
                  <MapPin size={10} className="mt-0.5 shrink-0" /> {transaction.customerAddress}
                </div>
              )}
            </div>
            <div className="sm:border-l sm:border-line sm:pl-5">
              <div className="eyebrow mb-2">Kendaraan</div>
              {transaction.vehicle ? (
                <>
                  <div className="inline-flex rounded-md border border-line bg-white px-2 py-1 font-mono text-[11px] font-extrabold tracking-wider text-ink">
                    {transaction.vehicle.plateNumber}
                  </div>
                  <div className="mt-2 text-[11.5px] font-bold text-ink">
                    {transaction.vehicle.brand} {transaction.vehicle.model}
                    {transaction.vehicle.year ? ` · ${transaction.vehicle.year}` : ""}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-2 text-[9.5px] font-medium text-faint">
                    {transaction.vehicle.color && <span>Warna {transaction.vehicle.color}</span>}
                    {transaction.vehicle.odometer != null && (
                      <span>{transaction.vehicle.odometer.toLocaleString("id-ID")} km</span>
                    )}
                    {transaction.mechanic && <span>Mekanik: {transaction.mechanic}</span>}
                  </div>
                </>
              ) : (
                <div className="text-[11px] text-faint">Tidak ada kendaraan</div>
              )}
            </div>
          </div>

          <div className="px-5 py-5 sm:px-8">
            <div className="mb-3 flex items-center justify-between">
              <div className="eyebrow">Rincian pekerjaan</div>
              <span className="text-[9px] font-semibold text-faint">{transaction.items.length} baris</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] border-separate border-spacing-0 text-left">
                <thead>
                  <tr>
                    <th className="border-b border-line pb-2 text-[9px] font-extrabold uppercase tracking-wider text-faint">
                      Item
                    </th>
                    <th className="border-b border-line pb-2 text-center text-[9px] font-extrabold uppercase tracking-wider text-faint">
                      Qty
                    </th>
                    <th className="border-b border-line pb-2 text-right text-[9px] font-extrabold uppercase tracking-wider text-faint">
                      Harga
                    </th>
                    <th className="border-b border-line pb-2 text-right text-[9px] font-extrabold uppercase tracking-wider text-faint">
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transaction.items.map((item) => (
                    <tr key={item.id}>
                      <td className="border-b border-line/60 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex size-6 items-center justify-center rounded-md ${
                              item.category === "jasa" ? "bg-[#eef1e7] text-[#4b6143]" : "bg-[#f6e8e2] text-[#a54a2d]"
                            }`}
                          >
                            {item.category === "jasa" ? <Wrench size={11} /> : <ReceiptText size={11} />}
                          </span>
                          <div>
                            <div className="text-[11.5px] font-bold text-ink">{item.name}</div>
                            {item.stockBatchCode && <div className="text-[10px] text-muted">Batch {item.stockBatchCode}</div>}
                            <div className="text-[9px] font-medium capitalize text-faint">{item.category}</div>
                          </div>
                        </div>
                      </td>
                      <td className="border-b border-line/60 py-3 text-center text-[11px] font-semibold text-muted tabular">
                        {item.qty}
                      </td>
                      <td className="border-b border-line/60 py-3 text-right text-[11px] text-muted tabular">
                        {formatRupiah(item.unitPrice)}
                      </td>
                      <td className="border-b border-line/60 py-3 text-right text-[11px] font-extrabold text-ink tabular">
                        {formatRupiah(item.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex justify-end">
              <div className="w-full max-w-[280px] space-y-2">
                <div className="flex justify-between text-[11px] text-muted">
                  <span>Subtotal</span>
                  <span className="font-semibold tabular">{formatRupiah(transaction.subtotal)}</span>
                </div>
                {transaction.discount > 0 && (
                  <div className="flex justify-between text-[11px] text-muted">
                    <span>Diskon</span>
                    <span className="font-semibold text-success tabular">−{formatRupiah(transaction.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-line pt-2.5">
                  <span className="text-[12px] font-extrabold text-ink">Total</span>
                  <span className="font-display text-[1.4rem] font-extrabold tracking-tight text-ink tabular">
                    {formatRupiah(transaction.total)}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-muted">
                  <span>Dibayar</span>
                  <span className="font-semibold text-success tabular">{formatRupiah(transaction.paid)}</span>
                </div>
                {transaction.remaining > 0 && (
                  <div className="flex justify-between rounded-lg bg-danger-soft px-2.5 py-2 text-[11px] text-danger">
                    <span className="font-bold">Sisa tagihan</span>
                    <span className="font-extrabold tabular">{formatRupiah(transaction.remaining)}</span>
                  </div>
                )}
              </div>
            </div>

            {transaction.notes && (
              <div className="mt-5 rounded-xl bg-[#fbf9f4] px-4 py-3">
                <div className="text-[9px] font-extrabold uppercase tracking-wider text-faint">Catatan</div>
                <p className="mt-1 text-[10.5px] leading-relaxed text-muted">{transaction.notes}</p>
              </div>
            )}

            <div className="mt-7 border-t border-dashed border-line pt-4 text-center">
              <p className="text-[9.5px] leading-relaxed text-faint">
                {settings.invoice_note || "Terima kasih sudah mempercayakan kendaraan Anda kepada kami."}
              </p>
              <p className="mt-1.5 text-[8.5px] font-semibold text-faint/70">
                Dicetak dari WMC 225 · {formatDateID(transaction.businessDate)} · dibuat oleh {transaction.createdByName}
              </p>
            </div>
          </div>
        </div>

        <aside className="no-print space-y-4 xl:sticky xl:top-5">
          <section className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-extrabold text-ink">Status pembayaran</h2>
              <PaymentBadge status={transaction.paymentStatus} />
            </div>

            <div className="mt-4">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-faint">Sisa tagihan</div>
                  <div className="mt-1 font-display text-[1.65rem] font-extrabold tracking-tight tabular">
                    {formatRupiah(transaction.remaining)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-semibold text-faint">Terbayar</div>
                  <div className="text-[12px] font-extrabold text-success tabular">
                    {formatRupiah(transaction.paid)}
                  </div>
                </div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#efe9de]">
                <div className="h-full rounded-full bg-success" style={{ width: `${paidPercent}%` }} />
              </div>
              <div className="mt-1.5 flex justify-between text-[9px] font-semibold text-faint">
                <span>{paidPercent}% terbayar</span>
                <span>dari {formatRupiah(transaction.total)}</span>
              </div>
            </div>

            {transaction.dueDate && transaction.remaining > 0 && (
              <div className="mt-4 flex items-center justify-between rounded-xl border border-line bg-[#fbf9f4] px-3 py-2.5">
                <div className="flex items-center gap-2 text-[10px] font-bold text-muted">
                  <CalendarClock size={13} /> Jatuh tempo
                </div>
                <DueBadge label={due.label} tone={due.tone} />
              </div>
            )}

            {transaction.remaining > 0 && transaction.status !== "batal" ? (
              <div className="mt-5 border-t border-line pt-5">
                <div className="mb-3 flex items-center gap-2">
                  <Clock3 size={13} className="text-brand" />
                  <h3 className="text-[11.5px] font-extrabold text-ink">Catat pembayaran baru</h3>
                </div>
                <PaymentForm transactionId={transaction.id} remaining={transaction.remaining} defaultMethod="tunai" />
              </div>
            ) : transaction.status !== "batal" ? (
              <div className="mt-5 flex items-center gap-2 rounded-xl bg-success-soft px-3.5 py-3">
                <span className="flex size-7 items-center justify-center rounded-full bg-success text-white">
                  <Check size={14} strokeWidth={3} />
                </span>
                <div>
                  <div className="text-[11px] font-extrabold text-success">Pembayaran lunas</div>
                  <div className="text-[9.5px] font-medium text-success/70">Tidak ada sisa tagihan.</div>
                </div>
              </div>
            ) : (
              <div className="mt-5 space-y-2 rounded-xl bg-[#f2eee6] px-3.5 py-3 text-[10.5px] text-muted">
                <p className="font-semibold">
                  Transaksi dibatalkan{transaction.voidReason ? `: ${transaction.voidReason}` : "."}
                </p>
                {(transaction.voidedByName || transaction.voidedAt) && (
                  <p className="text-[9.5px] text-faint">
                    {transaction.voidedByName ? `Oleh ${transaction.voidedByName}` : ""}
                    {transaction.voidedAt ? ` · ${formatDateTimeID(transaction.voidedAt)} WIB` : ""}
                  </p>
                )}
                {transaction.paid > 0 && (
                  <div className="space-y-1 border-t border-line pt-2">
                    <div className="flex justify-between">
                      <span>Dikembalikan ke pelanggan</span>
                      <span className="font-extrabold text-danger tabular">{formatRupiah(transaction.refunded)}</span>
                    </div>
                    {retained > 0 && (
                      <div className="flex justify-between">
                        <span>Pendapatan pembatalan</span>
                        <span className="font-extrabold text-ink tabular">{formatRupiah(retained)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {phone && (
              <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer" className="btn-secondary mt-3 w-full text-[11px]">
                <MessageCircle size={14} /> Hubungi pelanggan
              </a>
            )}
          </section>

          <section className="card p-5">
            <h2 className="mb-3 flex items-center gap-2 text-[12px] font-extrabold text-ink">
              <ReceiptText size={14} className="text-muted" /> Riwayat pembayaran
            </h2>
            {transaction.refunds.length > 0 && (
              <div className="mb-4 space-y-3 border-b border-line pb-4">
                {transaction.refunds.map((refund) => (
                  <div key={refund.id} className="flex gap-3">
                    <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
                      <RotateCcw size={12} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[11px] font-extrabold text-danger tabular">
                          −{formatRupiah(refund.amount)}
                        </span>
                        <span className="text-[9px] font-semibold capitalize text-faint">Refund · {refund.method}</span>
                      </div>
                      <div className="mt-0.5 text-[9px] font-medium text-faint">
                        {formatDateID(refund.businessDate)} · oleh {refund.createdByName}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {transaction.payments.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line px-3 py-5 text-center text-[10px] text-faint">
                Belum ada pembayaran.
              </p>
            ) : (
              <div className="space-y-0">
                {transaction.payments.map((payment, index) => {
                  const isReversal = payment.reversesPaymentId !== null;
                  return (
                    <div key={payment.id} className="relative flex gap-3 pb-4 last:pb-0">
                      {index < transaction.payments.length - 1 && (
                        <div className="absolute left-[11px] top-6 h-full w-px bg-line" />
                      )}
                      <div
                        className={`relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-surface ${
                          isReversal ? "bg-danger-soft text-danger" : payment.reversed ? "bg-[#f2eee6] text-faint" : "bg-success-soft text-success"
                        }`}
                      >
                        {isReversal ? <Undo2 size={12} /> : <CheckCircle2 size={12} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span
                            className={`text-[11px] font-extrabold tabular ${
                              isReversal ? "text-danger" : payment.reversed ? "text-faint line-through" : "text-ink"
                            }`}
                          >
                            {isReversal ? `−${formatRupiah(-payment.amount)}` : formatRupiah(payment.amount)}
                          </span>
                          <span className="text-[9px] font-semibold capitalize text-faint">
                            {isReversal ? `Koreksi · ${payment.method}` : payment.reversed ? `${payment.method} · dibalik` : payment.method}
                          </span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center justify-between gap-x-2 text-[9px] font-medium text-faint">
                          <span>
                            {formatDateID(payment.businessDate)} · oleh {payment.receivedByName}
                          </span>
                          {user.role === "owner" && active && !isReversal && !payment.reversed && (
                            <ReversePaymentButton
                              transactionId={transaction.id}
                              paymentId={payment.id}
                              amount={payment.amount}
                              method={payment.method}
                              businessDate={payment.businessDate}
                            />
                          )}
                        </div>
                        {payment.notes && <div className="mt-0.5 text-[9px] italic text-faint">“{payment.notes}”</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div className="space-y-3 px-1">
            <div className="flex items-start gap-2 rounded-xl border border-line bg-surface/60 px-3.5 py-3">
              <ShieldCheck size={14} className="mt-0.5 shrink-0 text-success" />
              <p className="text-[9.5px] leading-relaxed text-muted">
                Setiap pembayaran tercatat permanen dan otomatis memperbarui laporan pendapatan. Salah input dikoreksi dengan entri pembalik, bukan dihapus.
              </p>
            </div>
            <div className="flex items-center justify-center gap-1.5 text-[9px] font-semibold text-faint">
              <User size={10} /> Nota dibuat oleh {transaction.createdByName}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
