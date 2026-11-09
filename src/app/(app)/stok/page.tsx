import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Box, Cog, PackageSearch, Search, Wrench, X } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listItems } from "@/lib/queries/items";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ItemDialog } from "@/components/inventory/item-dialog";
import { toggleItemAction } from "@/actions/inventory";
import { formatNumber, formatRupiah } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Stok & Jasa" };

const CATEGORY_FILTERS = [
  { value: "semua", label: "Semua" },
  { value: "sparepart", label: "Sparepart" },
  { value: "jasa", label: "Jasa" },
];

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kategori?: string; low?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const category = ["semua", "sparepart", "jasa"].includes(params.kategori ?? "") ? params.kategori! : "semua";
  const lowOnly = params.low === "1";
  const allItems = await listItems({ search: query });
  const items = allItems.filter((item) => {
    if (category !== "semua" && item.category !== category) return false;
    if (lowOnly && !(item.category === "sparepart" && item.stock <= item.minStock)) return false;
    return true;
  });
  const spareparts = allItems.filter((item) => item.category === "sparepart");
  const lowStock = spareparts.filter((item) => item.stock <= item.minStock);
  const stockValue = spareparts.reduce((sum, item) => sum + item.stock * item.cost, 0);
  const isOwner = user.role === "owner";

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="Persediaan"
        title="Stok & jasa"
        description="Katalog harga dan persediaan sparepart. Stok berkurang otomatis setiap transaksi."
        actions={isOwner ? <ItemDialog /> : undefined}
      />

      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
        <div className="card p-4">
          <div className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.1em] text-faint">
            <PackageSearch size={11} /> Total item
          </div>
          <div className="mt-1.5 font-display text-xl font-extrabold tracking-tight text-ink tabular">{allItems.length}</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.1em] text-faint">
            <Box size={11} /> Nilai persediaan
          </div>
          <div className="mt-1.5 font-display text-xl font-extrabold tracking-tight text-ink tabular">
            {formatRupiah(stockValue)}
          </div>
        </div>
        <div className={cn("card p-4", lowStock.length > 0 && "border-warning/30 bg-warning-soft/50")}>
          <div className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.1em] text-faint">
            <AlertTriangle size={11} /> Stok menipis
          </div>
          <div className={cn("mt-1.5 font-display text-xl font-extrabold tracking-tight tabular", lowStock.length > 0 ? "text-warning" : "text-ink")}>
            {lowStock.length}
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.1em] text-faint">
            <Wrench size={11} /> Layanan jasa
          </div>
          <div className="mt-1.5 font-display text-xl font-extrabold tracking-tight text-ink tabular">
            {allItems.filter((item) => item.category === "jasa").length}
          </div>
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-warning/20 bg-warning-soft px-4 py-3">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning" />
          <div>
            <p className="text-[11.5px] font-extrabold text-warning">{lowStock.length} sparepart di bawah stok minimum</p>
            <p className="mt-0.5 text-[10px] font-medium text-warning/75">
              {lowStock.map((item) => `${item.name} (${item.stock}/${item.minStock})`).join(" · ")}
            </p>
          </div>
          <Link href="/stok?low=1" className="ml-auto shrink-0 text-[10px] font-extrabold text-warning hover:underline">
            Filter →
          </Link>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <form method="get" action="/stok" className="relative w-full sm:max-w-sm">
            {category !== "semua" && <input type="hidden" name="kategori" value={category} />}
            {lowOnly && <input type="hidden" name="low" value="1" />}
            <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Cari nama atau SKU…"
              className="input h-11 pl-10 pr-10 text-[13px]"
              aria-label="Cari item"
            />
            {query && (
              <Link
                href={`/stok?${new URLSearchParams({ ...(category !== "semua" ? { kategori: category } : {}), ...(lowOnly ? { low: "1" } : {}) })}`}
                className="absolute right-2.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-faint hover:bg-[#f2eee6]"
                aria-label="Hapus pencarian"
              >
                <X size={14} />
              </Link>
            )}
          </form>
          <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto">
            {CATEGORY_FILTERS.map((filter) => (
              <Link
                key={filter.value}
                href={`/stok?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(filter.value !== "semua" ? { kategori: filter.value } : {}), ...(lowOnly ? { low: "1" } : {}) })}`}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-extrabold transition",
                  category === filter.value
                    ? "bg-pine text-white"
                    : "border border-line bg-white text-muted hover:text-ink",
                )}
              >
                {filter.label}
              </Link>
            ))}
            <Link
              href={`/stok?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(category !== "semua" ? { kategori: category } : {}), ...(!lowOnly ? { low: "1" } : {}) })}`}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-extrabold transition",
                lowOnly ? "bg-warning text-white" : "border border-line bg-white text-muted hover:text-ink",
              )}
            >
              Stok menipis
            </Link>
          </div>
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title="Tidak ada item"
            description="Ubah filter atau tambahkan item baru ke katalog."
          />
        ) : (
          <>
            <div className="hidden sm:block">
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Kategori</th>
                      <th className="text-right">Harga jual</th>
                      <th className="text-right">Modal</th>
                      <th className="text-center">Stok</th>
                      <th>Status</th>
                      {isOwner && <th className="text-right">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const low = item.category === "sparepart" && item.stock <= item.minStock;
                      return (
                        <tr key={item.id} className={cn(!item.isActive && "opacity-50")}>
                          <td>
                            <div className="flex items-center gap-2.5">
                              <span
                                className={cn(
                                  "flex size-8 items-center justify-center rounded-lg",
                                  item.category === "jasa" ? "bg-[#eef1e7] text-[#4b6143]" : "bg-[#f6e8e2] text-[#a54a2d]",
                                )}
                              >
                                {item.category === "jasa" ? <Wrench size={14} /> : <Cog size={14} />}
                              </span>
                              <div>
                                <div className="text-[12px] font-bold text-ink">{item.name}</div>
                                <div className="font-mono text-[9px] font-semibold text-faint">{item.sku}</div>
                              </div>
                            </div>
                          </td>
                          <td className="text-[10px] font-bold capitalize text-muted">{item.category}</td>
                          <td className="text-right text-[11.5px] font-extrabold tabular">{formatRupiah(item.price)}</td>
                          <td className="text-right text-[11px] text-muted tabular">{formatRupiah(item.cost)}</td>
                          <td className="text-center">
                            {item.category === "sparepart" ? (
                              <div>
                                <span className={cn("text-[12px] font-extrabold tabular", low ? "text-danger" : "text-ink")}>
                                  {formatNumber(item.stock)}
                                </span>
                                <span className="text-[9px] font-medium text-faint"> / {item.minStock}</span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-faint">—</span>
                            )}
                          </td>
                          <td>
                            <div className="flex flex-wrap gap-1">
                              {!item.isActive && <span className="badge-neutral">Nonaktif</span>}
                              {item.isActive && low && <span className="badge-danger">Menipis</span>}
                              {item.isActive && !low && item.category === "sparepart" && <span className="badge-success">Aman</span>}
                              {item.category === "jasa" && <span className="badge-info">Layanan</span>}
                            </div>
                          </td>
                          {isOwner && (
                            <td className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <ItemDialog item={item} trigger="edit" />
                                <form action={toggleItemAction}>
                                  <input type="hidden" name="id" value={item.id} />
                                  <button type="submit" className="btn-ghost btn-sm text-[9px]">
                                    {item.isActive ? "Nonaktifkan" : "Aktifkan"}
                                  </button>
                                </form>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="divide-y divide-line/70 sm:hidden">
              {items.map((item) => {
                const low = item.category === "sparepart" && item.stock <= item.minStock;
                return (
                  <div key={item.id} className={cn("p-4", !item.isActive && "opacity-50")}>
                    <div className="flex items-start gap-2.5">
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-lg",
                          item.category === "jasa" ? "bg-[#eef1e7] text-[#4b6143]" : "bg-[#f6e8e2] text-[#a54a2d]",
                        )}
                      >
                        {item.category === "jasa" ? <Wrench size={15} /> : <Cog size={15} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-[12px] font-extrabold text-ink">{item.name}</div>
                            <div className="mt-0.5 font-mono text-[9px] font-semibold text-faint">
                              {item.sku} · {item.category}
                            </div>
                          </div>
                          {isOwner && <ItemDialog item={item} trigger="edit" />}
                        </div>
                        <div className="mt-2 flex items-end justify-between">
                          <div>
                            <div className="text-[12px] font-extrabold text-ink tabular">{formatRupiah(item.price)}</div>
                            <div className="text-[9px] font-medium text-faint">modal {formatRupiah(item.cost)}</div>
                          </div>
                          {item.category === "sparepart" && (
                            <span className={cn("badge", low ? "badge-danger" : "badge-success")}>
                              Stok {item.stock}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        <div className="border-t border-line px-4 py-3 text-[10px] font-medium text-faint sm:px-5">
          {items.length} dari {allItems.length} item ditampilkan.
        </div>
      </div>
    </div>
  );
}
