import fs from "node:fs";
import { PrismaClient, type ItemCategory } from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDaysISO, todayISO } from "../src/lib/dates";

if (!process.env.DATABASE_URL && fs.existsSync(".env")) {
  process.loadEnvFile(".env");
}

const prisma = new PrismaClient();

const APP_BRAND = "WMC 225";
const DEMO_PASSWORD = "wmc225";

function pick<T>(items: readonly T[], index: number): T {
  return items[index % items.length];
}

function dateOnly(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function jakartaTimestamp(dateISO: string, hour: number, minute: number): Date {
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return new Date(`${dateISO}T${hh}:${mm}:00+07:00`);
}

async function main() {
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    console.log("Database sudah berisi data. Seed dilewati (gunakan prisma migrate reset untuk mengulang).");
    return;
  }

  const now = new Date();
  const today = todayISO();
  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10);

  const owner = await prisma.user.create({
    data: {
      name: "Budi Santoso",
      email: "owner@wmc225.id",
      username: "owner",
      passwordHash,
      role: "owner",
      createdAt: now,
    },
  });
  const cashier = await prisma.user.create({
    data: {
      name: "Sari Wulandari",
      email: "kasir@wmc225.id",
      username: "kasir",
      passwordHash,
      role: "kasir",
      createdAt: now,
    },
  });

  await prisma.setting.createMany({
    data: [
      { key: "workshop_name", value: APP_BRAND },
      { key: "workshop_phone", value: "0812-8899-7788" },
      { key: "workshop_address", value: "Jl. Raya Mekar No. 21, Bandung" },
      { key: "workshop_tagline", value: "Servis tepat, harga jelas." },
      { key: "default_due_days", value: "14" },
      {
        key: "invoice_note",
        value: `Terima kasih sudah mempercayakan kendaraan Anda kepada ${APP_BRAND}.`,
      },
    ],
  });

  const customerSeeds = [
    {
      name: "Andi Pratama",
      phone: "0812-3456-7890",
      address: "Jl. Cihampelas No. 12, Bandung",
      notes: "Pelanggan langganan servis rutin.",
      vehicle: { plate: "D 1234 ABC", brand: "Honda", model: "Beat", year: 2019, color: "Hitam", odo: 42100 },
    },
    {
      name: "Siti Rahma",
      phone: "0857-2211-4567",
      address: "Jl. Sukajadi No. 88, Bandung",
      notes: "Sering ganti oli di sini.",
      vehicle: { plate: "D 5678 XYZ", brand: "Yamaha", model: "NMAX", year: 2021, color: "Abu-abu", odo: 18700 },
    },
    {
      name: "Rizky Maulana",
      phone: "0878-9988-1122",
      address: "Jl. Pasteur No. 45, Bandung",
      notes: "",
      vehicle: { plate: "D 9012 RKM", brand: "Honda", model: "Vario 160", year: 2022, color: "Merah", odo: 9500 },
    },
    {
      name: "Dewi Lestari",
      phone: "0813-7788-9900",
      address: "Jl. Buah Batu No. 7, Bandung",
      notes: "Mobil keluarga, servis tiap 6 bulan.",
      vehicle: { plate: "D 1111 DL", brand: "Toyota", model: "Avanza", year: 2018, color: "Silver", odo: 76200 },
    },
    {
      name: "Agus Setiawan",
      phone: "0821-3344-5566",
      address: "Jl. Kiaracondong No. 19, Bandung",
      notes: "Sering minta dikabari via WhatsApp.",
      vehicle: { plate: "D 2222 AS", brand: "Suzuki", model: "Satria F150", year: 2020, color: "Biru", odo: 33400 },
    },
    {
      name: "Maya Sari",
      phone: "0838-6677-8899",
      address: "Jl. Dago No. 102, Bandung",
      notes: "",
      vehicle: { plate: "D 3333 MS", brand: "Honda", model: "Scoopy", year: 2023, color: "Krem", odo: 4100 },
    },
    {
      name: "Budi Hartono",
      phone: "0812-1188-3344",
      address: "Jl. Setiabudi No. 55, Bandung",
      notes: "Kendaraan operasional usaha.",
      vehicle: { plate: "D 4444 BH", brand: "Mitsubishi", model: "Xpander", year: 2020, color: "Putih", odo: 58900 },
    },
    {
      name: "Nina Wulandari",
      phone: "0856-4433-2211",
      address: "Jl. Antapani No. 31, Bandung",
      notes: "",
      vehicle: { plate: "D 5555 NW", brand: "Yamaha", model: "Aerox", year: 2022, color: "Hitam", odo: 12800 },
    },
    {
      name: "Fajar Nugroho",
      phone: "0895-7766-5544",
      address: "Jl. Cibiru No. 8, Bandung",
      notes: "Motor harian ojek online.",
      vehicle: { plate: "D 6666 FN", brand: "Honda", model: "CB150R", year: 2019, color: "Merah", odo: 87600 },
    },
  ];

  const customers: { id: number; name: string; phone: string; vehicleId: number }[] = [];
  for (const seed of customerSeeds) {
    const customer = await prisma.customer.create({
      data: {
        name: seed.name,
        phone: seed.phone,
        address: seed.address,
        notes: seed.notes,
        createdAt: now,
        vehicles: {
          create: {
            plateNumber: seed.vehicle.plate,
            brand: seed.vehicle.brand,
            model: seed.vehicle.model,
            year: seed.vehicle.year,
            color: seed.vehicle.color,
            odometer: seed.vehicle.odo,
            createdAt: now,
          },
        },
      },
      include: { vehicles: true },
    });
    customers.push({
      id: customer.id,
      name: customer.name,
      phone: customer.phone ?? "",
      vehicleId: customer.vehicles[0].id,
    });
  }

  const itemSeeds = [
    { sku: "JSA-001", name: "Servis Ringan", category: "jasa" as ItemCategory, unit: "paket", price: 75000, cost: 25000, stock: 0, min: 0 },
    { sku: "JSA-002", name: "Servis Besar / Tune Up", category: "jasa" as ItemCategory, unit: "paket", price: 250000, cost: 100000, stock: 0, min: 0 },
    { sku: "JSA-003", name: "Ganti Oli", category: "jasa" as ItemCategory, unit: "paket", price: 40000, cost: 15000, stock: 0, min: 0 },
    { sku: "JSA-004", name: "Tambal Ban", category: "jasa" as ItemCategory, unit: "kali", price: 25000, cost: 8000, stock: 0, min: 0 },
    { sku: "JSA-005", name: "Cuci Motor", category: "jasa" as ItemCategory, unit: "kali", price: 20000, cost: 7000, stock: 0, min: 0 },
    { sku: "JSA-006", name: "Diagnosa Mesin", category: "jasa" as ItemCategory, unit: "kali", price: 100000, cost: 30000, stock: 0, min: 0 },
    { sku: "SPR-001", name: "Oli Mesin 10W-40 1L", category: "sparepart" as ItemCategory, unit: "botol", price: 65000, cost: 48000, stock: 42, min: 10 },
    { sku: "SPR-002", name: "Filter Oli", category: "sparepart" as ItemCategory, unit: "pcs", price: 45000, cost: 28000, stock: 24, min: 6 },
    { sku: "SPR-003", name: "Busi Iridium", category: "sparepart" as ItemCategory, unit: "pcs", price: 95000, cost: 62000, stock: 18, min: 5 },
    { sku: "SPR-004", name: "Kampas Rem Depan", category: "sparepart" as ItemCategory, unit: "set", price: 120000, cost: 78000, stock: 9, min: 5 },
    { sku: "SPR-005", name: "Rantai & Gir", category: "sparepart" as ItemCategory, unit: "set", price: 185000, cost: 130000, stock: 7, min: 4 },
    { sku: "SPR-006", name: "Ban Dalam", category: "sparepart" as ItemCategory, unit: "pcs", price: 45000, cost: 28000, stock: 26, min: 8 },
    { sku: "SPR-007", name: "Aki Kering 12V", category: "sparepart" as ItemCategory, unit: "unit", price: 650000, cost: 520000, stock: 4, min: 3 },
    { sku: "SPR-008", name: "Lampu LED", category: "sparepart" as ItemCategory, unit: "pcs", price: 85000, cost: 55000, stock: 12, min: 4 },
  ];

  await prisma.item.createMany({
    data: itemSeeds.map((item) => ({
      sku: item.sku,
      name: item.name,
      category: item.category,
      unit: item.unit,
      price: item.price,
      cost: item.cost,
      stock: item.stock,
      minStock: item.min,
      isActive: true,
      createdAt: now,
    })),
  });

  const itemRows = await prisma.item.findMany();
  const itemsBySku = new Map(itemRows.map((item) => [item.sku, item]));
  const serviceItems = ["JSA-001", "JSA-003", "JSA-004", "JSA-005", "JSA-006"].map((sku) => itemsBySku.get(sku)!);
  const partItems = itemRows.filter((item) => item.category === "sparepart");

  const mechanics = ["Joko", "Asep", "Rahmat", "Dedi"];
  const transactionCounts: Record<string, number> = {};
  const nowMs = Date.now();
  const historyDays = 80;

  for (let dayOffset = historyDays - 1; dayOffset >= 0; dayOffset -= 1) {
    const date = addDaysISO(today, -dayOffset);
    const baseCount = dayOffset === 0 ? 3 : [1, 2, 2, 3][dayOffset % 4];
    const txCount = dayOffset <= 10 ? baseCount + 1 : baseCount;

    for (let n = 0; n < txCount; n += 1) {
      const customer = pick(customers, dayOffset * 3 + n * 2);
      const chosen = [pick(serviceItems, dayOffset + n), pick(partItems, dayOffset * 2 + n)];
      if ((dayOffset + n) % 3 === 0) chosen.push(pick(partItems, dayOffset + n + 4));
      if ((dayOffset + n) % 5 === 0) chosen.push(pick(serviceItems, dayOffset + n + 2));
      const uniqueChosen = chosen.filter((item, index, arr) => arr.findIndex((x) => x.id === item.id) === index);

      let subtotal = 0;
      const lines = uniqueChosen.map((item) => {
        subtotal += item.price;
        return {
          itemId: item.id,
          name: item.name,
          category: item.category,
          qty: 1,
          unitPrice: item.price,
          unitCost: item.cost,
          subtotal: item.price,
        };
      });

      const discount = (dayOffset + n) % 9 === 0 ? 10000 : 0;
      const total = subtotal - discount;
      transactionCounts[date] = (transactionCounts[date] ?? 0) + 1;
      const invoiceNo = `INV-${date.replaceAll("-", "")}-${String(transactionCounts[date]).padStart(3, "0")}`;
      const createdAt =
        dayOffset === 0
          ? new Date(nowMs - (txCount - n) * 37 * 60_000)
          : jakartaTimestamp(date, 8 + ((dayOffset + n * 4) % 9), (n * 17 + dayOffset) % 60);
      const dueDate = addDaysISO(date, 14);

      let paidRatio: number;
      if (dayOffset === 0) {
        paidRatio = [1, 1, 0.5, 0][n % 4];
      } else if (dayOffset <= 10) {
        paidRatio = (dayOffset + n) % 4 === 0 ? (n % 2 === 0 ? 0.5 : 0) : 1;
      } else if (dayOffset <= 20) {
        paidRatio = (dayOffset + n) % 5 === 0 ? 0.5 : 1;
      } else {
        paidRatio = (dayOffset + n) % 23 === 0 ? 0.5 : 1;
      }
      const paidAmount = paidRatio === 0 ? 0 : Math.round((total * paidRatio) / 5000) * 5000;
      const method = (["tunai", "transfer", "qris"] as const)[(dayOffset + n) % 3];

      const paymentDate = paidRatio < 1 && dayOffset > 2 ? addDaysISO(date, 1) : date;
      const paidAt =
        dayOffset === 0 && paymentDate === date
          ? createdAt
          : jakartaTimestamp(paymentDate, 10 + (n % 8), (n * 13) % 60);

      await prisma.transaction.create({
        data: {
          id: `seed-tx-${date}-${n}`,
          invoiceNo,
          customerId: customer.id,
          vehicleId: customer.vehicleId,
          mechanic: pick(mechanics, dayOffset + n),
          subtotal,
          discount,
          total,
          businessDate: dateOnly(date),
          dueDate: dateOnly(dueDate),
          notes: null,
          status: "selesai",
          createdById: owner.id,
          createdAt,
          items: { create: lines },
          payments:
            paidAmount > 0
              ? {
                  create: {
                    amount: Math.min(paidAmount, total),
                    method,
                    notes: paidRatio < 1 ? "DP pelanggan" : null,
                    businessDate: dateOnly(paymentDate),
                    paidAt,
                    receivedById: cashier.id,
                  },
                }
              : undefined,
        },
      });
    }
  }

  const finalStock: Record<string, number> = {
    "SPR-001": 24,
    "SPR-002": 12,
    "SPR-003": 8,
    "SPR-004": 4,
    "SPR-005": 3,
    "SPR-006": 16,
    "SPR-007": 2,
    "SPR-008": 9,
  };
  for (const [sku, stock] of Object.entries(finalStock)) {
    await prisma.item.update({ where: { sku }, data: { stock } });
  }

  const previousMonthDate = new Date(`${today.slice(0, 7)}-01T12:00:00Z`);
  previousMonthDate.setUTCMonth(previousMonthDate.getUTCMonth() - 1);
  const previousMonthStart = previousMonthDate.toISOString().slice(0, 10);

  const previousExpenses = [
    { day: 1, category: "Gaji", description: "Gaji mekanik & kasir", amount: 7800000 },
    { day: 2, category: "Sewa", description: "Sewa tempat bengkel bulanan", amount: 3500000 },
    { day: 3, category: "Listrik & Air", description: "Tagihan listrik dan air", amount: 640000 },
    { day: 5, category: "Pembelian Stok", description: "Restock oli, filter, dan busi", amount: 2150000 },
    { day: 8, category: "Operasional", description: "Kebersihan & konsumsi", amount: 350000 },
    { day: 12, category: "Peralatan", description: "Kunci shock dan WD-40", amount: 425000 },
  ];
  for (const expense of previousExpenses) {
    await prisma.expense.create({
      data: {
        expenseDate: dateOnly(addDaysISO(previousMonthStart, expense.day)),
        category: expense.category,
        description: expense.description,
        amount: expense.amount,
        createdById: owner.id,
        createdAt: now,
      },
    });
  }

  const currentExpenses = [
    { offset: -7, category: "Listrik & Air", description: "Token listrik & air bengkel", amount: 640000 },
    { offset: -4, category: "Operasional", description: "Konsumsi tim dan kebersihan", amount: 350000 },
    { offset: -2, category: "Pembelian Stok", description: "Restock cepat oli dan filter", amount: 410000 },
  ];
  for (const expense of currentExpenses) {
    const date = addDaysISO(today, expense.offset);
    if (date.slice(0, 7) === today.slice(0, 7)) {
      await prisma.expense.create({
        data: {
          expenseDate: dateOnly(date),
          category: expense.category,
          description: expense.description,
          amount: expense.amount,
          createdById: owner.id,
          createdAt: now,
        },
      });
    }
  }

  const supplierA = await prisma.supplier.create({
    data: {
      name: "PT Sumber Motor Jaya",
      contactPerson: "Hendra",
      phone: "022-4201-889",
      notes: "Supplier sparepart utama",
      createdAt: now,
    },
  });
  const supplierB = await prisma.supplier.create({
    data: {
      name: "CV Oli Nusantara",
      contactPerson: "Rina",
      phone: "022-6650-112",
      notes: "Distributor oli & pelumas",
      createdAt: now,
    },
  });
  const supplierC = await prisma.supplier.create({
    data: {
      name: "Toko Ban Sejahtera",
      contactPerson: "Wawan",
      phone: "0812-2010-5544",
      notes: "Ban dan aksesoris",
      createdAt: now,
    },
  });

  const payableSeeds = [
    {
      supplierId: supplierA.id,
      referenceNo: "SMJ-8841",
      description: "Pembelian kampas rem & busi (30 unit)",
      amount: 3250000,
      dayOffset: -25,
      paid: 1500000,
    },
    {
      supplierId: supplierB.id,
      referenceNo: "ON-1120",
      description: "Pembelian oli mesin 2 karton",
      amount: 4800000,
      dayOffset: -6,
      paid: 0,
    },
    {
      supplierId: supplierC.id,
      referenceNo: "TBS-073",
      description: "Pembelian ban dalam & ban luar",
      amount: 2600000,
      dayOffset: 4,
      paid: 2600000,
    },
  ];

  for (const payableSeed of payableSeeds) {
    const businessDate = addDaysISO(today, payableSeed.dayOffset);
    const payable = await prisma.payable.create({
      data: {
        supplierId: payableSeed.supplierId,
        referenceNo: payableSeed.referenceNo,
        description: payableSeed.description,
        amount: payableSeed.amount,
        businessDate: dateOnly(businessDate),
        dueDate: dateOnly(addDaysISO(businessDate, 21)),
        createdAt: now,
        createdById: owner.id,
      },
    });
    if (payableSeed.paid > 0) {
      await prisma.payablePayment.create({
        data: {
          payableId: payable.id,
          amount: payableSeed.paid,
          method: "transfer",
          notes: payableSeed.paid === payableSeed.amount ? "Lunas" : "Pembayaran termin 1",
          businessDate: dateOnly(addDaysISO(businessDate, 4)),
          paidAt: jakartaTimestamp(addDaysISO(businessDate, 4), 14, 20),
          paidById: owner.id,
        },
      });
    }
  }

  const stockedItems = await prisma.item.findMany({ where: { category: "sparepart", stock: { gt: 0 } } });
  await prisma.stockBatch.createMany({ data: stockedItems.map((item) => ({
    itemId: item.id, code: "STOK-AWAL", receivedDate: dateOnly(today),
    quantity: item.stock, remaining: item.stock, unitCost: item.cost, notes: "Saldo stok demo",
  })) });

  console.log(`Seed ${APP_BRAND} selesai.`);
  console.log(`Login owner: owner@wmc225.id / ${DEMO_PASSWORD}`);
  console.log(`Login kasir: kasir@wmc225.id / ${DEMO_PASSWORD}`);
  console.log(`Transaksi: ${await prisma.transaction.count()}, pelanggan: ${await prisma.customer.count()}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
