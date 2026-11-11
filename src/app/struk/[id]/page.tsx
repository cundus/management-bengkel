import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getTransactionById } from "@/lib/queries/transactions";
import { getSettings } from "@/lib/queries/finance";
import { formatDateTimeID } from "@/lib/dates";
import { formatNumber } from "@/lib/format";
import { ReceiptToolbar } from "@/components/transactions/receipt-toolbar";

export const metadata: Metadata = { title: "Struk" };
export const dynamic = "force-dynamic";

const PAYMENT_LABEL: Record<string, string> = {
  lunas: "LUNAS",
  sebagian: "DIBAYAR SEBAGIAN",
  belum_bayar: "BELUM DIBAYAR",
};

function rp(value: number) {
  return formatNumber(Math.round(value));
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-2 ${bold ? "font-bold" : ""}`}>
      <span>{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function Divider() {
  return <div className="my-1.5 border-t border-dashed border-black" />;
}

export default async function ReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ w?: string; print?: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const { w, print } = await searchParams;
  const [transaction, settings] = await Promise.all([getTransactionById(id), getSettings()]);
  if (!transaction) notFound();

  const width: 58 | 80 = w === "80" ? 80 : 58;
  const workshopName = settings.workshop_name || "WMC 225";
  const voided = transaction.status === "batal";
  const methods = [
    ...new Set(
      transaction.payments
        .filter((payment) => payment.reversesPaymentId === null && !payment.reversed)
        .map((payment) => payment.method),
    ),
  ];
  const base = `/struk/${transaction.id}`;

  return (
    <div className="min-h-dvh bg-[#ece8df] px-4 py-6 print:min-h-0 print:bg-white print:p-0">
      <style>{`
        @page { size: ${width}mm auto; margin: 0; }
        @media print {
          html, body { background: #fff !important; width: ${width}mm; }
        }
      `}</style>

      <ReceiptToolbar
        backHref={`/transaksi/${transaction.id}`}
        width={width}
        autoPrint={print === "1"}
        widthHrefs={{ 58: `${base}?w=58`, 80: `${base}?w=80` }}
      />

      <article
        className="mx-auto bg-white font-mono text-black shadow-md print:shadow-none"
        style={{
          width: `${width}mm`,
          padding: width === 58 ? "3mm 2.5mm" : "4mm 4mm",
          fontSize: width === 58 ? "10px" : "11.5px",
          lineHeight: 1.35,
        }}
      >
        <header className="text-center">
          <div className="text-[1.3em] font-bold uppercase">{workshopName}</div>
          {settings.workshop_address && <div>{settings.workshop_address}</div>}
          {settings.workshop_phone && <div>Telp. {settings.workshop_phone}</div>}
        </header>

        <Divider />

        <div>
          <Row label="No" value={transaction.invoiceNo} />
          <Row label="Tgl" value={formatDateTimeID(transaction.createdAt)} />
          <Row label="Kasir" value={transaction.createdByName} />
          <Row label="Plg" value={transaction.customerName} />
          {transaction.vehicle && (
            <Row
              label="Kend"
              value={`${transaction.vehicle.plateNumber}${
                transaction.vehicle.odometer != null ? ` · ${formatNumber(transaction.vehicle.odometer)}km` : ""
              }`}
            />
          )}
          {transaction.mechanic && <Row label="Mekanik" value={transaction.mechanic} />}
        </div>

        {voided && (
          <>
            <Divider />
            <div className="text-center text-[1.2em] font-bold">*** DIBATALKAN ***</div>
          </>
        )}

        <Divider />

        <div className="space-y-1">
          {transaction.items.map((item) => (
            <div key={item.id}>
              <div className="break-words">{item.name}</div>
              <div className="flex justify-between gap-2">
                <span>
                  {item.qty} x {rp(item.unitPrice)}
                </span>
                <span>{rp(item.subtotal)}</span>
              </div>
            </div>
          ))}
        </div>

        <Divider />

        <div>
          <Row label="Subtotal" value={rp(transaction.subtotal)} />
          {transaction.discount > 0 && <Row label="Diskon" value={`-${rp(transaction.discount)}`} />}
          <div className="text-[1.15em]">
            <Row label="TOTAL" value={`Rp${rp(transaction.total)}`} bold />
          </div>
          <Row label={`Bayar${methods.length ? ` (${methods.join("/")})` : ""}`} value={rp(transaction.paid)} />
          {transaction.remaining > 0 && <Row label="Sisa" value={rp(transaction.remaining)} bold />}
          {voided && transaction.refunded > 0 && <Row label="Refund" value={rp(transaction.refunded)} />}
        </div>

        {!voided && (
          <div className="mt-1.5 text-center font-bold">
            {PAYMENT_LABEL[transaction.paymentStatus] ?? transaction.paymentStatus}
          </div>
        )}

        {transaction.notes && (
          <>
            <Divider />
            <div className="break-words">Catatan: {transaction.notes}</div>
          </>
        )}

        <Divider />

        <footer className="text-center">
          <div>{settings.invoice_note || "Terima kasih atas kepercayaan Anda."}</div>
        </footer>
        <div className="h-[6mm] print:h-[10mm]" />
      </article>
    </div>
  );
}
