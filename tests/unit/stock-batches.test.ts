import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { todayISO } from "@/lib/dates";

const mocks = vi.hoisted(() => ({ owner: vi.fn(), user: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireOwner: mocks.owner, requireUser: mocks.user }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  return { prisma: new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL || "postgresql://wmc:wmc@localhost:5432/wmc225_test?schema=public" }) };
});
import { prisma as actionDb } from "@/lib/db";
import { receiveStockBatchAction, saveItemAction } from "@/actions/inventory";
import { createTransactionAction, recordPaymentAction, voidTransactionAction } from "@/actions/transactions";

const db = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL || "postgresql://wmc:wmc@localhost:5432/wmc225_test?schema=public" });
let customerId: number;
let itemId: number;
const state = { ok: false };
const form = (values: Record<string, string | number>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, String(value));
  return data;
};
const receive = (values: Record<string, string | number> = {}) => receiveStockBatchAction(state, form({
  itemId, code: "LOT-A", receivedDate: "2026-01-01", quantity: 2, unitCost: 101, ...values,
}));
const sell = (qty: number) => createTransactionAction({ customerId, vehicleId: null, mechanic: "", discount: 0,
  notes: "Batch test", dueDate: null, items: [{ itemId, qty }], payNow: 0, method: "tunai" });
const voidSale = (transactionId: string) => voidTransactionAction(state, form({ transactionId, reason: "Uji retur batch" }));

beforeAll(async () => {
  const owner = await db.user.findFirstOrThrow({ where: { role: "owner" } });
  mocks.owner.mockResolvedValue(owner);
  mocks.user.mockResolvedValue(owner);
  customerId = (await db.customer.create({ data: { name: "Batch integration test" } })).id;
  itemId = (await db.item.create({ data: { sku: "BATCH-INTEGRATION", name: "Batch test part", category: "sparepart", price: 1000, cost: 999 } })).id;
});

afterAll(async () => {
  if (customerId) await db.transaction.deleteMany({ where: { customerId } });
  if (itemId) {
    await db.stockBatch.deleteMany({ where: { itemId } });
    await db.item.delete({ where: { id: itemId } });
  }
  if (customerId) await db.customer.delete({ where: { id: customerId } });
  await Promise.all([db.$disconnect(), actionDb.$disconnect()]);
});

