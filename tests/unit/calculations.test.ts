import { describe, expect, it } from "vitest";
import {
  agingBucket,
  allocateDiscount,
  calculateTransactionTotals,
  canAcceptPayment,
  canRefund,
  generateInvoiceNumber,
  growth,
  marginByCategory,
  normalizePhoneForWhatsApp,
  parseVoidMaxDays,
  paymentStatus,
  remainingAmount,
  settledReceivable,
  voidWindowCheck,
} from "@/lib/calculations";

describe("calculateTransactionTotals", () => {
  it("menghitung subtotal qty x harga dan total setelah diskon", () => {
    const result = calculateTransactionTotals(
      [
        { qty: 2, unitPrice: 75_000 },
        { qty: 1, unitPrice: 40_000 },
      ],
      15_000,
    );
    expect(result).toEqual({ subtotal: 190_000, discount: 15_000, total: 175_000 });
  });

  it("membatasi diskon agar tidak melebihi subtotal dan mengabaikan nilai negatif", () => {
    expect(calculateTransactionTotals([{ qty: 1, unitPrice: 50_000 }], 999_999)).toEqual({
      subtotal: 50_000,
      discount: 50_000,
      total: 0,
    });
    expect(calculateTransactionTotals([{ qty: -2, unitPrice: 50_000 }], -10_000)).toEqual({
      subtotal: 0,
      discount: 0,
      total: 0,
    });
  });
});

describe("status pembayaran", () => {
  it("menentukan lunas, sebagian, dan belum bayar", () => {
    expect(paymentStatus(100_000, 100_000)).toBe("lunas");
    expect(paymentStatus(100_000, 120_000)).toBe("lunas");
    expect(paymentStatus(100_000, 40_000)).toBe("sebagian");
    expect(paymentStatus(100_000, 0)).toBe("belum_bayar");
    expect(paymentStatus(100_000, 0, "batal")).toBe("batal");
  });

  it("menghitung sisa tanpa nilai negatif", () => {
    expect(remainingAmount(100_000, 30_000)).toBe(70_000);
    expect(remainingAmount(100_000, 130_000)).toBe(0);
  });

  it("menolak pembayaran melebihi sisa atau nol", () => {
    expect(canAcceptPayment(100_000, 20_000, 80_000).ok).toBe(true);
    expect(canAcceptPayment(100_000, 20_000, 80_001).ok).toBe(false);
    expect(canAcceptPayment(100_000, 100_000, 1).ok).toBe(false);
    expect(canAcceptPayment(100_000, 0, 0).ok).toBe(false);
  });
});

describe("aging piutang", () => {
  it("mengelompokkan umur keterlambatan", () => {
    expect(agingBucket("2026-11-10", "2026-11-09")).toBe("lancar");
    expect(agingBucket("2026-11-09", "2026-11-09")).toBe("lancar");
    expect(agingBucket("2026-11-08", "2026-11-09")).toBe("1-7");
    expect(agingBucket("2026-11-01", "2026-11-09")).toBe("8-30");
    expect(agingBucket("2026-10-01", "2026-11-09")).toBe(">30");
    expect(agingBucket(null, "2026-11-09")).toBe("lancar");
  });
});

describe("utilitas lain", () => {
  it("membuat nomor invoice berurutan", () => {
    expect(generateInvoiceNumber("2026-11-09", 1)).toBe("INV-20261109-001");
    expect(generateInvoiceNumber("2026-11-09", 27)).toBe("INV-20261109-027");
  });

  it("menormalkan nomor telepon Indonesia untuk WhatsApp", () => {
    expect(normalizePhoneForWhatsApp("0812-3456-7890")).toBe("6281234567890");
    expect(normalizePhoneForWhatsApp("+62 812 3456 7890")).toBe("6281234567890");
    expect(normalizePhoneForWhatsApp("123")).toBeNull();
  });

  it("menghitung pertumbuhan dengan aman", () => {
    expect(growth(120, 100)).toBe(20);
    expect(growth(80, 100)).toBe(-20);
    expect(growth(0, 0)).toBe(0);
    expect(growth(100, 0)).toBeNull();
  });
});


