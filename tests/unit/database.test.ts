import fs from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";

if (!process.env.TEST_DATABASE_URL && fs.existsSync(".env")) {
  process.loadEnvFile(".env");
}

const testUrl =
  process.env.TEST_DATABASE_URL ||
  "postgresql://wmc:wmc@localhost:5432/wmc225_test?schema=public";
const prisma = new PrismaClient({ datasourceUrl: testUrl });

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("integritas seed PostgreSQL", () => {
  it("menolak username duplikat pada database", async () => {
    await expect(prisma.user.create({ data: {
      name: "Duplikat", email: "duplicate-username@example.test", username: "owner", passwordHash: "test-hash", role: "kasir",
    } })).rejects.toMatchObject({ code: "P2002" });
  });

  it("menolak username nonkanonik pada database", async () => {
    await expect(prisma.user.create({ data: {
      name: "Nonkanonik", email: "invalid-username@example.test", username: "OWNER", passwordHash: "test-hash", role: "kasir",
    } })).rejects.toThrow();
  });

  it("mempertahankan dukungan beberapa akun lama tanpa username", async () => {
    await expect(prisma.$transaction(async (tx) => {
      await tx.user.createMany({ data: [1, 2].map((id) => ({
        name: `Legacy ${id}`, email: `legacy-null-${id}@example.test`, passwordHash: "test-hash", role: "kasir" as const,
      })) });
      const users = await tx.user.findMany({ where: { email: { in: ["legacy-null-1@example.test", "legacy-null-2@example.test"] } } });
      expect(users).toHaveLength(2);
      expect(users.every((user) => user.username === null)).toBe(true);
      throw new Error("rollback-legacy-check");
    })).rejects.toThrow("rollback-legacy-check");
  });

  it("mengisi data demo inti dan brand WMC 225", async () => {
    const [users, customers, transactions, items, expenses, payables, brand] = await Promise.all([
      prisma.user.count(),
      prisma.customer.count(),
      prisma.transaction.count(),
      prisma.item.count(),
      prisma.expense.count(),
      prisma.payable.count(),
      prisma.setting.findUnique({ where: { key: "workshop_name" } }),
    ]);
    expect(users).toBe(2);
    expect(customers).toBeGreaterThan(5);
    expect(transactions).toBeGreaterThan(50);
    expect(items).toBeGreaterThan(5);
    expect(expenses).toBeGreaterThan(0);
    expect(payables).toBeGreaterThan(0);
    expect(brand?.value).toBe("WMC 225");
  });

  it("tidak pernah menerima pembayaran melebihi total nota", async () => {
    const transactions = await prisma.transaction.findMany({
      include: { payments: { select: { amount: true } } },
    });
    for (const transaction of transactions) {
      const paid = transaction.payments.reduce((sum, payment) => sum + payment.amount, 0);
      expect(paid, transaction.invoiceNo).toBeLessThanOrEqual(transaction.total);
    }
  });

  it("memastikan total nota konsisten dengan subtotal dan diskon", async () => {
    const invalid = await prisma.transaction.findMany({
      where: {},
      select: { id: true, subtotal: true, discount: true, total: true },
    });
    expect(invalid.filter((transaction) => transaction.total !== transaction.subtotal - transaction.discount)).toEqual([]);
  });

  it("tidak memiliki stok negatif dan invoice duplikat", async () => {
    const negativeStock = await prisma.item.count({ where: { stock: { lt: 0 } } });
    expect(negativeStock).toBe(0);

    const invoiceNos = await prisma.transaction.findMany({ select: { invoiceNo: true } });
    expect(new Set(invoiceNos.map((transaction) => transaction.invoiceNo)).size).toBe(invoiceNos.length);
  });

  it("menyimpan hash kata sandi dan akun demo WMC 225", async () => {
    const users = await prisma.user.findMany();
    expect(users.map((user) => user.email).sort()).toEqual(["kasir@wmc225.id", "owner@wmc225.id"]);
    for (const user of users) {
      expect(user.passwordHash).not.toContain("wmc225");
      expect(user.passwordHash.startsWith("$2")).toBe(true);
    }
  });
});
