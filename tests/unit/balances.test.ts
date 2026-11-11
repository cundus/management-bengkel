import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  return { prisma: new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL || "postgresql://wmc:wmc@localhost:5432/wmc225_test?schema=public" }) };
});

import { prisma } from "@/lib/db";
import { addDaysISO, dateOnlyToISO, daysBetween, monthRange, parseDateOnly, todayISO } from "@/lib/dates";
import { listTransactionInclude, mapTransactionList } from "@/lib/queries/mappers";
import {
  findOpenReceivableIds,
  findOpenTransactionIdsDueBy,
  findSettledIds,
  findTransactionPage,
  getCustomerTransactionStats,
  getOpenReceivableSummary,
  getReceivableAging,
  getSettledSummary,
} from "@/lib/queries/balances";
import { agingBucket, settledReceivable } from "@/lib/calculations";
import type { TransactionListRow, TransaksiStatusFilter } from "@/lib/types";

// Rujukan: perhitungan lama di JavaScript atas seluruh nota.
let rows: TransactionListRow[] = [];
const today = todayISO();

beforeAll(async () => {
  const records = await prisma.transaction.findMany({
    include: listTransactionInclude,
    orderBy: [{ createdAt: "desc" }, { businessDate: "desc" }],
  });
  rows = records.map(mapTransactionList);
});

afterAll(async () => {
  await prisma.$disconnect();
});

const open = () => rows.filter((row) => row.status === "selesai" && row.remaining > 0);
const sum = (list: TransactionListRow[]) => list.reduce((total, row) => total + row.remaining, 0);

describe("saldo nota dihitung di database", () => {
  it("data seed memuat nota terbuka, lunas, dan lewat tempo", () => {
    expect(open().length).toBeGreaterThan(0);
    expect(rows.some((row) => row.paymentStatus === "lunas")).toBe(true);
    expect(open().some((row) => row.dueDate && row.dueDate < today)).toBe(true);
  });

  it("ringkasan piutang sama dengan perhitungan JavaScript", async () => {
    const dueSoonUntil = addDaysISO(today, 7);
    const overdue = open().filter((row) => row.dueDate && row.dueDate < today);
    const dueSoon = open().filter((row) => row.dueDate && row.dueDate >= today && row.dueDate <= dueSoonUntil);
    expect(await getOpenReceivableSummary(today, dueSoonUntil)).toEqual({
      count: open().length,
      total: sum(open()),
      overdueCount: overdue.length,
      overdueTotal: sum(overdue),
      dueSoonTotal: sum(dueSoon),
    });
  });

  it("nota jatuh tempo terdekat diurutkan dari tanggal jatuh tempo", async () => {
    const limit = addDaysISO(today, 7);
    const ids = await findOpenTransactionIdsDueBy(limit, 100);
    const expected = open().filter((row) => row.dueDate && row.dueDate <= limit);
    expect([...ids].sort()).toEqual(expected.map((row) => row.id).sort());
    const dueDates = ids.map((id) => rows.find((row) => row.id === id)!.dueDate!);
    expect(dueDates).toEqual([...dueDates].sort());
  });

  it.each<TransaksiStatusFilter>(["semua", "lunas", "sebagian", "belum_bayar", "batal", "pengajuan"])(
    "filter status %s dan paginasi sama dengan filter JavaScript",
    async (status) => {
      const expected = rows.filter((row) => {
        if (status === "pengajuan") return row.status === "selesai" && row.hasPendingVoid;
        if (status === "batal") return row.status === "batal";
        if (status === "semua") return true;
        return row.paymentStatus === status;
      });
      const all = await findTransactionPage({ search: "", status, limit: 10_000, offset: 0 });
      expect(all.total).toBe(expected.length);
      expect(new Set(all.ids)).toEqual(new Set(expected.map((row) => row.id)));

      const second = await findTransactionPage({ search: "", status, limit: 5, offset: 5 });
      expect(second.total).toBe(expected.length);
      expect(second.ids).toEqual(all.ids.slice(5, 10));
    },
  );

  it("pencarian mencocokkan nomor nota, pelanggan, dan kendaraan tanpa membedakan huruf besar", async () => {
    const sample = rows.find((row) => row.plateNumber)!;
    const byPlate = await findTransactionPage({ search: sample.plateNumber!.toLowerCase(), status: "semua", limit: 100, offset: 0 });
    expect(byPlate.ids).toContain(sample.id);
    const byInvoice = await findTransactionPage({ search: sample.invoiceNo, status: "semua", limit: 100, offset: 0 });
    expect(byInvoice.ids).toEqual([sample.id]);
    const byName = await findTransactionPage({ search: sample.customerName.toUpperCase(), status: "semua", limit: 100, offset: 0 });
    expect(byName.total).toBe(rows.filter((row) => row.customerName === sample.customerName).length);
    expect((await findTransactionPage({ search: "%", status: "semua", limit: 100, offset: 0 })).total).toBe(0);
  });
});

