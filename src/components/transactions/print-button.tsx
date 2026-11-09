"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-secondary no-print">
      <Printer size={15} />
      <span className="hidden sm:inline">Cetak nota</span>
    </button>
  );
}
