"use client";

import { Printer, ReceiptText } from "lucide-react";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-secondary no-print">
      <Printer size={15} />
      <span className="hidden sm:inline">Cetak nota</span>
    </button>
  );
}

export function ReceiptButton({
  transactionId,
  variant = "secondary",
  label = "Cetak struk",
}: {
  transactionId: string;
  variant?: "primary" | "secondary";
  label?: string;
}) {
  return (
    <a
      href={`/struk/${transactionId}?print=1`}
      className={`${variant === "primary" ? "btn-primary" : "btn-secondary"} no-print`}
    >
      <ReceiptText size={15} />
      <span>{label}</span>
    </a>
  );
}
