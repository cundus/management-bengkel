import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  item: { count: vi.fn(), fields: { minStock: { name: "minStock" } } },
  voidRequest: { count: vi.fn() },
}));
const balances = vi.hoisted(() => ({ getOpenReceivableSummary: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/queries/balances", () => balances);
vi.mock("@/lib/dates", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/dates")>()),
  todayISO: () => "2026-11-09",
}));

import { getNavigationSummary } from "@/lib/queries/navigation";

beforeEach(() => vi.clearAllMocks());

describe("ringkasan navigasi", () => {
  it("memakai jumlah nota terbuka dan lewat tempo dari ringkasan database", async () => {
    balances.getOpenReceivableSummary.mockResolvedValue({
      count: 4, total: 400, overdueCount: 1, overdueTotal: 100, dueSoonTotal: 0,
    });
    db.item.count.mockResolvedValue(2);
    db.voidRequest.count.mockResolvedValue(3);

    expect(await getNavigationSummary()).toEqual({
      today: "2026-11-09", outstanding: 4, overdue: 1, lowStock: 2, voidRequests: 3,
    });
    expect(balances.getOpenReceivableSummary).toHaveBeenCalledWith("2026-11-09");
    expect(db.voidRequest.count).toHaveBeenCalledWith({
      where: { status: "pending", transaction: { status: "selesai" } },
    });
    expect(db.item.count).toHaveBeenCalledWith({
      where: { category: "sparepart", isActive: true, stock: { lte: db.item.fields.minStock } },
    });
  });

  it("menghasilkan badge kosong untuk database baru", async () => {
    balances.getOpenReceivableSummary.mockResolvedValue({
      count: 0, total: 0, overdueCount: 0, overdueTotal: 0, dueSoonTotal: 0,
    });
    db.item.count.mockResolvedValue(0);
    db.voidRequest.count.mockResolvedValue(0);
    expect(await getNavigationSummary()).toEqual({
      today: "2026-11-09", outstanding: 0, overdue: 0, lowStock: 0, voidRequests: 0,
    });
  });
});
