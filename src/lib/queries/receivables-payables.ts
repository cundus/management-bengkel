import { getReceivables } from "@/lib/queries/transactions";
import { listPayables } from "@/lib/queries/finance";
import { agingBucket } from "@/lib/calculations";
import { addDaysISO, daysBetween, todayISO } from "@/lib/dates";

export const AGING_BUCKETS = [
  { key: "lancar", label: "Belum jatuh tempo" },
  { key: "1-7", label: "1–7 hari" },
  { key: "8-30", label: "8–30 hari" },
  { key: ">30", label: ">30 hari" },
] as const;

export type AgingKey = (typeof AGING_BUCKETS)[number]["key"];

/** Satu tagihan terbuka, dari sisi pelanggan (piutang) atau supplier (hutang). */
export type OpenBalance = {
  id: string;
  reference: string;
  partyKey: string;
  partyName: string;
  partyPhone: string | null;
  businessDate: string;
  dueDate: string | null;
  remaining: number;
  href: string;
};

export type AgingRow = { key: AgingKey; label: string; count: number; total: number };

export type PartyRow = {
  key: string;
  name: string;
  phone: string | null;
  count: number;
  total: number;
  overdue: number;
  oldestDueDate: string | null;
};

export type OverdueRow = OpenBalance & { daysOverdue: number };

export type BalanceSide = {
  total: number;
  count: number;
  overdue: number;
  overdueCount: number;
  dueSoon: number;
  dueSoonCount: number;
  aging: AgingRow[];
  parties: PartyRow[];
  overdueRows: OverdueRow[];
};

export type ReceivablesPayablesReport = {
  today: string;
  dueSoonUntil: string;
  receivables: BalanceSide;
  payables: BalanceSide;
  netPosition: number;
};

export const DUE_SOON_DAYS = 7;

export function summarizeBalances(rows: OpenBalance[], today: string, dueSoonUntil: string): BalanceSide {
  const aging = new Map<AgingKey, AgingRow>(AGING_BUCKETS.map((bucket) => [bucket.key, { ...bucket, count: 0, total: 0 }]));
  const parties = new Map<string, PartyRow>();
  const overdueRows: OverdueRow[] = [];
  const side: BalanceSide = {
    total: 0,
    count: 0,
    overdue: 0,
    overdueCount: 0,
    dueSoon: 0,
    dueSoonCount: 0,
    aging: [],
    parties: [],
    overdueRows: [],
  };

  for (const row of rows) {
    if (row.remaining <= 0) continue;
    const isOverdue = !!row.dueDate && row.dueDate < today;
    side.total += row.remaining;
    side.count += 1;
    if (isOverdue) {
      side.overdue += row.remaining;
      side.overdueCount += 1;
      overdueRows.push({ ...row, daysOverdue: daysBetween(row.dueDate!, today) });
    } else if (row.dueDate && row.dueDate <= dueSoonUntil) {
      side.dueSoon += row.remaining;
      side.dueSoonCount += 1;
    }

    const bucket = aging.get(agingBucket(row.dueDate, today) as AgingKey)!;
    bucket.count += 1;
    bucket.total += row.remaining;

    const party = parties.get(row.partyKey) ?? {
      key: row.partyKey,
      name: row.partyName,
      phone: row.partyPhone,
      count: 0,
      total: 0,
      overdue: 0,
      oldestDueDate: null,
    };
    party.count += 1;
    party.total += row.remaining;
    if (isOverdue) party.overdue += row.remaining;
    if (row.dueDate && (!party.oldestDueDate || row.dueDate < party.oldestDueDate)) party.oldestDueDate = row.dueDate;
    parties.set(row.partyKey, party);
  }

  side.aging = [...aging.values()];
  side.parties = [...parties.values()].sort((a, b) => b.overdue - a.overdue || b.total - a.total);
  side.overdueRows = overdueRows.sort((a, b) => b.daysOverdue - a.daysOverdue || b.remaining - a.remaining);
  return side;
}

export function buildReceivablesPayablesReport(
  receivables: OpenBalance[],
  payables: OpenBalance[],
  today: string,
): ReceivablesPayablesReport {
  const dueSoonUntil = addDaysISO(today, DUE_SOON_DAYS - 1);
  const receivableSide = summarizeBalances(receivables, today, dueSoonUntil);
  const payableSide = summarizeBalances(payables, today, dueSoonUntil);
  return {
    today,
    dueSoonUntil,
    receivables: receivableSide,
    payables: payableSide,
    netPosition: receivableSide.total - payableSide.total,
  };
}

export async function getReceivablesPayablesReport(): Promise<ReceivablesPayablesReport> {
  const [receivables, payables] = await Promise.all([getReceivables({ limit: 100_000 }), listPayables()]);

  const receivableRows: OpenBalance[] = receivables.rows.map((row) => ({
    id: row.id,
    reference: row.invoiceNo,
    partyKey: `customer-${row.customerId}`,
    partyName: row.customerName,
    partyPhone: row.customerPhone,
    businessDate: row.businessDate,
    dueDate: row.dueDate,
    remaining: row.remaining,
    href: `/transaksi/${row.id}`,
  }));

  const payableRows: OpenBalance[] = payables.map((row) => ({
    id: String(row.id),
    reference: row.referenceNo || row.description,
    partyKey: `supplier-${row.supplierId}`,
    partyName: row.supplierName,
    partyPhone: row.supplierPhone,
    businessDate: row.businessDate,
    dueDate: row.dueDate,
    remaining: row.remaining,
    href: row.purchaseId ? `/pembelian/${row.purchaseId}` : "/hutang",
  }));

  return buildReceivablesPayablesReport(receivableRows, payableRows, todayISO());
}
