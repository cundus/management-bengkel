"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  Check,
  ChevronDown,
  CircleDollarSign,
  Cog,
  LoaderCircle,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  StickyNote,
  Trash2,
  UserPlus,
  Wrench,
} from "lucide-react";
import { createTransactionAction, type CreateTransactionInput } from "@/actions/transactions";
import { calculateTransactionTotals } from "@/lib/calculations";
import { addDaysISO } from "@/lib/dates";
import { formatNumber, formatRupiah } from "@/lib/format";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/constants";
import type { CustomerWithVehicles, Item } from "@/lib/types";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";

type CartLine = { itemId: number; qty: number };
type PaymentMode = "lunas" | "dp" | "belum";
type CategoryFilter = "semua" | "jasa" | "sparepart";

export function TransactionForm({
  customers,
  items,
  today,
  defaultDueDays,
  initialCustomerId,
}: {
  customers: CustomerWithVehicles[];
  items: Item[];
  today: string;
  defaultDueDays: number;
  initialCustomerId?: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const presetCustomer = customers.find((customer) => customer.id === initialCustomerId);

  const [customerId, setCustomerId] = useState<string>(presetCustomer ? String(presetCustomer.id) : "");
  const [vehicleId, setVehicleId] = useState<string>(
    presetCustomer?.vehicles[0] ? String(presetCustomer.vehicles[0].id) : "",
  );
  const [mechanic, setMechanic] = useState("");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [discountInput, setDiscountInput] = useState("0");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("lunas");
  const [dpInput, setDpInput] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("tunai");
  const [dueDate, setDueDate] = useState(addDaysISO(today, defaultDueDays));
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("semua");

  const selectedCustomer = customers.find((customer) => customer.id === Number(customerId));
  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const cartDetails = lines
    .map((line) => ({ ...line, item: itemMap.get(line.itemId) }))
    .filter((line): line is CartLine & { item: Item } => Boolean(line.item));

  const subtotal = cartDetails.reduce((sum, line) => sum + line.item.price * line.qty, 0);
  const discount = Math.min(Number(discountInput.replace(/\D/g, "")) || 0, subtotal);
  const total = subtotal - discount;
  const payNow =
    paymentMode === "lunas"
      ? total
      : paymentMode === "belum"
        ? 0
        : Math.min(Number(dpInput.replace(/\D/g, "")) || 0, total);
  const remaining = Math.max(0, total - payNow);

  const filteredItems = items.filter((item) => {
    const matchCategory = category === "semua" || item.category === category;
    const query = search.trim().toLowerCase();
    const matchSearch = !query || item.name.toLowerCase().includes(query) || item.sku.toLowerCase().includes(query);
    return matchCategory && matchSearch;
  });

  function selectCustomer(value: string) {
    setCustomerId(value);
    const customer = customers.find((entry) => entry.id === Number(value));
    setVehicleId(customer?.vehicles[0] ? String(customer.vehicles[0].id) : "");
  }

  function addItem(item: Item) {
    if (item.category === "sparepart" && item.stock <= 0) return;
    setError(null);
    setLines((current) => {
      const existing = current.find((line) => line.itemId === item.id);
      if (existing) {
        if (item.category === "sparepart" && existing.qty >= item.stock) return current;
        return current.map((line) => (line.itemId === item.id ? { ...line, qty: line.qty + 1 } : line));
      }
      return [...current, { itemId: item.id, qty: 1 }];
    });
  }

  function changeQty(itemId: number, delta: number) {
    setLines((current) =>
      current
        .map((line) => {
          if (line.itemId !== itemId) return line;
          const item = itemMap.get(itemId);
          const max = item?.category === "sparepart" ? Math.max(1, item.stock) : 99;
          return { ...line, qty: Math.min(max, Math.max(0, line.qty + delta)) };
        })
        .filter((line) => line.qty > 0),
    );
  }

  function removeLine(itemId: number) {
    setLines((current) => current.filter((line) => line.itemId !== itemId));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!customerId) {
      setError("Pilih pelanggan terlebih dahulu.");
      return;
    }
    if (cartDetails.length === 0) {
      setError("Tambahkan minimal satu jasa atau sparepart.");
      return;
    }
    if (paymentMode === "dp" && payNow <= 0) {
      setError("Nominal DP harus lebih dari nol.");
      return;
    }
    if (remaining > 0 && !dueDate) {
      setError("Tentukan tanggal jatuh tempo untuk sisa tagihan.");
      return;
    }

    const payload: CreateTransactionInput = {
      customerId: Number(customerId),
      vehicleId: vehicleId ? Number(vehicleId) : null,
      mechanic,
      discount,
      notes,
      dueDate: remaining > 0 ? dueDate : null,
      items: cartDetails.map((line) => ({ itemId: line.itemId, qty: line.qty })),
      payNow,
      method,
    };

    startTransition(async () => {
      const result = await createTransactionAction(payload);
      if (!result.ok) {
        setError(result.message);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      router.push(`/transaksi/${result.id}?created=1`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
      <div className="space-y-4">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-2xl border border-danger/20 bg-danger-soft px-4 py-3 text-[12px] font-semibold text-danger"
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        <section className="card overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-line px-5 py-4">
            <span className="flex size-7 items-center justify-center rounded-lg bg-pine text-[11px] font-extrabold text-lime">
              1
            </span>
            <div>
              <h2 className="text-[13px] font-extrabold text-ink">Pelanggan & kendaraan</h2>
              <p className="text-[10px] font-medium text-faint">Siapa yang datang hari ini?</p>
            </div>
          </div>
          <div className="space-y-4 p-5">
            {selectedCustomer && (
              <div className="flex items-center gap-3 rounded-xl border border-line bg-[#faf7f1] p-3">
                <Avatar name={selectedCustomer.name} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-bold text-ink">{selectedCustomer.name}</div>
                  <div className="mt-0.5 text-[10px] font-medium text-muted">
                    {selectedCustomer.phone ?? "Tanpa nomor telepon"} · {selectedCustomer.vehicles.length} kendaraan
                  </div>
                </div>
                <span className="badge-success">
                  <Check size={10} /> Dipilih
                </span>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="customerId" className="label">
                  Pelanggan <span className="text-brand">*</span>
                </label>
                <Link
                  href="/pelanggan/baru?next=/transaksi/baru"
                  className="mb-1.5 inline-flex items-center gap-1 text-[10px] font-extrabold text-brand hover:text-brand-dark"
                >
                  <UserPlus size={11} /> Tambah baru
                </Link>
              </div>
              <div className="relative">
                <select
                  id="customerId"
                  value={customerId}
                  onChange={(event) => selectCustomer(event.target.value)}
                  className="select"
                  required
                >
                  <option value="">Pilih pelanggan…</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} — {customer.phone || "tanpa telepon"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="vehicleId" className="label">
                  Kendaraan
                </label>
                <select
                  id="vehicleId"
                  value={vehicleId}
                  onChange={(event) => setVehicleId(event.target.value)}
                  className="select"
                  disabled={!selectedCustomer}
                >
                  <option value="">Tanpa kendaraan</option>
                  {selectedCustomer?.vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.brand} {vehicle.model} · {vehicle.plateNumber}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="mechanic" className="label">
                  Mekanik
                </label>
                <input
                  id="mechanic"
                  value={mechanic}
                  onChange={(event) => setMechanic(event.target.value)}
                  placeholder="Nama mekanik (opsional)"
                  className="input"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-line px-5 py-4">
            <span className="flex size-7 items-center justify-center rounded-lg bg-pine text-[11px] font-extrabold text-lime">
              2
            </span>
            <div>
              <h2 className="text-[13px] font-extrabold text-ink">Jasa & sparepart</h2>
              <p className="text-[10px] font-medium text-faint">Ketuk item untuk menambahkannya ke nota</p>
            </div>
            {cartDetails.length > 0 && <span className="ml-auto badge-info">{cartDetails.length} item</span>}
          </div>

          <div className="border-b border-line p-4 sm:p-5">
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari nama jasa atau sparepart..."
                className="input h-11 pl-10"
                aria-label="Cari item"
              />
            </div>
            <div className="mt-3 flex gap-1.5">
              {(
                [
                  { value: "semua", label: "Semua" },
                  { value: "jasa", label: "Jasa" },
                  { value: "sparepart", label: "Sparepart" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setCategory(tab.value)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-[11px] font-extrabold transition",
                    category === tab.value
                      ? "bg-pine text-white"
                      : "border border-line bg-white text-muted hover:text-ink",
                  )}
                >
                  {tab.label}
                </button>
              ))}
              <span className="ml-auto self-center text-[10px] font-semibold text-faint">{filteredItems.length} item</span>
            </div>

            <div className="no-scrollbar mt-3 max-h-[286px] space-y-1.5 overflow-y-auto pr-0.5">
              {filteredItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-[11px] text-faint">
                  Tidak ada item yang cocok.
                </div>
              ) : (
                filteredItems.map((item) => {
                  const inCart = cartDetails.find((line) => line.itemId === item.id);
                  const stockEmpty = item.category === "sparepart" && item.stock <= 0;
                  const maxed =
                    item.category === "sparepart" && inCart ? inCart.qty >= item.stock : false;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addItem(item)}
                      disabled={stockEmpty || maxed}
                      className="flex w-full items-center gap-3 rounded-xl border border-transparent px-2.5 py-2.5 text-left transition hover:border-line hover:bg-[#faf7f1] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-lg",
                          item.category === "jasa" ? "bg-[#eef1e7] text-[#4b6143]" : "bg-[#f6e8e2] text-[#a54a2d]",
                        )}
                      >
                        {item.category === "jasa" ? <Wrench size={15} /> : <Cog size={15} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[12px] font-bold text-ink">{item.name}</span>
                          {inCart && (
                            <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-brand text-[9px] font-extrabold text-white">
                              {inCart.qty}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[9.5px] font-medium text-faint">
                          <span className="font-mono">{item.sku}</span>
                          <span>·</span>
                          <span>{item.category === "jasa" ? "Jasa" : `Stok ${item.stock} ${item.unit}`}</span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-[11.5px] font-extrabold text-ink tabular">{formatRupiah(item.price)}</div>
                        <div className="mt-0.5 text-[9px] font-bold text-brand">
                          {stockEmpty ? "Habis" : maxed ? "Maks." : "+ Tambah"}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-[12px] font-extrabold text-ink">
                <ShoppingCart size={13} className="text-muted" /> Item di nota
              </h3>
              {cartDetails.length > 0 && (
                <button
                  type="button"
                  onClick={() => setLines([])}
                  className="text-[10px] font-bold text-danger hover:underline"
                >
                  Kosongkan
                </button>
              )}
            </div>

            {cartDetails.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line-strong bg-[#fbf9f4] px-4 py-8 text-center">
                <ShoppingCart size={20} className="mx-auto mb-2 text-faint" />
                <p className="text-[11px] font-bold text-muted">Nota masih kosong</p>
                <p className="mt-0.5 text-[10px] text-faint">Pilih jasa atau sparepart di atas.</p>
              </div>
            ) : (
              <div className="divide-y divide-line/70">
                {cartDetails.map((line) => (
                  <div key={line.itemId} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-bold text-ink">{line.item.name}</div>
                      <div className="mt-0.5 text-[10px] font-medium text-faint">
                        {formatRupiah(line.item.price)} × {line.qty} {line.item.unit}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 rounded-lg border border-line bg-white p-0.5">
                      <button
                        type="button"
                        onClick={() => changeQty(line.itemId, -1)}
                        className="flex size-6 items-center justify-center rounded-md text-muted transition hover:bg-[#f2eee6] hover:text-ink"
                        aria-label={`Kurangi ${line.item.name}`}
                      >
                        <Minus size={12} />
                      </button>
                      <span className="min-w-5 text-center text-[11px] font-extrabold tabular">{line.qty}</span>
                      <button
                        type="button"
                        onClick={() => changeQty(line.itemId, 1)}
                        className="flex size-6 items-center justify-center rounded-md text-muted transition hover:bg-[#f2eee6] hover:text-ink"
                        aria-label={`Tambah ${line.item.name}`}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    <div className="w-[74px] shrink-0 text-right text-[11.5px] font-extrabold tabular">
                      {formatRupiah(line.item.price * line.qty)}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLine(line.itemId)}
                      className="flex size-7 shrink-0 items-center justify-center rounded-md text-faint transition hover:bg-danger-soft hover:text-danger"
                      aria-label={`Hapus ${line.item.name}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="card p-5">
          <label htmlFor="notes" className="label flex items-center gap-1.5">
            <StickyNote size={13} className="text-muted" /> Catatan servis
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Contoh: ganti oli, cek rem depan, pelanggan minta dikabari via WhatsApp…"
            className="textarea"
            rows={3}
          />
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-5">
        <section className="overflow-hidden rounded-3xl border border-pine/10 bg-pine text-white shadow-[0_18px_50px_-28px_rgba(23,35,29,0.8)]">
          <div className="border-b border-white/[0.08] px-5 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-extrabold">Ringkasan nota</h2>
              <CircleDollarSign size={17} className="text-lime" />
            </div>
            <p className="mt-0.5 text-[10px] text-white/40">Periksa total sebelum menyimpan.</p>
          </div>

          <div className="space-y-2.5 px-5 py-4 text-[11.5px]">
            <div className="flex justify-between text-white/50">
              <span>Subtotal ({formatNumber(cartDetails.reduce((sum, line) => sum + line.qty, 0))} item)</span>
              <span className="font-bold text-white tabular">{formatRupiah(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-white/50">
              <span>Diskon</span>
              <span className="relative">
                <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[10px] text-white/30">Rp</span>
                <input
                  inputMode="numeric"
                  value={discountInput}
                  onChange={(event) => setDiscountInput(event.target.value.replace(/\D/g, ""))}
                  className="w-24 rounded-lg border border-white/10 bg-white/[0.06] py-1.5 pl-7 pr-2 text-right text-[11px] font-bold text-white outline-none tabular focus:border-brand"
                  aria-label="Diskon"
                />
              </span>
            </div>
            <div className="my-1 h-px bg-white/[0.08]" />
            <div className="flex items-end justify-between">
              <span className="text-[11px] font-bold text-white/60">Total</span>
              <span className="font-display text-[1.75rem] font-extrabold tracking-tight tabular">{formatRupiah(total)}</span>
            </div>
          </div>

          <div className="border-t border-white/[0.08] px-5 py-4">
            <div className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/35">Pembayaran</div>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { value: "lunas", label: "Lunas" },
                  { value: "dp", label: "DP" },
                  { value: "belum", label: "Belum" },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => {
                    setPaymentMode(mode.value);
                    if (mode.value === "dp" && !dpInput) {
                      setDpInput(String(Math.round(total / 2 / 1000) * 1000));
                    }
                  }}
                  className={cn(
                    "rounded-lg border px-2 py-2 text-[10.5px] font-extrabold transition",
                    paymentMode === mode.value
                      ? "border-brand bg-brand text-white"
                      : "border-white/10 bg-white/[0.04] text-white/55 hover:text-white",
                  )}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {paymentMode === "dp" && (
              <div className="mt-3">
                <label htmlFor="dpInput" className="mb-1.5 block text-[10px] font-bold text-white/45">
                  Nominal DP
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-white/30">Rp</span>
                  <input
                    id="dpInput"
                    inputMode="numeric"
                    value={dpInput}
                    onChange={(event) => setDpInput(event.target.value.replace(/\D/g, ""))}
                    className="w-full rounded-lg border border-white/10 bg-white/[0.06] py-2.5 pl-9 pr-3 text-[12px] font-bold text-white outline-none tabular focus:border-brand"
                  />
                </div>
              </div>
            )}

            {payNow > 0 && (
              <div className="mt-3">
                <label className="mb-1.5 block text-[10px] font-bold text-white/45">Metode</label>
                <div className="relative">
                  <select
                    value={method}
                    onChange={(event) => setMethod(event.target.value as PaymentMethod)}
                    className="w-full appearance-none rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2.5 text-[11.5px] font-bold text-white outline-none focus:border-brand"
                  >
                    {PAYMENT_METHODS.map((paymentMethod) => (
                      <option key={paymentMethod} value={paymentMethod} className="text-ink">
                        {PAYMENT_METHOD_LABELS[paymentMethod]}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/40" />
                </div>
              </div>
            )}

            <div className="mt-3 flex justify-between rounded-lg bg-white/[0.05] px-3 py-2.5 text-[10.5px]">
              <span className="font-semibold text-white/45">Dibayar sekarang</span>
              <span className="font-extrabold tabular">{formatRupiah(payNow)}</span>
            </div>
            {remaining > 0 && (
              <div className="mt-2 flex justify-between rounded-lg bg-brand/15 px-3 py-2.5 text-[10.5px] text-[#ffb59d]">
                <span className="font-semibold">Sisa jadi piutang</span>
                <span className="font-extrabold tabular">{formatRupiah(remaining)}</span>
              </div>
            )}

            {remaining > 0 && (
              <div className="mt-3">
                <label htmlFor="dueDate" className="mb-1.5 block text-[10px] font-bold text-white/45">
                  Jatuh tempo
                </label>
                <input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  min={today}
                  onChange={(event) => setDueDate(event.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-[11.5px] font-bold text-white outline-none [color-scheme:dark] focus:border-brand"
                />
              </div>
            )}
          </div>

          <div className="px-5 pb-5">
            <button
              type="submit"
              disabled={pending || cartDetails.length === 0 || !customerId}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand text-[13px] font-extrabold text-white shadow-[0_10px_24px_-12px_rgba(240,90,40,0.9)] transition hover:bg-[#ff6a38] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {pending ? (
                <>
                  <LoaderCircle size={16} className="animate-spin" /> Menyimpan nota…
                </>
              ) : (
                <>
                  <Banknote size={16} /> Simpan & buka nota
                </>
              )}
            </button>
            <p className="mt-2.5 text-center text-[9px] leading-relaxed text-white/25">
              Stok sparepart otomatis berkurang. Nota dapat dicetak setelah disimpan.
            </p>
          </div>
        </section>

        <div className="hidden items-start gap-2 rounded-xl border border-line bg-surface/70 px-3.5 py-3 lg:flex">
          <ArrowRight size={13} className="mt-0.5 shrink-0 text-brand" />
          <p className="text-[10px] leading-relaxed text-muted">
            Pembayaran sebagian otomatis masuk ke menu <span className="font-bold text-ink">Piutang</span> beserta
            pengingat jatuh temponya.
          </p>
        </div>
      </aside>
    </form>
  );
}
