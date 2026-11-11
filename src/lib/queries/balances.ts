import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import type { TransaksiStatusFilter } from "../types";

/*
 * Saldo nota dihitung di database, bukan dengan memuat semua nota + pembayaran
 * ke JavaScript. Aturannya sama dengan `paymentStatus`/`remainingAmount` di
 * `calculations.ts`:
 *   paid      = SUM(payments.amount) per nota (0 jika belum ada pembayaran)
 *   remaining = MAX(0, total − paid) untuk nota selesai; 0 untuk nota batal
 *   status    = batal | lunas (remaining = 0) | sebagian (paid > 0) | belum_bayar
 */

/** Alias `t` = transactions, `p.paid` = total pembayaran nota. */
const FROM_WITH_PAID = Prisma.sql`
  FROM transactions t
  LEFT JOIN (
    SELECT transaction_id, SUM(amount)::bigint AS paid
    FROM payments
    GROUP BY transaction_id
  ) p ON p.transaction_id = t.id`;

const PAID = Prisma.sql`COALESCE(p.paid, 0)`;
const IS_OPEN = Prisma.sql`t.status = 'selesai' AND t.total > ${PAID}`;

export type OpenReceivableSummary = {
  count: number;
  total: number;
  overdueCount: number;
  overdueTotal: number;
  /** Sisa nota yang jatuh tempo di [today, dueSoonUntil]. */
  dueSoonTotal: number;
};

/** Ringkasan semua nota terbuka (belum lunas) dalam satu query agregat. */
export async function getOpenReceivableSummary(today: string, dueSoonUntil = today): Promise<OpenReceivableSummary> {
  const [row] = await prisma.$queryRaw<
    { count: bigint; total: bigint; overdue_count: bigint; overdue_total: bigint; due_soon_total: bigint }[]
  >(Prisma.sql`
    SELECT
      COUNT(*) AS count,
      COALESCE(SUM(t.total - ${PAID}), 0)::bigint AS total,
      COUNT(*) FILTER (WHERE t.due_date < ${today}::date) AS overdue_count,
      COALESCE(SUM(t.total - ${PAID}) FILTER (WHERE t.due_date < ${today}::date), 0)::bigint AS overdue_total,
      COALESCE(SUM(t.total - ${PAID}) FILTER (
        WHERE t.due_date >= ${today}::date AND t.due_date <= ${dueSoonUntil}::date
      ), 0)::bigint AS due_soon_total
    ${FROM_WITH_PAID}
    WHERE ${IS_OPEN}`);

  return {
    count: Number(row.count),
    total: Number(row.total),
    overdueCount: Number(row.overdue_count),
    overdueTotal: Number(row.overdue_total),
    dueSoonTotal: Number(row.due_soon_total),
  };
}

