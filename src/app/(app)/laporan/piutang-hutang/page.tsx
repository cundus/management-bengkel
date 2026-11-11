import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, CalendarClock, CircleDollarSign, HandCoins, Landmark, Scale } from "lucide-react";
import { requireOwner } from "@/lib/auth";
import { getReceivablesPayablesReport, type BalanceSide, DUE_SOON_DAYS } from "@/lib/queries/receivables-payables";
import { passthroughPeriodQuery, type ReportSearchParams } from "@/lib/report-period";
import { ReportHeader } from "@/components/reports/report-header";
import { formatDateID } from "@/lib/dates";
import { formatRupiah, percent } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Laporan Piutang & Hutang" };

const AGING_COLORS = ["bg-success", "bg-warning", "bg-brand", "bg-danger"];
const LIST_LIMIT = 10;

function SideSummary({
  title,
  eyebrow,
  side,
  icon: Icon,
  manageHref,
  manageLabel,
}: {
  title: string;
  eyebrow: string;
  side: BalanceSide;
  icon: typeof HandCoins;
  manageHref: string;
  manageLabel: string;
}) {
  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h2 className="mt-1 section-title">{title}</h2>
        </div>
        <Icon size={18} className="text-faint" />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2.5">
        <div className="rounded-xl bg-[#fbf9f4] px-3 py-2.5">
          <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-faint">Total</div>
          <div className="mt-0.5 text-[12px] font-extrabold text-ink tabular">{formatRupiah(side.total)}</div>
          <div className="text-[9px] font-medium text-faint">{side.count} tagihan</div>
        </div>
        <div className="rounded-xl bg-danger-soft px-3 py-2.5">
          <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-danger/70">Lewat tempo</div>
          <div className="mt-0.5 text-[12px] font-extrabold text-danger tabular">{formatRupiah(side.overdue)}</div>
          <div className="text-[9px] font-medium text-danger/60">{side.overdueCount} tagihan</div>
        </div>
        <div className="rounded-xl bg-warning-soft px-3 py-2.5">
          <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-warning/80">{DUE_SOON_DAYS} hari ke depan</div>
          <div className="mt-0.5 text-[12px] font-extrabold text-warning tabular">{formatRupiah(side.dueSoon)}</div>
          <div className="text-[9px] font-medium text-warning/70">{side.dueSoonCount} tagihan</div>
        </div>
      </div>

      <h3 className="mt-5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-faint">Umur tagihan</h3>
      {side.total > 0 && (
        <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-[#efe9de]">
          {side.aging.map((bucket, index) => (
            <div
              key={bucket.key}
              className={cn("h-full", AGING_COLORS[index])}
              style={{ width: `${percent(bucket.total, side.total)}%` }}
              title={`${bucket.label}: ${formatRupiah(bucket.total)}`}
            />
          ))}
        </div>
      )}
      <div className="mt-3 space-y-2">
        {side.aging.map((bucket, index) => (
          <div key={bucket.key} className="flex items-center justify-between text-[10.5px]">
            <span className="flex items-center gap-2 font-semibold text-muted">
              <span className={cn("size-2 rounded-full", AGING_COLORS[index])} />
              {bucket.key === "lancar" ? bucket.label : `Lewat ${bucket.label}`}
              <span className="text-[9px] text-faint">({bucket.count})</span>
            </span>
            <span className="font-extrabold text-ink tabular">{formatRupiah(bucket.total)}</span>
          </div>
        ))}
      </div>

      <Link href={manageHref} className="btn-secondary mt-5 w-full text-[11px]">
        {manageLabel}
      </Link>
    </div>
  );
}

