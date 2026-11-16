import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient, type User } from "@prisma/client";
import { parseDateOnly, todayISO } from "@/lib/dates";

const TEST_URL = process.env.TEST_DATABASE_URL || "postgresql://wmc:wmc@localhost:5432/wmc225_test?schema=public";
const auth = vi.hoisted(() => ({ owner: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireOwner: auth.owner }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  return { prisma: new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL || "postgresql://wmc:wmc@localhost:5432/wmc225_test?schema=public" }) };
});
import { prisma as actionDb } from "@/lib/db";
import { createExpenseAction, reverseExpenseAction } from "@/actions/finance";
import { createPurchaseAction } from "@/actions/purchases";
import { listExpenses } from "@/lib/queries/finance";

const db = new PrismaClient({ datasourceUrl: TEST_URL });
const TAG = "Expense correction integration test";
const PURCHASE_AMOUNT = 987_654;
let owner: User;
let supplierId: number;
let itemId: number;

const state = { ok: false };
const form = (values: Record<string, string | number>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, String(value));
  return data;
};
const expenseForm = (overrides: Record<string, string | number> = {}) =>
  form({ expenseDate: todayISO(), category: "Operasional", description: TAG, amount: 250_000, ...overrides });

beforeAll(async () => {
  owner = await db.user.findFirstOrThrow({ where: { role: "owner" } });
  auth.owner.mockResolvedValue(owner);
  supplierId = (await db.supplier.create({ data: { name: `${TAG} supplier` } })).id;
  itemId = (await db.item.create({
    data: { sku: `EXPENSE-TEST-${Date.now()}`, name: `${TAG} item`, category: "sparepart", price: 1_000_000, cost: 900_000 },
  })).id;
});

afterAll(async () => {
  if (supplierId) {
    await db.stockMovement.deleteMany({ where: { itemId } });
    await db.stockBatch.deleteMany({ where: { itemId } });
    await db.purchase.deleteMany({ where: { supplierId } });
    await db.payable.deleteMany({ where: { supplierId } });
    await db.supplier.delete({ where: { id: supplierId } }).catch(() => undefined);
  }
  if (itemId) await db.item.delete({ where: { id: itemId } }).catch(() => undefined);
  await db.expense.deleteMany({ where: { description: { contains: TAG }, reversesExpenseId: { not: null } } });
  await db.expense.deleteMany({ where: { description: { contains: TAG } } });
  await Promise.all([db.$disconnect(), actionDb.$disconnect()]);
});

