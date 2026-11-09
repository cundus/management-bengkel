export const APP_NAME = "WMC 225";
export const APP_TAGLINE = "Bengkel rapi, kas jelas.";
export const APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Jakarta";
export const CURRENCY = "IDR";

export const PAYMENT_METHODS = ["tunai", "transfer", "qris"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  tunai: "Tunai",
  transfer: "Transfer",
  qris: "QRIS",
};

export const ITEM_CATEGORIES = ["jasa", "sparepart"] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export const ITEM_CATEGORY_LABELS: Record<ItemCategory, string> = {
  jasa: "Jasa",
  sparepart: "Sparepart",
};

export const EXPENSE_CATEGORIES = [
  "Gaji",
  "Sewa",
  "Listrik & Air",
  "Peralatan",
  "Pembelian Stok",
  "Operasional",
  "Lainnya",
] as const;

export const USER_ROLES = ["owner", "kasir"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Pemilik",
  kasir: "Kasir",
};

export const DEFAULT_DUE_DAYS = 14;

export const PAGE_SIZE = 20;
