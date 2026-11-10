import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { todayISO } from "@/lib/dates";

const auth = vi.hoisted(() => ({ owner: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireOwner: auth.owner }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  return { prisma: new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL || "postgresql://wmc:wmc@localhost:5432/wmc225_test?schema=public" }) };
});
import { prisma as actionDb } from "@/lib/db";
import { createPurchaseAction } from "@/actions/purchases";
import { createPayableAction, recordPayablePaymentAction } from "@/actions/finance";
import { consumeStock } from "@/lib/stock";

const db = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL || "postgresql://wmc:wmc@localhost:5432/wmc225_test?schema=public" });
let supplierId: number;
let itemId: number;
let secondId: number;
let payableId: number;
const form = (values: Record<string, string | number>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, String(value));
  return data;
};
const purchase = (overrides: Record<string, unknown> = {}) => ({
  requestId: randomUUID(), supplierId, referenceNo: "", businessDate: todayISO(), dueDate: todayISO(),
  notes: "Uji purchasing", payNow: 0, method: "transfer",
  lines: [{ itemId, code: "BUY-A", quantity: 2, unitCost: 100 }], ...overrides,
});

beforeAll(async () => {
  auth.owner.mockResolvedValue(await db.user.findFirstOrThrow({ where: { role: "owner" } }));
  supplierId = (await db.supplier.create({ data: { name: "Purchasing integration supplier" } })).id;
  const items = await Promise.all(["A", "B"].map((letter) => db.item.create({ data: { sku: `PURCHASING-TEST-${letter}`, name: `Purchase part ${letter}`, category: "sparepart", price: 1000, cost: 900 } })));
  [itemId, secondId] = items.map((item) => item.id);
});

afterAll(async () => {
  if (supplierId) {
    await db.stockMovement.deleteMany({ where: { itemId: { in: [itemId, secondId] } } });
    await db.stockBatch.deleteMany({ where: { itemId: { in: [itemId, secondId] } } });
    await db.purchase.deleteMany({ where: { supplierId } });
    await db.payable.deleteMany({ where: { supplierId } });
    await db.supplier.delete({ where: { id: supplierId } });
  }
  await db.item.deleteMany({ where: { id: { in: [itemId, secondId].filter(Boolean) } } });
  await Promise.all([db.$disconnect(), actionDb.$disconnect()]);
});

