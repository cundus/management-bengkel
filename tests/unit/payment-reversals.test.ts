import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient, type User } from "@prisma/client";
import { parseDateOnly, todayISO } from "@/lib/dates";

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
  recordPaymentAction,
  reversePaymentAction,
  voidTransactionAction,
} from "@/actions/transactions";
import { recordPayablePaymentAction, reversePayablePaymentAction } from "@/actions/finance";
import { getTransactionById } from "@/lib/queries/transactions";
import { listPayables } from "@/lib/queries/finance";
import { getCashSection, type ReportRange } from "@/lib/queries/reports";

const db = new PrismaClient({ datasourceUrl: TEST_URL });
let owner: User;
let customerId: number;
let itemId: number;
let supplierId: number;
const state = { ok: false };
const form = (values: Record<string, string | number>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, String(value));
  return data;
};
const today = todayISO();
// Tanggal lampau khusus tes ini agar laporan kas tidak tercampur file tes lain yang berjalan paralel.
const DAY1 = "2001-02-01";
const DAY2 = "2001-02-02";
const isolatedRange: ReportRange = { month: "2001-02", start: DAY1, end: DAY2, previousStart: DAY1, previousEnd: DAY2, length: 2 };

const sell = async (payNow: number, method: "tunai" | "transfer" | "qris" = "tunai") => {
  const result = await createTransactionAction({ customerId, vehicleId: null, mechanic: "", discount: 0,
    notes: "Reversal test", dueDate: null, items: [{ itemId, qty: 1 }], payNow, method });
  if (!result.ok) throw new Error(result.message);
  return result.id;
};
const reverse = (transactionId: string, paymentId: number, reason = "Salah input") =>
  reversePaymentAction(state, form({ transactionId, paymentId, reason }));
const firstPayment = async (transactionId: string) =>
  db.payment.findFirstOrThrow({ where: { transactionId, reversesPaymentId: null }, orderBy: { id: "asc" } });

beforeAll(async () => {
  owner = await db.user.findFirstOrThrow({ where: { role: "owner" } });
  mocks.owner.mockResolvedValue(owner);
  mocks.user.mockResolvedValue(owner);
  customerId = (await db.customer.create({ data: { name: "Reversal integration test" } })).id;
  // Jasa: tidak menyentuh stok sehingga tes fokus pada pembayaran.
  itemId = (await db.item.create({ data: { sku: "REVERSAL-INTEGRATION", name: "Reversal test service", category: "jasa", price: 1000, cost: 0 } })).id;
  supplierId = (await db.supplier.create({ data: { name: "Reversal integration supplier" } })).id;
});

afterAll(async () => {
  if (customerId) {
    await db.refund.deleteMany({ where: { transaction: { customerId } } });
    await db.transaction.deleteMany({ where: { customerId } });
    await db.customer.delete({ where: { id: customerId } });
  }
  if (itemId) await db.item.delete({ where: { id: itemId } });
  if (supplierId) {
    await db.payable.deleteMany({ where: { supplierId } });
    await db.supplier.delete({ where: { id: supplierId } });
  }
  await Promise.all([db.$disconnect(), actionDb.$disconnect()]);
});

