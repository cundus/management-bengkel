import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { dateOnlyToISO, dateTimeToISO, todayISO } from "../dates";
import { agingBucket, paymentStatus, remainingAmount } from "../calculations";
import { listTransactionInclude, mapTransactionList, openTransactionRecords } from "./mappers";
import type {
  Payment,
  ReceivableFilter,
  TransactionDetail,
  TransactionItem,
  TransactionListRow,
  TransaksiStatusFilter,
  Vehicle,
} from "../types";

export async function listTransactions(options: {
  search?: string;
  status?: TransaksiStatusFilter;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: TransactionListRow[]; total: number; page: number; pageCount: number }> {
  const search = (options.search ?? "").trim();
  const status = options.status ?? "semua";
  const pageSize = options.pageSize ?? 20;
  const page = Math.max(1, options.page ?? 1);

  const where: Prisma.TransactionWhereInput = search
    ? {
        OR: [
          { invoiceNo: { contains: search, mode: "insensitive" } },
          { customer: { name: { contains: search, mode: "insensitive" } } },
          { customer: { phone: { contains: search, mode: "insensitive" } } },
          { vehicle: { plateNumber: { contains: search, mode: "insensitive" } } },
          { vehicle: { brand: { contains: search, mode: "insensitive" } } },
          { vehicle: { model: { contains: search, mode: "insensitive" } } },
        ],
      }
    : {};

  const records = await prisma.transaction.findMany({
    where,
    include: listTransactionInclude,
    orderBy: [{ createdAt: "desc" }, { businessDate: "desc" }],
  });

  const filtered = records
    .map(mapTransactionList)
    .filter((row) => {
      if (status === "lunas") return row.paymentStatus === "lunas";
      if (status === "belum_bayar") return row.paymentStatus === "belum_bayar";
      if (status === "sebagian") return row.paymentStatus === "sebagian";
      return true;
    });

  const total = filtered.length;
  return {
    rows: filtered.slice((page - 1) * pageSize, page * pageSize),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getTransactionById(id: string): Promise<TransactionDetail | null> {
  const record = await prisma.transaction.findUnique({
    where: { id },
    include: {
      customer: true,
      vehicle: true,
      createdBy: true,
      items: { orderBy: { id: "asc" }, include: { stockBatch: { select: { code: true } } } },
      payments: { include: { receivedBy: true }, orderBy: { paidAt: "desc" } },
    },
  });
  if (!record) return null;

  const paid = record.payments.reduce((sum, payment) => sum + payment.amount, 0);
  const items: TransactionItem[] = record.items.map((item) => ({
    id: item.id,
    itemId: item.itemId,
    name: item.name,
    category: item.category,
    qty: item.qty,
    unitPrice: item.unitPrice,
    unitCost: item.unitCost,
    stockBatchCode: item.stockBatch?.code ?? null,
    subtotal: item.subtotal,
  }));
  const payments: Payment[] = record.payments.map((payment) => ({
    id: payment.id,
    amount: payment.amount,
    method: payment.method,
    notes: payment.notes,
    businessDate: dateOnlyToISO(payment.businessDate),
    paidAt: dateTimeToISO(payment.paidAt),
    receivedByName: payment.receivedBy.name,
  }));
  const vehicle: Vehicle | null = record.vehicle
    ? {
        id: record.vehicle.id,
        customerId: record.vehicle.customerId,
        plateNumber: record.vehicle.plateNumber,
        brand: record.vehicle.brand,
        model: record.vehicle.model,
        year: record.vehicle.year,
        color: record.vehicle.color,
        odometer: record.vehicle.odometer,
        createdAt: dateTimeToISO(record.vehicle.createdAt),
      }
    : null;

  return {
    id: record.id,
    invoiceNo: record.invoiceNo,
    customerId: record.customerId,
    customerName: record.customer.name,
    customerPhone: record.customer.phone,
    customerAddress: record.customer.address,
    plateNumber: record.vehicle?.plateNumber ?? null,
    vehicleLabel: record.vehicle ? `${record.vehicle.brand} ${record.vehicle.model}` : null,
    mechanic: record.mechanic,
    subtotal: record.subtotal,
    discount: record.discount,
    total: record.total,
    paid,
    remaining: remainingAmount(record.total, paid),
    dueDate: record.dueDate ? dateOnlyToISO(record.dueDate) : null,
    businessDate: dateOnlyToISO(record.businessDate),
    createdAt: dateTimeToISO(record.createdAt),
    status: record.status,
    paymentStatus: paymentStatus(record.total, paid, record.status),
    notes: record.notes,
    vehicle,
    items,
    payments,
    createdByName: record.createdBy.name,
    voidedAt: record.voidedAt ? dateTimeToISO(record.voidedAt) : null,
    voidReason: record.voidReason,
  };
}

export async function getReceivables(options: {
  search?: string;
  filter?: ReceivableFilter;
  limit?: number;
}): Promise<{ rows: TransactionListRow[]; total: number; count: number; overdueTotal: number; overdueCount: number }> {
  const today = todayISO();
  const records = await prisma.transaction.findMany({
    where: { status: "selesai" },
    include: listTransactionInclude,
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  });

  const allOpen = openTransactionRecords(records).sort((a, b) => {
    const aDue = a.dueDateValue?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bDue = b.dueDateValue?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return aDue - bDue;
  });

  const aggregate = allOpen.reduce(
    (acc, row) => {
      acc.total += row.remaining;
      acc.count += 1;
      if (row.dueDate && row.dueDate < today) {
        acc.overdueTotal += row.remaining;
        acc.overdueCount += 1;
      }
      return acc;
    },
    { total: 0, count: 0, overdueTotal: 0, overdueCount: 0 },
  );

  const search = (options.search ?? "").trim().toLowerCase();
  const filter = options.filter ?? "semua";
  const rows = allOpen
    .filter((row) => {
      if (!search) return true;
      return [row.invoiceNo, row.customerName, row.customerPhone, row.plateNumber]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    })
    .filter((row) => {
      if (filter === "jatuh_tempo") return !!row.dueDate && row.dueDate < today;
      if (filter === "lancar") return !row.dueDate || row.dueDate >= today;
      return true;
    })
    .slice(0, options.limit ?? 100)
    .map(({ dueDateValue: _dueDateValue, ...row }) => ({ ...row, aging: agingBucket(row.dueDate, today) }));

  return {
    rows,
    ...aggregate,
  };
}

export async function getAgingSummary(): Promise<{ bucket: string; count: number; total: number }[]> {
  const today = todayISO();
  const data = await getReceivables({ limit: 10_000 });
  const buckets = new Map<string, { bucket: string; count: number; total: number }>([
    ["lancar", { bucket: "Belum jatuh tempo", count: 0, total: 0 }],
    ["1-7", { bucket: "1–7 hari", count: 0, total: 0 }],
    ["8-30", { bucket: "8–30 hari", count: 0, total: 0 }],
    [">30", { bucket: ">30 hari", count: 0, total: 0 }],
  ]);
  for (const row of data.rows) {
    const bucket = buckets.get(agingBucket(row.dueDate, today));
    if (bucket) {
      bucket.count += 1;
      bucket.total += row.remaining;
    }
  }
  return [...buckets.values()];
}
