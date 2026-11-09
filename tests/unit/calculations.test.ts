import { describe, expect, it } from "vitest";
import {
  agingBucket,
  calculateTransactionTotals,
  canAcceptPayment,
  generateInvoiceNumber,
  growth,
  normalizePhoneForWhatsApp,
  paymentStatus,
  remainingAmount,
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
