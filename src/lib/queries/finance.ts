import { prisma } from "../db";
import { dateOnlyToISO, dateTimeToISO, monthRange, parseDateOnly, todayISO } from "../dates";
import type { Expense, Payable, PayablePayment, Supplier } from "../types";

export async function listExpenses(options?: { month?: string; limit?: number }): Promise<{
  rows: Expense[];
  total: number;
  byCategory: { category: string; amount: number }[];
}> {
  const dateFilter = options?.month
    ? (() => {
        const { start, end } = monthRange(options.month!);
        return { gte: parseDateOnly(start), lte: parseDateOnly(end) };
      })()
    : undefined;

  const rows = await prisma.expense.findMany({
    where: dateFilter ? { expenseDate: dateFilter } : {},
    include: { createdBy: true },
    orderBy: [{ expenseDate: "desc" }, { id: "desc" }],
    take: options?.limit ?? 100,
  });

  const allForPeriod = await prisma.expense.findMany({
    where: dateFilter ? { expenseDate: dateFilter } : {},
    select: { category: true, amount: true },
  });
  const categoryMap = new Map<string, number>();
  for (const expense of allForPeriod) {
    categoryMap.set(expense.category, (categoryMap.get(expense.category) ?? 0) + expense.amount);
  }

  return {
    rows: rows.map((expense) => ({
      id: expense.id,
      expenseDate: dateOnlyToISO(expense.expenseDate),
      category: expense.category,
      description: expense.description,
      amount: expense.amount,
      createdByName: expense.createdBy.name,
      createdAt: dateTimeToISO(expense.createdAt),
    })),
    total: allForPeriod.reduce((sum, expense) => sum + expense.amount, 0),
    byCategory: [...categoryMap.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
  };
}

export async function listPayables(options?: { includePaid?: boolean }): Promise<Payable[]> {
  const rows = await prisma.payable.findMany({
    include: {
      supplier: true,
      payments: { orderBy: { paidAt: "desc" } },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  });

  return rows
    .map((payable) => {
      const paid = payable.payments.reduce((sum, payment) => sum + payment.amount, 0);
      const payments: PayablePayment[] = payable.payments.map((payment) => ({
        id: payment.id,
        amount: payment.amount,
        method: payment.method,
        businessDate: dateOnlyToISO(payment.businessDate),
        paidAt: dateTimeToISO(payment.paidAt),
        notes: payment.notes,
      }));
      return {
        id: payable.id,
        supplierId: payable.supplierId,
        supplierName: payable.supplier.name,
        supplierPhone: payable.supplier.phone,
        referenceNo: payable.referenceNo,
        description: payable.description,
        amount: payable.amount,
        paid,
        remaining: Math.max(0, payable.amount - paid),
        businessDate: dateOnlyToISO(payable.businessDate),
        dueDate: payable.dueDate ? dateOnlyToISO(payable.dueDate) : null,
        createdAt: dateTimeToISO(payable.createdAt),
        payments,
      };
    })
    .filter((payable) => options?.includePaid || payable.remaining > 0);
}

export async function getPayableSummary(): Promise<{
  total: number;
  count: number;
  overdue: number;
  overdueCount: number;
  paidThisMonth: number;
}> {
  const today = todayISO();
  const startOfMonth = parseDateOnly(`${today.slice(0, 7)}-01`);
  const [payables, paidThisMonthAggregate] = await Promise.all([
    prisma.payable.findMany({ include: { payments: { select: { amount: true } } } }),
    prisma.payablePayment.aggregate({
      where: { businessDate: { gte: startOfMonth, lte: parseDateOnly(today) } },
      _sum: { amount: true },
    }),
  ]);

  return payables.reduce(
    (acc, payable) => {
      const paid = payable.payments.reduce((sum, payment) => sum + payment.amount, 0);
      const remaining = Math.max(0, payable.amount - paid);
      if (remaining <= 0) return acc;
      acc.total += remaining;
      acc.count += 1;
      if (payable.dueDate && dateOnlyToISO(payable.dueDate) < today) {
        acc.overdue += remaining;
        acc.overdueCount += 1;
      }
      return acc;
    },
    {
      total: 0,
      count: 0,
      overdue: 0,
      overdueCount: 0,
      paidThisMonth: paidThisMonthAggregate._sum.amount ?? 0,
    },
  );
}

export async function listSuppliers(): Promise<Supplier[]> {
  const rows = await prisma.supplier.findMany({ orderBy: { name: "asc" } });
  return rows.map((supplier) => ({
    id: supplier.id,
    name: supplier.name,
    contactPerson: supplier.contactPerson,
    phone: supplier.phone,
    notes: supplier.notes,
    createdAt: dateTimeToISO(supplier.createdAt),
  }));
}

export async function getExpenseTotalForMonth(month: string): Promise<number> {
  const { start, end } = monthRange(month);
  const aggregate = await prisma.expense.aggregate({
    where: { expenseDate: { gte: parseDateOnly(start), lte: parseDateOnly(end) } },
    _sum: { amount: true },
  });
  return aggregate._sum.amount ?? 0;
}

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany();
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

export async function getCounts(): Promise<{
  customers: number;
  vehicles: number;
  items: number;
  lowStock: number;
  suppliers: number;
  outstandingTransactions: number;
}> {
  const [customers, vehicles, items, spares, suppliers, transactions] = await Promise.all([
    prisma.customer.count(),
    prisma.vehicle.count(),
    prisma.item.count({ where: { isActive: true } }),
    prisma.item.findMany({
      where: { category: "sparepart", isActive: true },
      select: { stock: true, minStock: true },
    }),
    prisma.supplier.count(),
    prisma.transaction.findMany({
      where: { status: "selesai" },
      select: { total: true, payments: { select: { amount: true } } },
    }),
  ]);

  return {
    customers,
    vehicles,
    items,
    lowStock: spares.filter((item) => item.stock <= item.minStock).length,
    suppliers,
    outstandingTransactions: transactions.filter((transaction) => {
      const paid = transaction.payments.reduce((sum, payment) => sum + payment.amount, 0);
      return transaction.total - paid > 0;
    }).length,
  };
}
