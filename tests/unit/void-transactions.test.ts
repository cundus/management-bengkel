import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient, type User } from "@prisma/client";
import { addDaysISO, parseDateOnly, todayISO } from "@/lib/dates";

const TEST_URL = process.env.TEST_DATABASE_URL || "postgresql://wmc:wmc@localhost:5432/wmc225_test?schema=public";
const mocks = vi.hoisted(() => ({ owner: vi.fn(), user: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireOwner: mocks.owner, requireUser: mocks.user }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  return { prisma: new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL || "postgresql://wmc:wmc@localhost:5432/wmc225_test?schema=public" }) };
});
import { prisma as actionDb } from "@/lib/db";
import {
  createTransactionAction,
  rejectVoidRequestAction,
  requestVoidAction,
  voidTransactionAction,
} from "@/actions/transactions";
import { getCancellationIncome, getRefundsByDate } from "@/lib/queries/voids";

const db = new PrismaClient({ datasourceUrl: TEST_URL });
let owner: User;
let kasir: User;
let customerId: number;
let itemId: number;
const state = { ok: false };
const form = (values: Record<string, string | number>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, String(value));
  return data;
};
const asOwner = () => { mocks.owner.mockResolvedValue(owner); mocks.user.mockResolvedValue(owner); };
const asKasir = () => { mocks.user.mockResolvedValue(kasir); };
const sell = async (payNow: number) => {
  const result = await createTransactionAction({ customerId, vehicleId: null, mechanic: "", discount: 0,
    notes: "Void test", dueDate: null, items: [{ itemId, qty: 1 }], payNow, method: "tunai" });
  if (!result.ok) throw new Error(result.message);
  return result.id;
};
const voidSale = (transactionId: string, extra: Record<string, string | number> = {}) =>
  voidTransactionAction(state, form({ transactionId, reason: "Uji pembatalan", ...extra }));
const stock = async () => (await db.item.findUniqueOrThrow({ where: { id: itemId } })).stock;

beforeAll(async () => {
  owner = await db.user.findFirstOrThrow({ where: { role: "owner" } });
  kasir = await db.user.findFirstOrThrow({ where: { role: "kasir" } });
  asOwner();
  customerId = (await db.customer.create({ data: { name: "Void integration test" } })).id;
  itemId = (await db.item.create({ data: { sku: "VOID-INTEGRATION", name: "Void test part", category: "sparepart", price: 1000, cost: 400 } })).id;
  const received = await import("@/actions/inventory").then(({ receiveStockBatchAction }) =>
    receiveStockBatchAction(state, form({ itemId, code: "VOID-LOT", receivedDate: "2026-01-01", quantity: 20, unitCost: 400 })));
  if (!received.ok) throw new Error(received.message);
});

afterAll(async () => {
  await db.setting.deleteMany({ where: { key: "void_max_days" } });
  if (customerId) {
    await db.refund.deleteMany({ where: { transaction: { customerId } } });
    await db.stockMovement.deleteMany({ where: { itemId } });
    await db.transaction.deleteMany({ where: { customerId } });
  }
  if (itemId) {
    await db.stockBatch.deleteMany({ where: { itemId } });
    await db.item.delete({ where: { id: itemId } });
  }
  if (customerId) await db.customer.delete({ where: { id: customerId } });
  await Promise.all([db.$disconnect(), actionDb.$disconnect()]);
});