function PartyTable({ title, partyLabel, side, emptyText }: { title: string; partyLabel: string; side: BalanceSide; emptyText: string }) {
  return (
    <div className="card p-5 sm:p-6">
      <div className="eyebrow">Konsentrasi</div>
      <h2 className="mt-1 section-title">{title}</h2>
      {side.parties.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line px-4 py-6 text-center text-[10px] text-faint">{emptyText}</p>
      ) : (
        <div className="table-wrap mt-3">
          <table className="data-table min-w-[420px]">
            <thead>
              <tr>
                <th>{partyLabel}</th>
                <th className="text-center">Tagihan</th>
                <th className="text-right">Sisa</th>
                <th className="text-right">Lewat tempo</th>
              </tr>
            </thead>
            <tbody>
              {side.parties.slice(0, LIST_LIMIT).map((party) => (
                <tr key={party.key}>
                  <td className="max-w-[180px] truncate text-[11px] font-semibold text-ink">{party.name}</td>
                  <td className="text-center text-[11px] text-muted tabular">{party.count}</td>
                  <td className="text-right text-[11px] font-bold text-ink tabular">{formatRupiah(party.total)}</td>
                  <td className={cn("text-right text-[11px] font-semibold tabular", party.overdue > 0 ? "text-danger" : "text-faint")}>
                    {party.overdue > 0 ? formatRupiah(party.overdue) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {side.parties.length > LIST_LIMIT && (
            <div className="mt-2 text-[9.5px] font-medium text-faint">
              +{side.parties.length - LIST_LIMIT} lainnya — lihat lengkapnya di ekspor CSV.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OverdueTable({ title, side, emptyText }: { title: string; side: BalanceSide; emptyText: string }) {
  return (
    <div className="card p-5 sm:p-6">
      <div className="eyebrow">Prioritas tindak lanjut</div>
      <h2 className="mt-1 section-title">{title}</h2>
      {side.overdueRows.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line px-4 py-6 text-center text-[10px] text-faint">{emptyText}</p>
      ) : (
        <div className="mt-3 divide-y divide-line/70">
          {side.overdueRows.slice(0, LIST_LIMIT).map((row) => (
            <Link key={row.id} href={row.href} className="flex items-center gap-3 py-2.5 transition hover:bg-[#faf7f1]">
              <span className="flex w-12 shrink-0 flex-col items-center rounded-md bg-danger-soft py-1 text-danger">
                <span className="text-[11px] font-extrabold leading-none tabular">{row.daysOverdue}</span>
                <span className="text-[8px] font-bold">hari</span>
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11.5px] font-bold text-ink">{row.partyName}</div>
                <div className="truncate text-[9px] font-medium text-faint">
                  {row.reference} · jatuh tempo {formatDateID(row.dueDate!)}
                </div>
              </div>
              <div className="text-[11px] font-extrabold text-ink tabular">{formatRupiah(row.remaining)}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function ReceivablesPayablesPage({ searchParams }: { searchParams: Promise<ReportSearchParams> }) {
  await requireOwner();
  const tabQuery = passthroughPeriodQuery(await searchParams);
  const report = await getReceivablesPayablesReport();
  const { receivables, payables } = report;
  const netPositive = report.netPosition >= 0;
  const dueSoonNet = receivables.dueSoon - payables.dueSoon;

  return (
    <div className="animate-fade-up">
      <ReportHeader
        active="/laporan/piutang-hutang"
        eyebrow="Laporan"
        title="Piutang & hutang"
        description="Posisi tagihan yang masih terbuka per hari ini: siapa yang berutang ke bengkel, apa yang harus dibayar ke supplier, dan seberapa lama tertunda."
        tabQuery={tabQuery}
        exportHref="/api/export/laporan/piutang-hutang"
        meta={
          <span className="badge-neutral">
            <CalendarClock size={11} /> Posisi per {formatDateID(report.today)}
          </span>
        }
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <div className="relative col-span-2 overflow-hidden rounded-3xl bg-pine p-4 text-white sm:p-5 xl:col-span-1">
          <div className="pointer-events-none absolute -right-8 -top-10 size-28 rounded-full border-[18px] border-brand/25" />
          <div className="flex size-8 items-center justify-center rounded-lg bg-white/10 text-lime">
            <Scale size={16} />
          </div>
          <div className="mt-4 text-[9px] font-extrabold uppercase tracking-[0.1em] text-white/40">Posisi bersih</div>
          <div className={cn("mt-1 font-display text-[1.2rem] font-extrabold tracking-tight tabular sm:text-[1.45rem]", netPositive ? "text-lime" : "text-[#ffb097]")}>
            {formatRupiah(report.netPosition)}
          </div>
          <div className="mt-1 text-[9px] font-medium text-white/35">
            {netPositive ? "Piutang lebih besar dari hutang" : "Hutang lebih besar dari piutang"}
          </div>
        </div>

        <div className="card p-4 sm:p-5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-success-soft text-success">
            <ArrowDownLeft size={16} />
          </div>
          <div className="mt-4 text-[9px] font-extrabold uppercase tracking-[0.1em] text-faint">Piutang pelanggan</div>
          <div className="mt-1 font-display text-[1.2rem] font-extrabold tracking-tight text-ink tabular sm:text-[1.45rem]">
            {formatRupiah(receivables.total)}
          </div>
          <div className="mt-1 text-[9px] font-medium text-muted">{receivables.count} nota terbuka</div>
        </div>

        <div className="card p-4 sm:p-5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-danger-soft text-danger">
            <ArrowUpRight size={16} />
          </div>
          <div className="mt-4 text-[9px] font-extrabold uppercase tracking-[0.1em] text-faint">Hutang supplier</div>
          <div className="mt-1 font-display text-[1.2rem] font-extrabold tracking-tight text-ink tabular sm:text-[1.45rem]">
            {formatRupiah(payables.total)}
          </div>
          <div className="mt-1 text-[9px] font-medium text-muted">{payables.count} tagihan terbuka</div>
        </div>

        <div className="card col-span-2 p-4 sm:p-5 xl:col-span-1">
          <div className="flex size-8 items-center justify-center rounded-lg bg-warning-soft text-warning">
            <CalendarClock size={16} />
          </div>
          <div className="mt-4 text-[9px] font-extrabold uppercase tracking-[0.1em] text-faint">
            Jatuh tempo s/d {formatDateID(report.dueSoonUntil)}
          </div>
          <div className={cn("mt-1 font-display text-[1.2rem] font-extrabold tracking-tight tabular sm:text-[1.45rem]", dueSoonNet >= 0 ? "text-ink" : "text-danger")}>
            {formatRupiah(dueSoonNet)}
          </div>
          <div className="mt-1 text-[9px] font-medium text-muted">
            masuk {formatRupiah(receivables.dueSoon)} · keluar {formatRupiah(payables.dueSoon)}
          </div>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SideSummary
          eyebrow="Piutang"
          title="Tagihan ke pelanggan"
          side={receivables}
          icon={HandCoins}
          manageHref="/piutang"
          manageLabel="Kelola piutang"
        />
        <SideSummary
          eyebrow="Hutang"
          title="Kewajiban ke supplier"
          side={payables}
          icon={Landmark}
          manageHref="/hutang"
          manageLabel="Kelola hutang supplier"
        />
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <OverdueTable title="Piutang paling lama tertunda" side={receivables} emptyText="Tidak ada piutang lewat jatuh tempo." />
        <OverdueTable title="Hutang lewat jatuh tempo" side={payables} emptyText="Tidak ada hutang supplier lewat jatuh tempo." />
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <PartyTable title="Pelanggan dengan piutang terbesar" partyLabel="Pelanggan" side={receivables} emptyText="Semua pelanggan sudah lunas." />
        <PartyTable title="Supplier dengan hutang terbesar" partyLabel="Supplier" side={payables} emptyText="Tidak ada hutang supplier terbuka." />
      </section>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-line bg-surface/60 px-4 py-3">
        <CircleDollarSign size={14} className="mt-0.5 shrink-0 text-success" />
        <p className="text-[10px] leading-relaxed text-muted">
          <span className="font-bold text-ink">Cara membaca:</span> Laporan ini adalah posisi saat ini, tidak terikat periode.
          Umur dihitung dari tanggal jatuh tempo; tagihan tanpa jatuh tempo dianggap belum jatuh tempo. Posisi bersih = piutang −
          hutang. Nilai positif berarti lebih banyak uang yang akan masuk daripada yang harus dibayar.
        </p>
      </div>
    </div>
  );
}
