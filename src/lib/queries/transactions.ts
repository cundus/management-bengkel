import { prisma } from "../db";
import { dateOnlyToISO, dateTimeToISO, monthRange, todayISO } from "../dates";
import { agingBucket, paymentStatus, remainingAmount, settledReceivable } from "../calculations";
import { listTransactionInclude, mapTransactionList } from "./mappers";
import {
  findOpenReceivableIds,
  findSettledIds,
  findTransactionPage,
  getOpenReceivableSummary,
  getReceivableAging,
  getSettledSummary,
  type AgingKey,
} from "./balances";
import type {
  Payment,
  ReceivableFilter,
  SettledReceivableRow,
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

  // Filter status bayar dan paginasi dikerjakan di database; hanya satu halaman nota yang dimuat.
  const { ids, total } = await findTransactionPage({ search, status, limit: pageSize, offset: (page - 1) * pageSize });
  return {
    rows: await listRowsByIds(ids),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Muat baris daftar nota untuk ID tertentu, dengan urutan sama seperti `ids`. */
export async function listRowsByIds(ids: string[]): Promise<TransactionListRow[]> {
  if (ids.length === 0) return [];
  const records = await prisma.transaction.findMany({ where: { id: { in: ids } }, include: listTransactionInclude });
  const byId = new Map(records.map((record) => [record.id, record]));
  return ids.flatMap((id) => {
    const record = byId.get(id);
    return record ? [mapTransactionList(record)] : [];
  });
}

export async function getTransactionById(id: string): Promise<TransactionDetail | null> {
  const record = await prisma.transaction.findUnique({
    where: { id },
    include: {
      customer: true,
      vehicle: true,
      createdBy: true,
      voidedBy: { select: { name: true } },
      refunds: { include: { createdBy: { select: { name: true } } }, orderBy: { refundedAt: "desc" } },
      voidRequests: {
        include: { requestedBy: { select: { name: true } }, reviewedBy: { select: { name: true } } },
        orderBy: { requestedAt: "desc" },
      },
      items: { orderBy: { id: "asc" }, include: { stockBatch: { select: { code: true } } } },
      payments: { include: { receivedBy: true, reversal: { select: { id: true } } }, orderBy: { paidAt: "desc" } },
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
    reversesPaymentId: payment.reversesPaymentId,
    reversed: payment.reversal !== null,
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
    remaining: record.status === "batal" ? 0 : remainingAmount(record.total, paid),
    dueDate: record.dueDate ? dateOnlyToISO(record.dueDate) : null,
    businessDate: dateOnlyToISO(record.businessDate),
    createdAt: dateTimeToISO(record.createdAt),
    status: record.status,
    paymentStatus: paymentStatus(record.total, paid, record.status),
    hasPendingVoid: record.voidRequests.some((request) => request.status === "pending"),
    notes: record.notes,
    vehicle,
    items,
    payments,
    createdByName: record.createdBy.name,
    voidedAt: record.voidedAt ? dateTimeToISO(record.voidedAt) : null,
    voidedDate: record.voidedDate ? dateOnlyToISO(record.voidedDate) : null,
    voidedByName: record.voidedBy?.name ?? null,
    voidReason: record.voidReason,
    refunds: record.refunds.map((refund) => ({
      id: refund.id,
      amount: refund.amount,
      method: refund.method,
      notes: refund.notes,
      businessDate: dateOnlyToISO(refund.businessDate),
      refundedAt: dateTimeToISO(refund.refundedAt),
      createdByName: refund.createdBy.name,
    })),
    refunded: record.refunds.reduce((sum, refund) => sum + refund.amount, 0),
    voidRequests: record.voidRequests.map((request) => ({
      id: request.id,
      reason: request.reason,
      status: request.status,
      requestedByName: request.requestedBy.name,
      requestedAt: dateTimeToISO(request.requestedAt),
      reviewedByName: request.reviewedBy?.name ?? null,
      reviewedAt: request.reviewedAt ? dateTimeToISO(request.reviewedAt) : null,
      reviewNote: request.reviewNote,
    })),
  };
}

export async function getReceivables(options: {
  search?: string;
  filter?: ReceivableFilter;
  limit?: number;
}): Promise<{ rows: TransactionListRow[]; total: number; count: number; overdueTotal: number; overdueCount: number }> {
  const today = todayISO();
  // Ringkasan selalu atas semua nota terbuka; hanya baris yang tampil yang dimuat lengkap.
  const [summary, ids] = await Promise.all([
    getOpenReceivableSummary(today),
    findOpenReceivableIds({
      today,
      search: (options.search ?? "").trim(),
      filter: options.filter ?? "semua",
      limit: options.limit ?? 100,
    }),
  ]);
  const rows = (await listRowsByIds(ids)).map((row) => ({ ...row, aging: agingBucket(row.dueDate, today) }));

  return {
    rows,
    total: summary.total,
    count: summary.count,
    overdueTotal: summary.overdueTotal,
    overdueCount: summary.overdueCount,
  };
}

export async function getSettledReceivables(options: { search?: string; limit?: number }): Promise<{
  rows: SettledReceivableRow[];
  count: number;
  total: number;
  monthCount: number;
  monthTotal: number;
}> {
  const { start, end } = monthRange(todayISO().slice(0, 7));
  const [summary, ids] = await Promise.all([
    getSettledSummary(start, end),
    findSettledIds((options.search ?? "").trim(), options.limit ?? 100),
  ]);
  if (ids.length === 0) return { rows: [], ...summary };

  const records = await prisma.transaction.findMany({
    where: { id: { in: ids } },
    include: {
      customer: true,
      vehicle: true,
      voidRequests: { where: { status: "pending" }, select: { id: true } },
      // Pasangan pembayaran + koreksinya saling meniadakan; abaikan keduanya.
      payments: {
        where: { reversesPaymentId: null, reversal: { is: null } },
        select: { amount: true, method: true, businessDate: true },
        orderBy: [{ businessDate: "asc" }, { paidAt: "asc" }],
      },
    },
  });
  const byId = new Map(records.map((record) => [record.id, record]));

  // Detail pelunasan tetap dihitung dengan `settledReceivable` agar sama persis dengan tampilan sebelumnya.
  const rows: SettledReceivableRow[] = [];
  for (const id of ids) {
    const record = byId.get(id);
    if (!record) continue;
    const payments = record.payments.map((payment) => ({
      amount: payment.amount,
      method: payment.method,
      businessDate: dateOnlyToISO(payment.businessDate),
    }));
    const result = settledReceivable(record.total, dateOnlyToISO(record.businessDate), payments);
    if (result) rows.push({ ...mapTransactionList(record), ...result, payments });
  }

  return { rows, ...summary };
}

export async function getAgingSummary(): Promise<{ bucket: string; count: number; total: number }[]> {
  const aging = await getReceivableAging(todayISO());
  return [
    { key: "lancar", bucket: "Belum jatuh tempo" },
    { key: "1-7", bucket: "1–7 hari" },
    { key: "8-30", bucket: "8–30 hari" },
    { key: ">30", bucket: ">30 hari" },
  ].map(({ key, bucket }) => ({ bucket, count: 0, total: 0, ...aging.get(key as AgingKey) }));
}