describe("batch stok dengan PostgreSQL", () => {
  it("migrasi mengubah saldo lama menjadi batch tanpa mengubah stok", async () => {
    await expect(db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('CREATE SCHEMA batch_migration_test');
      await tx.$executeRawUnsafe('SET LOCAL search_path TO batch_migration_test');
      const apply = async (name: string) => {
        const sql = readFileSync(`prisma/migrations/${name}/migration.sql`, "utf8");
        for (const statement of sql.split(";").filter((statement) => statement.trim())) {
          await tx.$executeRawUnsafe(statement);
        }
      };
      await apply("20261108224521_init");
      await tx.$executeRawUnsafe(`INSERT INTO items (sku,name,category,price,cost,stock) VALUES ('OLD','Lama','sparepart',1000,200,7),('ZERO','Kosong','sparepart',1000,200,0),('SVC','Jasa','jasa',1000,100,0)`);
      await apply("20261109030000_stock_batches");
      const batches = await tx.$queryRawUnsafe<{ code: string; quantity: number; remaining: number; unit_cost: number }[]>('SELECT code,quantity,remaining,unit_cost FROM stock_batches');
      expect(batches).toEqual([{ code: "STOK-AWAL", quantity: 7, remaining: 7, unit_cost: 200 }]);
      expect(await tx.$queryRawUnsafe('SELECT stock FROM items WHERE sku = \'OLD\'')).toEqual([{ stock: 7 }]);
      throw new Error("rollback-migration-check");
    })).rejects.toThrow("rollback-migration-check");
  });

  it("membatasi penerimaan ke pemilik dan memvalidasi jumlah/modal/tanggal", async () => {
    mocks.owner.mockRejectedValueOnce(new Error("forbidden"));
    await expect(receive()).rejects.toThrow("forbidden");
    const invalidInputs: Record<string, string | number>[] = [{ quantity: -1 }, { quantity: 1.5 }, { unitCost: -1 }, { unitCost: "" }, { receivedDate: "2026-02-30" }, { receivedDate: "2099-01-01" }, { code: "" }];
    for (const values of invalidInputs) {
      expect((await receive(values)).ok).toBe(false);
    }
    expect(await db.stockBatch.count({ where: { itemId } })).toBe(0);
  });

  it("menerima lot berbeda dan menolak kode duplikat tanpa menambah saldo", async () => {
    expect((await receive()).ok).toBe(true);
    expect((await receive({ code: " lot-a " })).ok).toBe(false);
    expect((await receive({ code: "LOT-B", receivedDate: "2026-01-02", quantity: 3, unitCost: 202 })).ok).toBe(true);
    expect((await db.item.findUniqueOrThrow({ where: { id: itemId } })).stock).toBe(5);
  });

  it("mengambil FIFO lintas lot dengan HPP tepat lalu mengembalikan ke lot asal", async () => {
    const result = await sell(4);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    const sale = await db.transaction.findUniqueOrThrow({ where: { id: result.id }, include: { items: true } });
    expect(sale.items.map((line) => [line.qty, line.unitCost])).toEqual([[2, 101], [2, 202]]);
    expect(sale.items.reduce((sum, line) => sum + line.qty * line.unitCost, 0)).toBe(606);
    expect(sale.total).toBe(4000);
    expect((await db.item.findUniqueOrThrow({ where: { id: itemId } })).stock).toBe(1);
    expect((await voidSale(result.id)).ok).toBe(true);
    expect((await voidSale(result.id)).ok).toBe(false);
    const batches = await db.stockBatch.findMany({ where: { itemId }, orderBy: { code: "asc" } });
    expect(batches.map((batch) => batch.remaining)).toEqual([2, 3]);
  });

  it("edit katalog tidak menimpa saldo atau modal batch", async () => {
    expect((await saveItemAction(state, form({ id: itemId, name: "Batch test part", sku: "BATCH-INTEGRATION", category: "sparepart", price: 1000, cost: 500, stock: 999 }))).ok).toBe(true);
    expect((await db.item.findUniqueOrThrow({ where: { id: itemId } })).stock).toBe(5);
    expect((await db.stockBatch.findMany({ where: { itemId }, orderBy: { code: "asc" } })).map((batch) => batch.unitCost)).toEqual([101, 202]);
    expect((await saveItemAction(state, form({ id: itemId, name: "Batch test part", sku: "BATCH-INTEGRATION", category: "jasa", price: 1000 }))).ok).toBe(false);
  });

  it("menolak stok kurang dan mencegah dua penjualan mengambil saldo sama", async () => {
    expect((await sell(6)).ok).toBe(false);
    const results = await Promise.all([sell(4), sell(4)]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect((await db.item.findUniqueOrThrow({ where: { id: itemId } })).stock).toBe(1);
    for (const result of results) if (result.ok) expect((await voidSale(result.id)).ok).toBe(true);
  });

  it("retur nota lama membuat batch dengan modal historis", async () => {
    const owner = await db.user.findFirstOrThrow({ where: { role: "owner" } });
    const sale = await db.transaction.create({ data: {
      invoiceNo: "BATCH-LEGACY-TEST", customerId, subtotal: 1000, total: 1000,
      businessDate: new Date(`${todayISO()}T00:00:00Z`), createdById: owner.id,
      items: { create: { itemId, name: "Batch test part", category: "sparepart", qty: 1, unitPrice: 1000, unitCost: 77, subtotal: 1000 } },
    } });
    expect((await voidSale(sale.id)).ok).toBe(true);
    const batch = await db.stockBatch.findFirstOrThrow({ where: { itemId, code: { startsWith: "RETUR-LAMA-" } } });
    expect([batch.remaining, batch.unitCost]).toEqual([1, 77]);
    const item = await db.item.findUniqueOrThrow({ where: { id: itemId }, include: { stockBatches: true } });
    expect(item.stock).toBe(item.stockBatches.reduce((sum, lot) => sum + lot.remaining, 0));
  });

  it("pembatalan bersamaan hanya mengembalikan satu kali dan aman terhadap pembayaran", async () => {
    const before = (await db.item.findUniqueOrThrow({ where: { id: itemId } })).stock;
    const sale = await sell(1);
    if (!sale.ok) throw new Error(sale.message);
    const voids = await Promise.all([voidSale(sale.id), voidSale(sale.id)]);
    expect(voids.filter((result) => result.ok)).toHaveLength(1);
    expect((await db.item.findUniqueOrThrow({ where: { id: itemId } })).stock).toBe(before);
    const next = await sell(1);
    if (!next.ok) throw new Error(next.message);
    const results = await Promise.all([recordPaymentAction(next.id, 1000, "tunai", ""), voidSale(next.id)]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    const record = await db.transaction.findUniqueOrThrow({ where: { id: next.id }, include: { payments: true } });
    expect(record.status === "batal" ? record.payments.length === 0 : record.payments.length === 1).toBe(true);
  });
});