/** ID nota terbuka dengan jatuh tempo ≤ `dueOnOrBefore`, paling dekat jatuh tempo dulu. */
export async function findOpenTransactionIdsDueBy(dueOnOrBefore: string, limit: number): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT t.id
    ${FROM_WITH_PAID}
    WHERE ${IS_OPEN} AND t.due_date <= ${dueOnOrBefore}::date
    ORDER BY t.due_date ASC, t.created_at DESC
    LIMIT ${limit}`);
  return rows.map((row) => row.id);
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function statusCondition(status: TransaksiStatusFilter): Prisma.Sql {
  switch (status) {
    case "lunas":
      return Prisma.sql`t.status = 'selesai' AND t.total <= ${PAID}`;
    case "sebagian":
      return Prisma.sql`${IS_OPEN} AND ${PAID} > 0`;
    case "belum_bayar":
      return Prisma.sql`${IS_OPEN} AND ${PAID} <= 0`;
    case "batal":
      return Prisma.sql`t.status = 'batal'`;
    case "pengajuan":
      return Prisma.sql`t.status = 'selesai' AND EXISTS (
        SELECT 1 FROM void_requests vr WHERE vr.transaction_id = t.id AND vr.status = 'pending'
      )`;
    default:
      return Prisma.sql`TRUE`;
  }
}

/**
 * Satu halaman ID nota untuk daftar transaksi: pencarian, filter status bayar,
 * urutan, dan paginasi semuanya di database.
 */
export async function findTransactionPage(options: {
  search: string;
  status: TransaksiStatusFilter;
  limit: number;
  offset: number;
}): Promise<{ ids: string[]; total: number }> {
  const conditions: Prisma.Sql[] = [statusCondition(options.status)];
  if (options.search) {
    const pattern = `%${escapeLike(options.search)}%`;
    conditions.push(Prisma.sql`(
      t.invoice_no ILIKE ${pattern}
      OR c.name ILIKE ${pattern}
      OR c.phone ILIKE ${pattern}
      OR v.plate_number ILIKE ${pattern}
      OR v.brand ILIKE ${pattern}
      OR v.model ILIKE ${pattern}
    )`);
  }
  const from = Prisma.sql`
    ${FROM_WITH_PAID}
    JOIN customers c ON c.id = t.customer_id
    LEFT JOIN vehicles v ON v.id = t.vehicle_id
    WHERE ${Prisma.join(conditions, " AND ")}`;

  const [rows, [count]] = await Promise.all([
    prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT t.id ${from}
      ORDER BY t.created_at DESC, t.business_date DESC
      LIMIT ${options.limit} OFFSET ${options.offset}`),
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`SELECT COUNT(*) AS count ${from}`),
  ]);

  return { ids: rows.map((row) => row.id), total: Number(count.count) };
}

/** Pencarian piutang: nomor nota, nama/telepon pelanggan, plat nomor (tanpa merek/model). */
function receivableSearch(search: string): Prisma.Sql {
  if (!search) return Prisma.sql`TRUE`;
  const pattern = `%${escapeLike(search)}%`;
  return Prisma.sql`(
    t.invoice_no ILIKE ${pattern}
    OR c.name ILIKE ${pattern}
    OR c.phone ILIKE ${pattern}
    OR v.plate_number ILIKE ${pattern}
  )`;
}

const CUSTOMER_JOINS = Prisma.sql`
  JOIN customers c ON c.id = t.customer_id
  LEFT JOIN vehicles v ON v.id = t.vehicle_id`;

