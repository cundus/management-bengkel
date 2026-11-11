import { getCurrentUser } from "@/lib/auth";
import { getReceivablesPayablesReport, type BalanceSide } from "@/lib/queries/receivables-payables";
import { csvResponse, toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

type Row = (string | number | null)[];

function sideRows(label: string, partyLabel: string, side: BalanceSide): Row[] {
  return [
    [label],
    ["Total", side.total],
    ["Jumlah tagihan", side.count],
    ["Lewat tempo", side.overdue],
    ["Tagihan lewat tempo", side.overdueCount],
    ["Jatuh tempo 7 hari ke depan", side.dueSoon],
    [],
    ["UMUR " + label, "Jumlah tagihan", "Nominal (Rp)"],
    ...side.aging.map((bucket) => [bucket.label, bucket.count, bucket.total]),
    [],
    [`PER ${partyLabel.toUpperCase()}`],
    [partyLabel, "Telepon", "Tagihan", "Sisa (Rp)", "Lewat tempo (Rp)", "Jatuh tempo terlama"],
    ...side.parties.map((party) => [party.name, party.phone, party.count, party.total, party.overdue, party.oldestDueDate]),
    [],
    [`${label} LEWAT TEMPO`],
    ["Referensi", partyLabel, "Tanggal", "Jatuh tempo", "Hari lewat", "Sisa (Rp)"],
    ...side.overdueRows.map((row) => [row.reference, row.partyName, row.businessDate, row.dueDate, row.daysOverdue, row.remaining]),
    [],
  ];
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (user.role !== "owner") return new Response("Forbidden", { status: 403 });

  const report = await getReceivablesPayablesReport();
  const rows: Row[] = [
    ["Laporan Piutang & Hutang WMC 225", `Posisi per ${report.today}`],
    [],
    ["RINGKASAN", "NILAI (Rp)"],
    ["Piutang pelanggan", report.receivables.total],
    ["Hutang supplier", report.payables.total],
    ["Posisi bersih (piutang - hutang)", report.netPosition],
    [],
    ...sideRows("PIUTANG", "Pelanggan", report.receivables),
    ...sideRows("HUTANG", "Supplier", report.payables),
  ];

  return csvResponse(`wmc225-piutang-hutang-${report.today}.csv`, toCsv(rows));
}
