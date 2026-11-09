"use client";

import { useLinkStatus } from "next/link";

export function NavigationPending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;

  return (
    <span role="status" aria-label="Membuka halaman" className="pointer-events-none absolute inset-x-2 bottom-0 h-0.5 animate-pulse rounded-full bg-brand motion-reduce:animate-none">
      <span className="sr-only">Membuka halaman…</span>
    </span>
  );
}
