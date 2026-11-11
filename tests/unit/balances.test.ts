import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  return { prisma: new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL || "postgresql://wmc:wmc@localhost:5432/wmc225_test?schema=public" }) };
});

import { prisma } from "@/lib/db";
import { addDaysISO, todayISO } from "@/lib/dates";
import { listTransactionInclude, mapTransactionList } from "@/lib/queries/mappers";
import { findOpenTransactionIdsDueBy, findTransactionPage, getOpenReceivableSummary } from "@/lib/queries/balances";
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