/** ID nota terbuka untuk daftar piutang: jatuh tempo terdekat dulu, tanpa jatuh tempo paling akhir. */
export async function findOpenReceivableIds(options: {
  today: string;
  search: string;
  filter: "semua" | "jatuh_tempo" | "lancar";
  limit: number;
}): Promise<string[]> {
  const due =
    options.filter === "jatuh_tempo"
      ? Prisma.sql`t.due_date < ${options.today}::date`
      : options.filter === "lancar"
        ? Prisma.sql`(t.due_date IS NULL OR t.due_date >= ${options.today}::date)`
        : Prisma.sql`TRUE`;
  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT t.id
    ${FROM_WITH_PAID}
    ${CUSTOMER_JOINS}
    WHERE ${IS_OPEN} AND ${due} AND ${receivableSearch(options.search)}
    ORDER BY t.due_date ASC NULLS LAST, t.created_at DESC
    LIMIT ${options.limit}`);
  return rows.map((row) => row.id);
}

export type AgingKey = "lancar" | "1-7" | "8-30" | ">30";

/** Umur piutang terbuka per bucket, sama dengan `agingBucket` di calculations.ts. */
export async function getReceivableAging(today: string): Promise<Map<AgingKey, { count: number; total: number }>> {
  const rows = await prisma.$queryRaw<{ bucket: AgingKey; count: bigint; total: bigint }[]>(Prisma.sql`
    SELECT bucket, COUNT(*) AS count, SUM(remaining)::bigint AS total
    FROM (
      SELECT
        t.total - ${PAID} AS remaining,
        CASE
          WHEN t.due_date IS NULL OR ${today}::date - t.due_date <= 0 THEN 'lancar'
          WHEN ${today}::date - t.due_date <= 7 THEN '1-7'
          WHEN ${today}::date - t.due_date <= 30 THEN '8-30'
          ELSE '>30'
        END AS bucket
      ${FROM_WITH_PAID}
      WHERE ${IS_OPEN}
    ) open_rows
    GROUP BY bucket`);
  return new Map(rows.map((row) => [row.bucket, { count: Number(row.count), total: Number(row.total) }]));
}

/*
 * Nota lunas lewat cicilan/pelunasan: dibayar penuh dan pembayaran terakhir
 * terjadi setelah tanggal nota (sama dengan `settledReceivable`).
 * nilai pelunasan = total − DP (pembayaran pada/sebelum tanggal nota).
 */
const SETTLED_CTE = Prisma.sql`
  WITH settled AS (
    SELECT
      t.id,
      t.created_at,
      MAX(pay.business_date) AS settled_date,
      t.total - COALESCE(SUM(pay.amount) FILTER (WHERE pay.business_date <= t.business_date), 0) AS settled_amount
    FROM transactions t
    JOIN payments pay ON pay.transaction_id = t.id
    WHERE t.status = 'selesai'
    GROUP BY t.id
    HAVING SUM(pay.amount) >= t.total AND MAX(pay.business_date) > t.business_date
  )`;

export async function getSettledSummary(monthStart: string, monthEnd: string): Promise<{
  count: number;
  total: number;
  monthCount: number;
  monthTotal: number;
}> {
  const [row] = await prisma.$queryRaw<{ count: bigint; total: bigint; month_count: bigint; month_total: bigint }[]>(Prisma.sql`
    ${SETTLED_CTE}
    SELECT
      COUNT(*) AS count,
      COALESCE(SUM(settled_amount), 0)::bigint AS total,
      COUNT(*) FILTER (WHERE settled_date BETWEEN ${monthStart}::date AND ${monthEnd}::date) AS month_count,
      COALESCE(SUM(settled_amount) FILTER (WHERE settled_date BETWEEN ${monthStart}::date AND ${monthEnd}::date), 0)::bigint AS month_total
    FROM settled`);
  return {
    count: Number(row.count),
    total: Number(row.total),
    monthCount: Number(row.month_count),
    monthTotal: Number(row.month_total),
  };
}

/** ID nota lunas terbaru (tanggal pelunasan terbaru dulu), dengan pencarian. */
export async function findSettledIds(search: string, limit: number): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    ${SETTLED_CTE}
    SELECT s.id
    FROM settled s
    JOIN transactions t ON t.id = s.id
    ${CUSTOMER_JOINS}
    WHERE ${receivableSearch(search)}
    ORDER BY s.settled_date DESC, s.created_at DESC
    LIMIT ${limit}`);
  return rows.map((row) => row.id);
}

/** Statistik nota selesai per pelanggan: jumlah servis, sisa piutang, kunjungan terakhir. */
export async function getCustomerTransactionStats(
  customerIds: number[],
): Promise<Map<number, { count: number; outstanding: number; lastVisit: Date | null }>> {
  if (customerIds.length === 0) return new Map();
  const rows = await prisma.$queryRaw<{ customer_id: number; count: bigint; outstanding: bigint; last_visit: Date | null }[]>(Prisma.sql`
    SELECT
      t.customer_id,
      COUNT(*) AS count,
      COALESCE(SUM(GREATEST(t.total - ${PAID}, 0)), 0)::bigint AS outstanding,
      MAX(t.created_at) AS last_visit
    ${FROM_WITH_PAID}
    WHERE t.status = 'selesai' AND t.customer_id = ANY(${customerIds})
    GROUP BY t.customer_id`);
  return new Map(
    rows.map((row) => [row.customer_id, { count: Number(row.count), outstanding: Number(row.outstanding), lastVisit: row.last_visit }]),
  );
}
