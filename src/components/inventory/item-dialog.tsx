"use client";

import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AlertCircle, LoaderCircle, Pencil, Plus, X } from "lucide-react";
import { saveItemAction } from "@/actions/inventory";
import { initialActionState } from "@/lib/action-state";
import { ITEM_CATEGORIES, ITEM_CATEGORY_LABELS } from "@/lib/constants";
import { formatRupiah } from "@/lib/format";
import type { Item } from "@/lib/types";

export function ItemDialog({
  item,
  trigger = "add",
}: {
  item?: Item;
  trigger?: "add" | "edit";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(item?.category ?? "sparepart");
  const [state, action, pending] = useActionState(saveItemAction, initialActionState);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={trigger === "add" ? "btn-primary" : "btn-ghost btn-sm"}
        aria-label={trigger === "add" ? "Tambah item" : `Edit ${item?.name}`}
      >
        {trigger === "add" ? (
          <>
            <Plus size={16} /> Item baru
          </>
        ) : (
          <>
            <Pencil size={12} /> Edit
          </>
        )}
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-pine/45 backdrop-blur-sm sm:items-center sm:p-4">
          <button type="button" className="absolute inset-0 cursor-default" aria-label="Tutup" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="item-dialog-title"
            className="relative z-10 max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-float sm:rounded-3xl sm:p-6"
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <div className="eyebrow mb-1">{item ? "Edit item" : "Katalog baru"}</div>
                <h2 id="item-dialog-title" className="font-display text-lg font-extrabold tracking-tight text-ink">
                  {item ? item.name : "Tambah jasa / sparepart"}
                </h2>
                <p className="mt-0.5 text-[10px] text-muted">Perubahan harga berlaku untuk transaksi berikutnya.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex size-8 items-center justify-center rounded-lg border border-line text-muted hover:bg-[#f2eee6]"
                aria-label="Tutup dialog"
              >
                <X size={16} />
              </button>
            </div>

            <form action={action} className="space-y-3.5">
              {item && <input type="hidden" name="id" value={item.id} />}
              {state.message && !state.ok && (
                <div className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-[10.5px] font-semibold text-danger">
                  <AlertCircle size={13} className="mt-0.5 shrink-0" /> {state.message}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label htmlFor="item-name" className="label">
                    Nama item <span className="text-brand">*</span>
                  </label>
                  <input
                    id="item-name"
                    name="name"
                    required
                    defaultValue={item?.name}
                    placeholder="Contoh: Oli Mesin 10W-40"
                    className="input"
                  />
                  {state.fieldErrors?.name && <p className="mt-1 text-[9px] font-semibold text-danger">{state.fieldErrors.name}</p>}
                </div>
                <div>
                  <label htmlFor="item-sku" className="label">
                    SKU <span className="text-brand">*</span>
                  </label>
                  <input
                    id="item-sku"
                    name="sku"
                    required
                    defaultValue={item?.sku}
                    placeholder="SPR-009"
                    className="input font-mono text-[12px] font-bold uppercase"
                  />
                  {state.fieldErrors?.sku && <p className="mt-1 text-[9px] font-semibold text-danger">{state.fieldErrors.sku}</p>}
                </div>
                <div>
                  <label htmlFor="item-category" className="label">
                    Kategori
                  </label>
                  <select
                    id="item-category"
                    name="category"
                    disabled={item?.category === "sparepart"}
                    value={category}
                    onChange={(event) => setCategory(event.target.value as Item["category"])}
                    className="select"
                  >
                    {ITEM_CATEGORIES.map((value) => (
                      <option key={value} value={value}>
                        {ITEM_CATEGORY_LABELS[value]}
                      </option>
                    ))}
                  </select>
                  {item?.category === "sparepart" && <input type="hidden" name="category" value="sparepart" />}
                </div>
                <div>
                  <label htmlFor="item-price" className="label">
                    Harga jual <span className="text-brand">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-faint">Rp</span>
                    <input
                      id="item-price"
                      name="price"
                      inputMode="numeric"
                      required
                      defaultValue={item?.price ?? ""}
                      placeholder="65000"
                      className="input pl-8 tabular"
                    />
                  </div>
                  {state.fieldErrors?.price && <p className="mt-1 text-[9px] font-semibold text-danger">{state.fieldErrors.price}</p>}
                </div>
                <div>
                  <label htmlFor="item-cost" className="label">
                    Harga modal acuan
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-faint">Rp</span>
                    <input
                      id="item-cost"
                      name="cost"
                      inputMode="numeric"
                      defaultValue={item?.cost ?? ""}
                      placeholder="48000"
                      className="input pl-8 tabular"
                    />
                  </div>
                  {state.fieldErrors?.cost && <p className="mt-1 text-[9px] font-semibold text-danger">{state.fieldErrors.cost}</p>}
                </div>
                <div>
                  <label htmlFor="item-unit" className="label">
                    Satuan
                  </label>
                  <input id="item-unit" name="unit" defaultValue={item?.unit ?? "pcs"} placeholder="pcs" className="input" />
                </div>
                {category === "sparepart" && (
                  <>
                    <div>
                      <label htmlFor="item-stock" className="label">
                        Stok saat ini
                      </label>
                      <input
                        id="item-stock"
                        name="stock"
                        readOnly={Boolean(item)}
                        inputMode="numeric"
                        defaultValue={item?.stock ?? 0}
                        className="input tabular"
                      />
                      {item && <p className="mt-1 text-[10px] text-muted">Tambah persediaan melalui Batch stok.</p>}
                      {state.fieldErrors?.stock && <p className="mt-1 text-[9px] text-danger">{state.fieldErrors.stock}</p>}
                    </div>
                    <div>
                      <label htmlFor="item-min" className="label">
                        Stok minimum
                      </label>
                      <input
                        id="item-min"
                        name="minStock"
                        inputMode="numeric"
                        defaultValue={item?.minStock ?? 0}
                        className="input tabular"
                      />
                    </div>
                  </>
                )}
              </div>

              {category === "jasa" && <input type="hidden" name="stock" value="0" />}
              {!item && (
                <p className="rounded-lg bg-[#f8f5ef] px-3 py-2 text-[9.5px] leading-relaxed text-faint">
                  Harga jual akan dipakai saat item ditambahkan ke nota. Harga modal digunakan untuk menghitung HPP dan
                  laba di laporan.
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={pending} className="btn-primary h-11 flex-1">
                  {pending ? (
                    <>
                      <LoaderCircle size={14} className="animate-spin" /> Menyimpan…
                    </>
                  ) : (
                    <>Simpan {item ? "perubahan" : "item"}</>
                  )}
                </button>
                <button type="button" onClick={() => setOpen(false)} className="btn-secondary h-11">
                  Batal
                </button>
              </div>
              {item && (
                <p className="text-center text-[9px] text-faint">Harga saat ini: {formatRupiah(item.price)}</p>
              )}
            </form>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