describe("allocateDiscount", () => {
  it("membagi diskon proporsional dan jumlahnya tetap sama dengan total", () => {
    const net = allocateDiscount([100_000, 50_000, 25_000], 10_000);
    expect(net.reduce((sum, value) => sum + value, 0)).toBe(165_000);
    expect(net[1]).toBe(47_143);
  });

  it("tidak mengubah apa pun tanpa diskon", () => {
    expect(allocateDiscount([10_000, 5_000], 0)).toEqual([10_000, 5_000]);
  });
});

describe("marginByCategory", () => {
  it("memisahkan margin jasa dan sparepart setelah diskon", () => {
    const result = marginByCategory([
      {
        discount: 15_000,
        items: [
          { name: "Servis", category: "jasa", qty: 1, unitCost: 0, subtotal: 100_000 },
          { name: "Oli", category: "sparepart", qty: 1, unitCost: 35_000, subtotal: 50_000 },
        ],
      },
      {
        discount: 0,
        items: [{ name: "Oli", category: "sparepart", qty: 2, unitCost: 35_000, subtotal: 100_000 }],
      },
    ]);
    expect(result.categories.jasa).toMatchObject({ revenue: 90_000, cost: 0, grossProfit: 90_000, margin: 100 });
    expect(result.categories.sparepart).toMatchObject({ revenue: 145_000, cost: 105_000, grossProfit: 40_000, qty: 3 });
    expect(result.categories.sparepart.margin).toBe(27.6);
    expect(result.items.sparepart).toHaveLength(1);
    expect(result.items.sparepart[0]).toMatchObject({ name: "Oli", qty: 3, grossProfit: 40_000 });
  });
});

describe("settledReceivable", () => {
  it("mengenali nota yang dilunasi setelah tanggal nota", () => {
    expect(
      settledReceivable(135_000, "2026-11-09", [
        { amount: 100_000, method: "tunai", businessDate: "2026-11-09" },
        { amount: 35_000, method: "tunai", businessDate: "2026-11-10" },
      ]),
    ).toEqual({ settledDate: "2026-11-10", daysToSettle: 1, downPayment: 100_000 });
  });

  it("mengabaikan nota yang langsung lunas di hari yang sama", () => {
    expect(settledReceivable(50_000, "2026-11-10", [{ amount: 50_000, method: "tunai", businessDate: "2026-11-10" }])).toBeNull();
  });

  it("mengabaikan nota yang masih ada sisa", () => {
    expect(settledReceivable(50_000, "2026-11-09", [{ amount: 20_000, method: "tunai", businessDate: "2026-11-10" }])).toBeNull();
  });
});

describe("aturan pembatalan nota", () => {
  it("membaca batas hari pembatalan dari setting", () => {
    expect(parseVoidMaxDays("7")).toBe(7);
    expect(parseVoidMaxDays("0")).toBeNull();
    expect(parseVoidMaxDays("")).toBeNull();
    expect(parseVoidMaxDays(undefined)).toBeNull();
    expect(parseVoidMaxDays("abc")).toBeNull();
  });

  it("menolak pembatalan nota yang melewati batas hari", () => {
    expect(voidWindowCheck("2026-11-01", "2026-11-10", null).ok).toBe(true);
    expect(voidWindowCheck("2026-11-03", "2026-11-10", 7).ok).toBe(true);
    const late = voidWindowCheck("2026-11-02", "2026-11-10", 7);
    expect(late.ok).toBe(false);
    expect(late.message).toContain("8 hari");
  });

  it("membatasi refund antara nol dan jumlah yang sudah dibayar", () => {
    expect(canRefund(50_000, 0).ok).toBe(true);
    expect(canRefund(50_000, 20_000).ok).toBe(true);
    expect(canRefund(50_000, 50_000).ok).toBe(true);
    expect(canRefund(50_000, 50_001).ok).toBe(false);
    expect(canRefund(50_000, -1).ok).toBe(false);
  });
});