describe("pembatalan nota dengan PostgreSQL", () => {
  it("membatalkan nota lunas dengan refund sebagian tanpa menghapus pembayaran", async () => {
    asOwner();
    const before = await stock();
    const id = await sell(1000);
    const today = parseDateOnly(todayISO());
    const refundsBefore = await getRefundsByDate(today, today);
    const incomeBefore = await getCancellationIncome(today, today);

    const result = await voidSale(id, { refundAmount: 600, refundMethod: "transfer" });
    expect(result.ok).toBe(true);

    const record = await db.transaction.findUniqueOrThrow({ where: { id }, include: { payments: true, refunds: true } });
    expect(record.status).toBe("batal");
    expect(record.voidedById).toBe(owner.id);
    expect(record.voidedDate?.toISOString().slice(0, 10)).toBe(todayISO());
    expect(record.payments).toHaveLength(1);
    expect(record.refunds).toEqual([expect.objectContaining({ amount: 600, method: "transfer", createdById: owner.id })]);
    expect(await stock()).toBe(before);

    expect((await getRefundsByDate(today, today)).total - refundsBefore.total).toBe(600);
    expect((await getCancellationIncome(today, today)) - incomeBefore).toBe(400);
  });

  it("tidak membuat refund bila nominal nol dan menolak refund melebihi pembayaran", async () => {
    asOwner();
    const id = await sell(500);
    const tooMuch = await voidSale(id, { refundAmount: 501 });
    expect(tooMuch.ok).toBe(false);
    expect((await db.transaction.findUniqueOrThrow({ where: { id } })).status).toBe("selesai");

    expect((await voidSale(id, { refundAmount: 0 })).ok).toBe(true);
    expect(await db.refund.count({ where: { transactionId: id } })).toBe(0);
    expect((await voidSale(id)).ok).toBe(false);
  });

  it("menolak pembatalan dan pengajuan di luar batas hari", async () => {
    asOwner();
    const id = await sell(0);
    await db.transaction.update({ where: { id }, data: { businessDate: parseDateOnly(addDaysISO(todayISO(), -5)) } });
    await db.setting.upsert({ where: { key: "void_max_days" }, update: { value: "3" }, create: { key: "void_max_days", value: "3" } });
    try {
      const result = await voidSale(id);
      expect(result.ok).toBe(false);
      expect(result.message).toContain("3 hari");
      asKasir();
      expect((await requestVoidAction(state, form({ transactionId: id, reason: "Telat" }))).ok).toBe(false);
    } finally {
      await db.setting.deleteMany({ where: { key: "void_max_days" } });
      asOwner();
    }
    expect((await voidSale(id)).ok).toBe(true);
  });

  it("kasir mengajukan, pemilik menolak, lalu menyetujui pengajuan berikutnya", async () => {
    asOwner();
    const before = await stock();
    const id = await sell(1000);

    expect((await requestVoidAction(state, form({ transactionId: id, reason: "Pemilik tidak boleh mengajukan" }))).ok).toBe(false);

    asKasir();
    expect((await requestVoidAction(state, form({ transactionId: id, reason: "" }))).ok).toBe(false);
    const requests = await Promise.all([
      requestVoidAction(state, form({ transactionId: id, reason: "Pelanggan batal" })),
      requestVoidAction(state, form({ transactionId: id, reason: "Pelanggan batal" })),
    ]);
    expect(requests.filter((result) => result.ok)).toHaveLength(1);
    const first = await db.voidRequest.findFirstOrThrow({ where: { transactionId: id, status: "pending" } });
    expect(first.requestedById).toBe(kasir.id);

    asOwner();
    expect((await rejectVoidRequestAction(state, form({ requestId: first.id, note: "Sudah dikerjakan" }))).ok).toBe(true);
    expect((await rejectVoidRequestAction(state, form({ requestId: first.id }))).ok).toBe(false);
    const rejected = await db.voidRequest.findUniqueOrThrow({ where: { id: first.id } });
    expect(rejected).toMatchObject({ status: "ditolak", reviewedById: owner.id, reviewNote: "Sudah dikerjakan" });
    expect((await db.transaction.findUniqueOrThrow({ where: { id } })).status).toBe("selesai");

    asKasir();
    expect((await requestVoidAction(state, form({ transactionId: id, reason: "Ajukan ulang" }))).ok).toBe(true);
    asOwner();
    expect((await voidSale(id, { refundAmount: 1000 })).ok).toBe(true);
    const second = await db.voidRequest.findFirstOrThrow({ where: { transactionId: id, reason: "Ajukan ulang" } });
    expect(second).toMatchObject({ status: "disetujui", reviewedById: owner.id });
    expect(await stock()).toBe(before);

    asKasir();
    expect((await requestVoidAction(state, form({ transactionId: id, reason: "Sudah batal" }))).ok).toBe(false);
    asOwner();
  });
});