describe("pencegahan pengeluaran ganda dan koreksi pengeluaran", () => {
  it("meminta konfirmasi saat pengeluaran menyerupai pembelian stok, lalu tetap bisa disimpan sebagai biaya lain", async () => {
    const purchase = await createPurchaseAction({
      requestId: randomUUID(), supplierId, referenceNo: "", businessDate: todayISO(), dueDate: null,
      notes: TAG, payNow: PURCHASE_AMOUNT, method: "tunai",
      lines: [{ itemId, code: "EXPENSE-DUP", quantity: 1, unitCost: PURCHASE_AMOUNT }],
    });
    if (!purchase.ok) throw new Error(purchase.message);

    const duplicate = await createExpenseAction(state, expenseForm({
      description: `${TAG} duplikat pembelian`,
      category: "Operasional",
      amount: PURCHASE_AMOUNT,
    }));
    expect(duplicate.ok).toBe(false);
    expect(duplicate.warning).toMatchObject({ kind: "duplikat-pembelian", purchaseId: purchase.id, total: PURCHASE_AMOUNT });
    expect(duplicate.message).toContain("PB-");
    expect(await db.expense.count({ where: { description: `${TAG} duplikat pembelian` } })).toBe(0);

    const confirmed = await createExpenseAction(state, expenseForm({
      description: `${TAG} duplikat pembelian`,
      category: "Operasional",
      amount: PURCHASE_AMOUNT,
      confirmDuplicate: "1",
    }));
    expect(confirmed.ok).toBe(true);
    expect(await db.expense.count({ where: { description: `${TAG} duplikat pembelian` } })).toBe(1);
  });

  it("meminta konfirmasi saat pembelian dibuat setelah pengeluaran bernominal sama", async () => {
    const first = await createExpenseAction(state, expenseForm({
      description: `${TAG} expense lebih dulu`,
      amount: 555_555,
    }));
    expect(first.ok).toBe(true);
    const expense = await db.expense.findFirstOrThrow({ where: { description: `${TAG} expense lebih dulu` } });

    const purchaseInput = {
      requestId: randomUUID(), supplierId, referenceNo: "", businessDate: todayISO(), dueDate: null,
      notes: TAG, payNow: 555_555, method: "tunai",
      lines: [{ itemId, code: "EXPENSE-FIRST", quantity: 1, unitCost: 555_555 }],
    };
    const warned = await createPurchaseAction(purchaseInput);
    expect(warned.ok).toBe(false);
    if (warned.ok) throw new Error("Pembelian seharusnya meminta konfirmasi.");
    expect(warned.warning).toMatchObject({ kind: "duplikat-pengeluaran", expenseId: expense.id, amount: 555_555 });
    expect(await db.purchase.count({ where: { supplierId, notes: TAG } })).toBe(1); // hanya pembelian dari tes pertama

    const confirmed = await createPurchaseAction({
      ...purchaseInput,
      requestId: randomUUID(),
      confirmDuplicate: true,
    });
    expect(confirmed.ok).toBe(true);
    expect(await db.purchase.count({ where: { supplierId, notes: TAG } })).toBe(2);
  });

  it("membalik pengeluaran tanpa menghapusnya dan menolak koreksi ganda", async () => {
    const created = await createExpenseAction(state, expenseForm({ description: `${TAG} salah input`, amount: 250_000 }));
    expect(created.ok).toBe(true);
    const original = await db.expense.findFirstOrThrow({ where: { description: `${TAG} salah input` } });

    expect((await reverseExpenseAction(state, form({ expenseId: original.id, reason: "" }))).ok).toBe(false);
    const attempts = await Promise.all([
      reverseExpenseAction(state, form({ expenseId: original.id, reason: `${TAG} salah kategori` })),
      reverseExpenseAction(state, form({ expenseId: original.id, reason: `${TAG} salah kategori` })),
    ]);
    expect(attempts.filter((attempt) => attempt.ok)).toHaveLength(1);

    const reversal = await db.expense.findUniqueOrThrow({ where: { reversesExpenseId: original.id } });
    expect(reversal).toMatchObject({ amount: -250_000, category: "Operasional", createdById: owner.id });
    expect((await reverseExpenseAction(state, form({ expenseId: reversal.id, reason: `${TAG} balik koreksi` }))).ok).toBe(false);

    const net = await db.expense.aggregate({
      where: { id: { in: [original.id, reversal.id] } },
      _sum: { amount: true },
    });
    expect(net._sum.amount).toBe(0);

    const listed = (await listExpenses({ month: todayISO().slice(0, 7), limit: 500 })).rows;
    expect(listed.find((expense) => expense.id === original.id)?.reversed).toBe(true);
    expect(listed.find((expense) => expense.id === reversal.id)?.reversesExpenseId).toBe(original.id);
  });

  it("database menolak entri koreksi yang tidak sah", async () => {
    const created = await createExpenseAction(state, expenseForm({ description: `${TAG} constraint`, amount: 100_000 }));
    expect(created.ok).toBe(true);
    const original = await db.expense.findFirstOrThrow({ where: { description: `${TAG} constraint` } });
    const base = { expenseDate: parseDateOnly(todayISO()), createdById: owner.id, reversesExpenseId: original.id };

    await expect(db.expense.create({
      data: { ...base, category: "Operasional", description: `${TAG} nominal positif`, amount: 100_000 },
    })).rejects.toThrow();
    await expect(db.expense.create({
      data: { ...base, category: "Gaji", description: `${TAG} kategori salah`, amount: -100_000 },
    })).rejects.toThrow(/kategori/);
    await expect(db.expense.create({
      data: { ...base, category: "Operasional", description: `${TAG} nominal salah`, amount: -50_000 },
    })).rejects.toThrow(/Nominal/);
    expect(await db.expense.count({ where: { description: { contains: `${TAG} constraint` } } })).toBe(1);
  });
});