describe("purchasing terhubung dengan batch dan hutang", () => {
  it("membatasi akses dan menolak input rusak sebelum menulis", async () => {
    auth.owner.mockRejectedValueOnce(new Error("forbidden"));
    await expect(createPurchaseAction(purchase())).rejects.toThrow("forbidden");
    for (const invalid of [null, {}, purchase({ lines: [] }), purchase({ businessDate: "2099-01-01" }), purchase({ dueDate: null }), purchase({ payNow: 201 }), purchase({ lines: [{ itemId, code: "BAD", quantity: -1, unitCost: 100 }] }), purchase({ lines: [{ itemId, code: "BAD", quantity: 1.5, unitCost: 100 }] }), purchase({ lines: [{ itemId, code: "BAD", quantity: 2147483647, unitCost: 2 }] })]) {
      expect((await createPurchaseAction(invalid)).ok).toBe(false);
    }
    expect(await db.purchase.count({ where: { supplierId } })).toBe(0);
  });

  it("mencatat banyak barang, modal batch, tagihan total dan DP satu kali", async () => {
    const input = purchase({ referenceNo: " inv-test-001 ", payNow: 50, lines: [
      { itemId, code: "BUY-A", quantity: 2, unitCost: 100 }, { itemId: secondId, code: "BUY-B", quantity: 3, unitCost: 200 },
    ] });
    const results = await Promise.all([createPurchaseAction(input), createPurchaseAction(input)]);
    expect(results[0]).toEqual(results[1]);
    const result = results[0];
    if (!result.ok) throw new Error(result.message);
    const saved = await db.purchase.findUniqueOrThrow({ where: { id: result.id }, include: { batches: { orderBy: { code: "asc" } }, payable: { include: { payments: true } } } });
    payableId = saved.payableId;
    expect(saved.total).toBe(800);
    expect(saved.referenceNo).toBe("INV-TEST-001");
    expect(saved.batches.map((batch) => [batch.quantity, batch.remaining, batch.unitCost])).toEqual([[2, 2, 100], [3, 3, 200]]);
    expect(saved.payable.amount).toBe(800);
    expect(saved.payable.payments.map((payment) => payment.amount)).toEqual([50]);
    expect((await db.item.findUniqueOrThrow({ where: { id: itemId } })).stock).toBe(2);
    expect((await db.item.findUniqueOrThrow({ where: { id: secondId } })).stock).toBe(3);
    expect(await db.purchase.count({ where: { supplierId } })).toBe(1);
    expect(await db.expense.count({ where: { description: input.notes as string } })).toBe(0);
  });

  it("menolak nota supplier duplikat serta lot berulang tanpa mengubah saldo", async () => {
    expect((await createPayableAction({ ok: false }, form({ supplierId, referenceNo: "inv-test-001", description: "Tagihan duplikat", amount: 800, businessDate: todayISO() }))).ok).toBe(false);
    expect((await createPurchaseAction(purchase({ referenceNo: "INV-TEST-001", lines: [{ itemId, code: "NEW", quantity: 1, unitCost: 100 }] }))).ok).toBe(false);
    expect((await createPurchaseAction(purchase({ lines: [{ itemId, code: "X", quantity: 1, unitCost: 100 }, { itemId, code: " x ", quantity: 1, unitCost: 100 }] }))).ok).toBe(false);
    expect(await db.payable.count({ where: { supplierId } })).toBe(1);
  });

  it("kegagalan baris terakhir membatalkan semua stok, pembelian, hutang dan DP", async () => {
    const result = await createPurchaseAction(purchase({ payNow: 10, lines: [
      { itemId, code: "ROLLBACK", quantity: 1, unitCost: 100 }, { itemId: secondId, code: "BUY-B", quantity: 1, unitCost: 200 },
    ] }));
    expect(result.ok).toBe(false);
    expect(await db.stockBatch.count({ where: { itemId, code: "ROLLBACK" } })).toBe(0);
    expect((await db.item.findUniqueOrThrow({ where: { id: itemId } })).stock).toBe(2);
    expect(await db.purchase.count({ where: { supplierId } })).toBe(1);
    expect(await db.payable.count({ where: { supplierId } })).toBe(1);
    expect(await db.payablePayment.count({ where: { payable: { supplierId } } })).toBe(1);
  });

  it("pembayaran berikutnya memperbarui tagihan sama dan mencegah kelebihan saat bersamaan", async () => {
    expect((await recordPayablePaymentAction({ ok: false }, form({ payableId, amount: -1, method: "tunai" }))).ok).toBe(false);
    const results = await Promise.all([1, 2].map(() => recordPayablePaymentAction({ ok: false }, form({ payableId, amount: 750, method: "transfer" }))));
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    const paid = await db.payablePayment.aggregate({ where: { payableId }, _sum: { amount: true } });
    expect(paid._sum.amount).toBe(800);
    expect(await db.payable.count({ where: { supplierId } })).toBe(1);
  });

  it("pembelian lunas dan tempo memelihara batch yang dapat dipakai FIFO", async () => {
    for (const [code, payNow] of [["FULL", 300], ["CREDIT", 0]] as const) {
      const result = await createPurchaseAction(purchase({ payNow, lines: [{ itemId, code, quantity: 1, unitCost: 300 }] }));
      if (!result.ok) throw new Error(result.message);
      const record = await db.purchase.findUniqueOrThrow({ where: { id: result.id }, include: { payable: { include: { payments: true } } } });
      expect(record.payable.payments.reduce((sum, payment) => sum + payment.amount, 0)).toBe(payNow);
      expect(record.payable.dueDate === null).toBe(payNow === 300);
    }
    await expect(db.$transaction(async (tx) => {
      const owner = await tx.user.findFirstOrThrow({ where: { role: "owner" } });
      const customer = await tx.customer.create({ data: { name: "Purchasing rollback customer" } });
      const sale = await tx.transaction.create({ data: {
        invoiceNo: `PURCHASING-ROLLBACK-${randomUUID()}`, customerId: customer.id, subtotal: 0, total: 0,
        businessDate: new Date(`${todayISO()}T00:00:00Z`), createdById: owner.id,
      } });
      const allocation = await consumeStock(tx, itemId, 3, { transactionId: sale.id, createdById: owner.id });
      expect(allocation.map((line) => [line.qty, line.unitCost])).toEqual([[2, 100], [1, 300]]);
      throw new Error("rollback-consumption");
    })).rejects.toThrow("rollback-consumption");
  });
});
