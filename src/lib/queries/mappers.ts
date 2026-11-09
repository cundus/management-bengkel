import type { Prisma } from "@prisma/client";
import { dateOnlyToISO, dateTimeToISO } from "../dates";
import { paymentStatus, remainingAmount } from "../calculations";
import type { TransactionListRow, Vehicle } from "../types";

export const listTransactionInclude = {
  customer: true,
  vehicle: true,
  payments: { select: { amount: true } },
} satisfies Prisma.TransactionInclude;

export type ListTransactionRecord = Prisma.TransactionGetPayload<{
  include: typeof listTransactionInclude;
}>;

export function mapTransactionList(record: ListTransactionRecord): TransactionListRow {
  const paid = record.payments.reduce((sum, payment) => sum + payment.amount, 0);
  return {
    id: record.id,
    invoiceNo: record.invoiceNo,
    customerId: record.customerId,
    customerName: record.customer.name,
    customerPhone: record.customer.phone,
    plateNumber: record.vehicle?.plateNumber ?? null,
    vehicleLabel: record.vehicle ? `${record.vehicle.brand} ${record.vehicle.model}` : null,
    mechanic: record.mechanic,
    total: record.total,
    paid,
    remaining: remainingAmount(record.total, paid),
    dueDate: record.dueDate ? dateOnlyToISO(record.dueDate) : null,
    businessDate: dateOnlyToISO(record.businessDate),
    createdAt: dateTimeToISO(record.createdAt),
    status: record.status,
    paymentStatus: paymentStatus(record.total, paid, record.status),
  };
}

export function mapVehicle(vehicle: {
  id: number;
  customerId: number;
  plateNumber: string;
  brand: string;
  model: string;
  year: number | null;
  color: string | null;
  odometer: number | null;
  createdAt: Date;
}): Vehicle {
  return {
    ...vehicle,
    createdAt: dateTimeToISO(vehicle.createdAt),
  };
}

export function openTransactionRecords(
  records: ListTransactionRecord[],
): (TransactionListRow & { dueDateValue: Date | null })[] {
  return records
    .map((record) => ({ ...mapTransactionList(record), dueDateValue: record.dueDate }))
    .filter((record) => record.status === "selesai" && record.remaining > 0);
}
