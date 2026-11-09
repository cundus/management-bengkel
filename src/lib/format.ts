const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("id-ID");

export function formatRupiah(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "Rp0";
  return currencyFormatter.format(Math.round(value)).replace(/\u00A0/g, " ");
}

export function formatCompactRupiah(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) {
    return `Rp${numberFormatter.format(Math.round(value / 1_000_000_000))} M`;
  }
  if (Math.abs(value) >= 1_000_000) {
    return `Rp${numberFormatter.format(Math.round(value / 1_000_000))} jt`;
  }
  if (Math.abs(value) >= 1_000) {
    return `Rp${numberFormatter.format(Math.round(value / 1_000))} rb`;
  }
  return formatRupiah(value);
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "0";
  return numberFormatter.format(value);
}

export function parseRupiahInput(value: FormDataEntryValue | null | undefined): number {
  if (typeof value !== "string") return 0;
  const cleaned = value.replace(/[^\d]/g, "");
  return cleaned ? Number(cleaned) : 0;
}

export function formatPhoneForWhatsApp(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/[^\d]/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  if (digits.startsWith("8")) digits = `62${digits}`;
  if (!digits.startsWith("62")) return null;
  return digits;
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function percent(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