describe("koreksi pembayaran pelanggan dengan PostgreSQL", () => {
  it("membalik pembayaran tanpa menghapusnya, lalu pembayaran benar bisa dicatat ulang", async () => {
    const id = await sell(1000, "tunai");
    const original = await firstPayment(id);

    const result = await reverse(id, original.id, "Seharusnya transfer");
    expect(result.ok).toBe(true);

    const rows = await db.payment.findMany({ where: { transactionId: id }, orderBy: { id: "asc" } });
    expect(rows).toEqual([
      expect.objectContaining({ id: original.id, amount: 1000, method: "tunai", reversesPaymentId: null }),
      expect.objectContaining({ amount: -1000, method: "tunai", reversesPaymentId: original.id, receivedById: owner.id, notes: "Seharusnya transfer" }),
    ]);
    expect(rows[1].businessDate.toISOString().slice(0, 10)).toBe(today);

    let detail = await getTransactionById(id);
    expect(detail).toMatchObject({ paid: 0, remaining: 1000, paymentStatus: "belum_bayar" });
    expect(detail?.payments.find((payment) => payment.id === original.id)?.reversed).toBe(true);

    expect((await recordPaymentAction(id, 1000, "transfer", "")).ok).toBe(true);
    detail = await getTransactionById(id);
    expect(detail).toMatchObject({ paid: 1000, remaining: 0, paymentStatus: "lunas" });

    // Pembayaran asli di hari pertama, koreksi + pembayaran ulang di hari berikutnya.
    await db.payment.update({ where: { id: original.id }, data: { businessDate: parseDateOnly(DAY1) } });
    await db.payment.updateMany({ where: { transactionId: id, id: { not: original.id } }, data: { businessDate: parseDateOnly(DAY2) } });
    const cash = await getCashSection(isolatedRange);
    expect(cash.cashIn).toBe(1000);
    expect(cash.byDate.get(DAY1)).toBe(1000);
    expect(cash.byDate.get(DAY2)).toBe(0);
    expect(cash.paymentMethods).toEqual([{ method: "transfer", amount: 1000, count: 1 }]);
  });

  it("menolak koreksi ganda, koreksi atas entri koreksi, dan alasan kosong", async () => {
    const id = await sell(600);
    const original = await firstPayment(id);

    expect((await reverse(id, original.id, "")).ok).toBe(false);
    const attempts = await Promise.all([reverse(id, original.id), reverse(id, original.id)]);
    expect(attempts.filter((attempt) => attempt.ok)).toHaveLength(1);

    const reversal = await db.payment.findUniqueOrThrow({ where: { reversesPaymentId: original.id } });
    expect((await reverse(id, reversal.id)).ok).toBe(false);
    expect(await db.payment.count({ where: { transactionId: id } })).toBe(2);
  });

  it("menolak koreksi pada nota lain dan nota yang dibatalkan", async () => {
    const id = await sell(500);
    const other = await sell(0);
    const original = await firstPayment(id);
    expect((await reverse(other, original.id)).ok).toBe(false);

    expect((await voidTransactionAction(state, form({ transactionId: id, reason: "Uji", refundAmount: 500 }))).ok).toBe(true);
    const result = await reverse(id, original.id);
    expect(result.ok).toBe(false);
    expect(result.message).toContain("dibatalkan");
  });

  it("database menolak entri pembalik yang tidak sah", async () => {
    const id = await sell(700);
    const other = await sell(300);
    const original = await firstPayment(id);
    const base = { method: "tunai" as const, businessDate: parseDateOnly(today), receivedById: owner.id };

    await expect(db.payment.create({ data: { ...base, transactionId: id, amount: 0 } })).rejects.toThrow();
    await expect(db.payment.create({ data: { ...base, transactionId: id, amount: -700 } })).rejects.toThrow();
    await expect(db.payment.create({ data: { ...base, transactionId: id, amount: -500, reversesPaymentId: original.id } })).rejects.toThrow(/sama dengan pembayaran asli/);
    await expect(db.payment.create({ data: { ...base, transactionId: other, amount: -700, reversesPaymentId: original.id } })).rejects.toThrow(/nota yang sama/);
    await expect(db.payment.create({ data: { ...base, transactionId: id, amount: 700, reversesPaymentId: original.id } })).rejects.toThrow();
    expect(await db.payment.count({ where: { transactionId: id } })).toBe(1);
  });
});

describe("koreksi pembayaran hutang supplier dengan PostgreSQL", () => {
  it("membalik pembayaran hutang dan mengembalikan sisa hutang", async () => {
    const payable = await db.payable.create({
      data: { supplierId, description: "Reversal payable", amount: 5000, businessDate: parseDateOnly(today), createdById: owner.id },
    });
    expect((await recordPayablePaymentAction(state, form({ payableId: payable.id, amount: 5000, method: "transfer" }))).ok).toBe(true);
    const original = await db.payablePayment.findFirstOrThrow({ where: { payableId: payable.id } });

    expect((await reversePayablePaymentAction(state, form({ paymentId: original.id, reason: "" }))).ok).toBe(false);
    expect((await reversePayablePaymentAction(state, form({ paymentId: original.id, reason: "Nominal salah" }))).ok).toBe(true);
    expect((await reversePayablePaymentAction(state, form({ paymentId: original.id, reason: "Lagi" }))).ok).toBe(false);

    const listed = (await listPayables({ includePaid: true })).find((row) => row.id === payable.id);
    expect(listed).toMatchObject({ paid: 0, remaining: 5000 });
    expect(listed?.payments.find((payment) => payment.id === original.id)?.reversed).toBe(true);
    const reversal = listed?.payments.find((payment) => payment.reversesPaymentId === original.id);
    expect(reversal).toMatchObject({ amount: -5000, method: "transfer", notes: "Nominal salah" });
    expect((await reversePayablePaymentAction(state, form({ paymentId: reversal!.id, reason: "Balik koreksi" }))).ok).toBe(false);

    await db.payablePayment.update({ where: { id: original.id }, data: { businessDate: parseDateOnly(DAY1) } });
    await db.payablePayment.update({ where: { id: reversal!.id }, data: { businessDate: parseDateOnly(DAY2) } });
    const cash = await getCashSection(isolatedRange);
    expect(cash.payableCashOut).toBe(0);
  });
});
