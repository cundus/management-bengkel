import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { dateTimeToISO } from "../dates";
import { remainingAmount } from "../calculations";
import { listTransactionInclude, mapTransactionList, mapVehicle } from "./mappers";
import type { Customer, CustomerDetail, CustomerWithVehicles, TransactionListRow } from "../types";

function mapCustomer(customer: {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  createdAt: Date;
}): Customer {
  return { ...customer, createdAt: dateTimeToISO(customer.createdAt) };
}

export async function searchCustomers(search?: string): Promise<Customer[]> {
  const query = (search ?? "").trim();
  const where: Prisma.CustomerWhereInput = query
    ? {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { phone: { contains: query, mode: "insensitive" } },
          {
            vehicles: {
              some: {
                OR: [
                  { plateNumber: { contains: query, mode: "insensitive" } },
                  { brand: { contains: query, mode: "insensitive" } },
                  { model: { contains: query, mode: "insensitive" } },
                ],
              },
            },
          },
        ],
      }
    : {};

  const rows = await prisma.customer.findMany({
    where,
    include: {
      vehicles: { select: { id: true } },
      transactions: {
        where: { status: "selesai" },
        select: { total: true, createdAt: true, payments: { select: { amount: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  return rows.map((row) => {
    const outstanding = row.transactions.reduce((sum, transaction) => {
      const paid = transaction.payments.reduce((paidSum, payment) => paidSum + payment.amount, 0);
      return sum + remainingAmount(transaction.total, paid);
    }, 0);
    const lastVisit = row.transactions.reduce<Date | null>(
      (latest, transaction) => (!latest || transaction.createdAt > latest ? transaction.createdAt : latest),
      null,
    );
    return {
      ...mapCustomer(row),
      vehicleCount: row.vehicles.length,
      transactionCount: row.transactions.length,
      outstanding,
      lastVisit: lastVisit ? dateTimeToISO(lastVisit) : null,
    };
  });
}

export async function getCustomersWithVehicles(): Promise<CustomerWithVehicles[]> {
  const rows = await prisma.customer.findMany({
    include: { vehicles: { orderBy: { plateNumber: "asc" } } },
    orderBy: { name: "asc" },
  });
  return rows.map((row) => ({
    ...mapCustomer(row),
    vehicles: row.vehicles.map(mapVehicle),
  }));
}

export async function getCustomerById(id: number): Promise<CustomerDetail | null> {
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      vehicles: { orderBy: { plateNumber: "asc" } },
      transactions: {
        include: listTransactionInclude,
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!customer) return null;

  const transactions: TransactionListRow[] = customer.transactions.map(mapTransactionList);

  return {
    ...mapCustomer(customer),
    vehicles: customer.vehicles.map(mapVehicle),
    transactions,
    totalSpend: transactions.filter((t) => t.status === "selesai").reduce((sum, t) => sum + t.total, 0),
    outstanding: transactions.filter((t) => t.status === "selesai").reduce((sum, t) => sum + t.remaining, 0),
  };
}

export async function getVehicleById(id: number) {
  const vehicle = await prisma.vehicle.findUnique({ where: { id } });
  return vehicle ? mapVehicle(vehicle) : null;
}
