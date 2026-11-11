import type { StockAdjustmentReason } from "@prisma/client";

export type AdjustmentDirection = "kurang" | "tambah";

// Alasan menentukan arah yang boleh dipakai agar laporan selisih tetap bermakna.
export const ADJUSTMENT_REASONS: { value: StockAdjustmentReason; label: string; directions: AdjustmentDirection[] }[] = [
  { value: "rusak", label: "Rusak / cacat", directions: ["kurang"] },
  { value: "hilang", label: "Hilang", directions: ["kurang"] },
  { value: "kedaluwarsa", label: "Kedaluwarsa", directions: ["kurang"] },
  { value: "pemakaian_internal", label: "Dipakai internal bengkel", directions: ["kurang"] },
  { value: "ditemukan", label: "Ditemukan / stok lebih", directions: ["tambah"] },
  { value: "salah_catat", label: "Koreksi salah catat", directions: ["kurang", "tambah"] },
  { value: "lainnya", label: "Lainnya", directions: ["kurang", "tambah"] },
];

export const ADJUSTMENT_REASON_LABELS = Object.fromEntries(
  ADJUSTMENT_REASONS.map((reason) => [reason.value, reason.label]),
) as Record<StockAdjustmentReason, string>;

export function isAdjustmentReason(value: string): value is StockAdjustmentReason {
  return ADJUSTMENT_REASONS.some((reason) => reason.value === value);
}

export function reasonAllows(reason: StockAdjustmentReason, direction: AdjustmentDirection): boolean {
  return ADJUSTMENT_REASONS.some((entry) => entry.value === reason && entry.directions.includes(direction));
}

export function adjustmentNumber(id: number): string {
  return `PS-${String(id).padStart(5, "0")}`;
}
