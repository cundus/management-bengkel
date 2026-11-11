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
