import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import { buildReceivablesPayablesReport, type OpenBalance } from "@/lib/queries/receivables-payables";

const TODAY = "2026-11-12";

function row(partial: Partial<OpenBalance> & Pick<OpenBalance, "id" | "remaining">): OpenBalance {
  return {
    reference: `REF-${partial.id}`,
    partyKey: "customer-1",
    partyName: "Andi",
    partyPhone: null,
    businessDate: "2026-11-01",
    dueDate: null,
    href: `/transaksi/${partial.id}`,
    ...partial,
  };
}

describe("laporan piutang & hutang", () => {
  const receivables = [
    row({ id: "a", remaining: 100_000, dueDate: null }),
    row({ id: "b", remaining: 200_000, dueDate: "2026-11-12" }), // jatuh tempo hari ini: belum lewat
    row({ id: "c", remaining: 300_000, dueDate: "2026-11-18" }), // hari ke-7 dari hari ini: masih "segera"
    row({ id: "d", remaining: 999_000, dueDate: "2026-11-19" }), // di luar 7 hari
    row({ id: "e", remaining: 50_000, dueDate: "2026-11-05", partyKey: "customer-2", partyName: "Budi" }), // 7 hari
    row({ id: "f", remaining: 70_000, dueDate: "2026-10-01", partyKey: "customer-2", partyName: "Budi" }), // 42 hari
    row({ id: "g", remaining: 0, dueDate: "2026-10-01" }), // lunas: diabaikan
  ];
  const payables = [
    row({ id: "1", remaining: 500_000, dueDate: "2026-11-02", partyKey: "supplier-1", partyName: "Toko Oli" }),
    row({ id: "2", remaining: 250_000, dueDate: "2026-11-14", partyKey: "supplier-1", partyName: "Toko Oli" }),
  ];
  const report = buildReceivablesPayablesReport(receivables, payables, TODAY);

  it("menghitung total, lewat tempo, dan jatuh tempo 7 hari ke depan", () => {
    expect(report.dueSoonUntil).toBe("2026-11-18");
    expect(report.receivables).toMatchObject({
      total: 1_719_000,
      count: 6,
      overdue: 120_000,
      overdueCount: 2,
      dueSoon: 500_000,
      dueSoonCount: 2,
    });
    expect(report.payables).toMatchObject({ total: 750_000, overdue: 500_000, dueSoon: 250_000 });
    expect(report.netPosition).toBe(1_719_000 - 750_000);
  });

  it("mengelompokkan umur tagihan dari tanggal jatuh tempo", () => {
    expect(report.receivables.aging.map((bucket) => [bucket.key, bucket.count, bucket.total])).toEqual([
      ["lancar", 4, 1_599_000],
      ["1-7", 1, 50_000],
      ["8-30", 0, 0],
      [">30", 1, 70_000],
    ]);
  });

  it("mengurutkan tunggakan dari yang paling lama dan merangkum per pihak", () => {
    expect(report.receivables.overdueRows.map((r) => [r.id, r.daysOverdue])).toEqual([
      ["f", 42],
      ["e", 7],
    ]);
    const [first, second] = report.receivables.parties;
    expect(first).toMatchObject({ name: "Budi", count: 2, total: 120_000, overdue: 120_000, oldestDueDate: "2026-10-01" });
    expect(second).toMatchObject({ name: "Andi", count: 4, overdue: 0, oldestDueDate: "2026-11-12" });
    expect(report.payables.parties).toEqual([
      expect.objectContaining({ name: "Toko Oli", count: 2, total: 750_000, overdue: 500_000 }),
    ]);
  });
});
