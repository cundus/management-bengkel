import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  transaction: { findMany: vi.fn() },
  item: { count: vi.fn(), fields: { minStock: { name: "minStock" } } },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/dates", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/dates")>()),
  todayISO: () => "2026-11-09",
}));

import { getNavigationSummary } from "@/lib/queries/navigation";

beforeEach(() => vi.clearAllMocks());

describe("ringkasan navigasi", () => {
  it("menghitung nota terbuka dan lewat tempo tanpa memasukkan nota lunas atau jatuh tempo hari ini", async () => {
    db.transaction.findMany.mockResolvedValue([
      { total: 100, dueDate: new Date("2026-11-08T00:00:00Z"), payments: [{ amount: 20 }, { amount: 30 }] },
      { total: 100, dueDate: new Date("2026-11-08T00:00:00Z"), payments: [{ amount: 100 }] },
      { total: 100, dueDate: new Date("2026-11-08T00:00:00Z"), payments: [{ amount: 110 }] },
      { total: 100, dueDate: new Date("2026-11-09T00:00:00Z"), payments: [] },
      { total: 100, dueDate: new Date("2026-11-10T00:00:00Z"), payments: [] },
      { total: 100, dueDate: null, payments: [] },
      { total: 0, dueDate: null, payments: [] },
    ]);
    db.item.count.mockResolvedValue(2);

    expect(await getNavigationSummary()).toEqual({
      today: "2026-11-09", outstanding: 4, overdue: 1, lowStock: 2,
    });
    expect(db.transaction.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: "selesai" } }));
    expect(db.item.count).toHaveBeenCalledWith({
      where: { category: "sparepart", isActive: true, stock: { lte: db.item.fields.minStock } },
    });
  });

  it("menghasilkan badge kosong untuk database baru", async () => {
    db.transaction.findMany.mockResolvedValue([]);
    db.item.count.mockResolvedValue(0);
    expect(await getNavigationSummary()).toEqual({
      today: "2026-11-09", outstanding: 0, overdue: 0, lowStock: 0,
    });
  });
});