describe("piutang, aging, dan statistik pelanggan di database", () => {
  it("daftar piutang mengikuti filter jatuh tempo dan urutan jatuh tempo terdekat", async () => {
    for (const filter of ["semua", "jatuh_tempo", "lancar"] as const) {
      const expected = open().filter((row) => {
        if (filter === "jatuh_tempo") return !!row.dueDate && row.dueDate < today;
        if (filter === "lancar") return !row.dueDate || row.dueDate >= today;
        return true;
      });
      const ids = await findOpenReceivableIds({ today, search: "", filter, limit: 10_000 });
      expect(new Set(ids)).toEqual(new Set(expected.map((row) => row.id)));
      const dueDates = ids.map((id) => rows.find((row) => row.id === id)!.dueDate ?? "9999-12-31");
      expect(dueDates).toEqual([...dueDates].sort());
    }
  });

  it("aging sama dengan agingBucket", async () => {
    const aging = await getReceivableAging(today);
    for (const key of ["lancar", "1-7", "8-30", ">30"] as const) {
      const bucket = open().filter((row) => agingBucket(row.dueDate, today) === key);
      expect(aging.get(key) ?? { count: 0, total: 0 }).toEqual({ count: bucket.length, total: sum(bucket) });
    }
  });

  it("statistik pelanggan sama dengan perhitungan per nota", async () => {
    const customerIds = [...new Set(rows.map((row) => row.customerId))];
    const stats = await getCustomerTransactionStats(customerIds);
    for (const id of customerIds) {
      const done = rows.filter((row) => row.customerId === id && row.status === "selesai");
      const stat = stats.get(id);
      expect(stat?.count ?? 0).toBe(done.length);
      expect(stat?.outstanding ?? 0).toBe(sum(done));
      if (done.length) expect(stat!.lastVisit!.toISOString()).toBe(done.map((row) => row.createdAt).sort().at(-1));
    }
  });

  it("riwayat pelunasan sama dengan settledReceivable, termasuk DP dan lunas di hari yang sama", async () => {
    // Lunasi sebagian nota terbuka: di hari yang sama (bukan pelunasan), beberapa hari kemudian, dan hari ini.
    const owner = await prisma.user.findFirstOrThrow({ where: { role: "owner" } });
    for (const [index, row] of open().slice(0, 9).entries()) {
      const date = [row.businessDate, addDaysISO(row.businessDate, 3), today][index % 3];
      await prisma.payment.create({
        data: { transactionId: row.id, amount: row.remaining, method: "tunai", businessDate: parseDateOnly(date > today ? today : date), receivedById: owner.id },
      });
    }

    const records = await prisma.transaction.findMany({
      where: { status: "selesai" },
      include: { payments: { orderBy: [{ businessDate: "asc" }, { paidAt: "asc" }] } },
    });
    const expected = records
      .map((record) => ({
        record,
        result: settledReceivable(
          record.total,
          dateOnlyToISO(record.businessDate),
          record.payments.map((payment) => ({ amount: payment.amount, method: payment.method, businessDate: dateOnlyToISO(payment.businessDate) })),
        ),
      }))
      .filter((entry) => entry.result)
      .sort((a, b) => b.result!.settledDate.localeCompare(a.result!.settledDate) || b.record.createdAt.getTime() - a.record.createdAt.getTime());
    expect(expected.length).toBeGreaterThan(0);

    expect(await findSettledIds("", 10_000)).toEqual(expected.map((entry) => entry.record.id));
    const { start, end } = monthRange(today.slice(0, 7));
    const thisMonth = expected.filter((entry) => entry.result!.settledDate >= start && entry.result!.settledDate <= end);
    const amount = (list: typeof expected) => list.reduce((total, entry) => total + entry.record.total - entry.result!.downPayment, 0);
    expect(await getSettledSummary(start, end)).toEqual({
      count: expected.length,
      total: amount(expected),
      monthCount: thisMonth.length,
      monthTotal: amount(thisMonth),
    });
    expect(daysBetween(expected.at(-1)!.record.businessDate.toISOString().slice(0, 10), expected.at(-1)!.result!.settledDate)).toBeGreaterThan(0);
  });
});
