import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { currentMonthISO, todayISO } from "@/lib/dates";

const mocks = vi.hoisted(() => ({ owner: vi.fn(), user: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireOwner: mocks.owner, requireUser: mocks.user }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  return { prisma: new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL || "postgresql://wmc:wmc@localhost:5432/wmc225_test?schema=public" }) };
});
import { prisma as actionDb } from "@/lib/db";
import { adjustStockAction, receiveStockBatchAction } from "@/actions/inventory";
import { getMonthlyReport } from "@/lib/queries/reports";
import { listStockAdjustments } from "@/lib/queries/stock-adjustments";

const db = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL || "postgresql://wmc:wmc@localhost:5432/wmc225_test?schema=public" });
const state = { ok: false };
let itemId: number;
const form = (values: Record<string, string | number>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, String(value));
  return data;
};
const stockOf = async () => (await db.item.findUniqueOrThrow({ where: { id: itemId } })).stock;
const adjust = async (values: Record<string, string | number>) => adjustStockAction(state, form({
  itemId, direction: "kurang", qty: 1, reason: "rusak", notes: "Uji penyesuaian stok", expectedStock: await stockOf(), ...values,
}));

beforeAll(async () => {
  const owner = await db.user.findFirstOrThrow({ where: { role: "owner" } });
  mocks.owner.mockResolvedValue(owner);
  mocks.user.mockResolvedValue(owner);
  itemId = (await db.item.create({ data: { sku: "ADJ-INTEGRATION", name: "Adjustment test part", category: "sparepart", price: 1000, cost: 300 } })).id;
  for (const lot of [
    { code: "LOT-1", receivedDate: "2026-01-01", quantity: 3, unitCost: 100 },
    { code: "LOT-2", receivedDate: "2026-01-02", quantity: 4, unitCost: 200 },
  ]) {
    const result = await receiveStockBatchAction(state, form({ itemId, ...lot }));
    if (!result.ok) throw new Error(result.message);
  }
});

afterAll(async () => {
  if (itemId) {
    await db.stockMovement.deleteMany({ where: { itemId } });
    await db.stockAdjustment.deleteMany({ where: { itemId } });
    await db.stockBatch.deleteMany({ where: { itemId } });
    await db.item.delete({ where: { id: itemId } });
  }
  await Promise.all([db.$disconnect(), actionDb.$disconnect()]);
});

describe("penyesuaian stok manual", () => {
  it("khusus pemilik dan menolak input tidak lengkap tanpa mengubah stok", async () => {
    mocks.owner.mockRejectedValueOnce(new Error("forbidden"));
    await expect(adjust({})).rejects.toThrow("forbidden");
    const invalid: Record<string, string | number>[] = [
      { qty: 0 }, { qty: 1.5 }, { reason: "" }, { reason: "asal" }, { notes: "abc" }, { direction: "x" },
      { direction: "tambah", reason: "rusak", unitCost: 100 }, // alasan khusus pengurangan
      { direction: "kurang", reason: "ditemukan" }, // alasan khusus penambahan
      { direction: "tambah", reason: "ditemukan", unitCost: -1 },
      { qty: 8 }, // melebihi stok
      { expectedStock: 6 }, // stok sudah berubah sejak form dibuka
    ];
    for (const values of invalid) expect((await adjust(values)).ok, JSON.stringify(values)).toBe(false);
    expect(await stockOf()).toBe(7);
    expect(await db.stockAdjustment.count({ where: { itemId } })).toBe(0);
  });

  it("pengurangan memakai FIFO lintas batch dan mencatat dokumen lengkap", async () => {
    const result = await adjust({ qty: 4, reason: "hilang", notes: "  Tidak ditemukan saat cek rak  " });
    expect(result.ok, result.message).toBe(true);
    const adjustment = await db.stockAdjustment.findFirstOrThrow({ where: { itemId }, include: { stockMovements: { orderBy: { id: "asc" }, include: { stockBatch: true } } } });
    expect(result.message).toContain(`PS-${String(adjustment.id).padStart(5, "0")}`);
    expect(adjustment).toMatchObject({ reason: "hilang", qty: -4, stockBefore: 7, stockAfter: 3, value: -(3 * 100 + 1 * 200), notes: "Tidak ditemukan saat cek rak" });
    expect(adjustment.createdById).toBe((await db.user.findFirstOrThrow({ where: { role: "owner" } })).id);
    expect(adjustment.businessDate.toISOString().slice(0, 10)).toBe(todayISO());
    expect(adjustment.stockMovements.map((m) => [m.type, m.stockBatch?.code, m.qty, m.balanceAfter])).toEqual([
      ["penyesuaian", "LOT-1", -3, 4], ["penyesuaian", "LOT-2", -1, 3],
    ]);
    expect(await stockOf()).toBe(3);
  });

  it("pengurangan dari batch tertentu hanya mengambil batch itu", async () => {
    const lot2 = await db.stockBatch.findFirstOrThrow({ where: { itemId, code: "LOT-2" } });
    expect((await adjust({ qty: 4, stockBatchId: lot2.id })).ok).toBe(false); // sisa LOT-2 hanya 3
    expect((await adjust({ qty: 2, stockBatchId: lot2.id, reason: "kedaluwarsa" })).ok).toBe(true);
    expect((await db.stockBatch.findUniqueOrThrow({ where: { id: lot2.id } })).remaining).toBe(1);
    expect((await db.stockAdjustment.findFirstOrThrow({ where: { itemId }, orderBy: { id: "desc" } })).value).toBe(-400);
  });

  it("penambahan membuat batch baru dengan modal yang diisi", async () => {
    const result = await adjust({ direction: "tambah", qty: 5, reason: "ditemukan", unitCost: 150, notes: "Stok lebih di gudang belakang" });
    expect(result.ok, result.message).toBe(true);
    const adjustment = await db.stockAdjustment.findFirstOrThrow({ where: { itemId }, orderBy: { id: "desc" } });
    expect(adjustment).toMatchObject({ qty: 5, stockBefore: 1, stockAfter: 6, value: 750 });
    const batch = await db.stockBatch.findFirstOrThrow({ where: { itemId, code: `PS-${String(adjustment.id).padStart(5, "0")}` } });
    expect([batch.quantity, batch.remaining, batch.unitCost]).toEqual([5, 5, 150]);
  });

  it("dua penyesuaian dari form yang sama tidak bisa sama-sama tersimpan", async () => {
    const expectedStock = await stockOf();
    const results = await Promise.all([1, 2].map(() => adjustStockAction(state, form({
      itemId, direction: "kurang", qty: 1, reason: "rusak", notes: "Klik ganda simpan", expectedStock,
    }))));
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(await stockOf()).toBe(expectedStock - 1);
  });

  it("ledger, batch, dan dokumen penyesuaian tetap konsisten", async () => {
    const item = await db.item.findUniqueOrThrow({ where: { id: itemId }, include: { stockBatches: true, stockMovements: { orderBy: { id: "asc" } }, stockAdjustments: { include: { stockMovements: true } } } });
    let balance = 0;
    for (const movement of item.stockMovements) {
      balance += movement.qty;
      expect(movement.balanceAfter).toBe(balance);
      if (movement.type === "penyesuaian") expect(movement.stockAdjustmentId).not.toBeNull();
    }
    expect(balance).toBe(item.stock);
    expect(item.stockBatches.reduce((sum, batch) => sum + batch.remaining, 0)).toBe(item.stock);
    for (const adjustment of item.stockAdjustments) {
      expect(adjustment.stockMovements.reduce((sum, movement) => sum + movement.qty, 0)).toBe(adjustment.qty);
    }
  });

  it("dokumen tidak bisa diubah menjadi tidak konsisten di database", async () => {
    const adjustment = await db.stockAdjustment.findFirstOrThrow({ where: { itemId } });
    await expect(db.stockAdjustment.update({ where: { id: adjustment.id }, data: { stockAfter: adjustment.stockAfter + 1 } })).rejects.toThrow();
    await expect(db.stockAdjustment.update({ where: { id: adjustment.id }, data: { notes: "   " } })).rejects.toThrow();
  });

  it("selisih nilai masuk laporan laba rugi dan riwayat", async () => {
    const { loss, gain, net, adjustments } = await listStockAdjustments({ itemId, month: currentMonthISO() });
    expect(adjustments).toHaveLength(4);
    expect([loss, gain]).toEqual([-500 - 400 - 200, 750]);
    const report = await getMonthlyReport(currentMonthISO());
    const all = await db.stockAdjustment.aggregate({ where: { businessDate: { gte: new Date(`${currentMonthISO()}-01T00:00:00Z`) } }, _sum: { value: true } });
    expect(report.stockAdjustment).toBe(all._sum.value);
    expect(report.netProfit).toBe(report.revenue - report.cogs - report.expenses + report.cancellationIncome + report.stockAdjustment);
    expect(net).toBe(-350);
  });
});
