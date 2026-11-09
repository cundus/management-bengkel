import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({
  page,
  pageCount,
  total,
  makeHref,
}: {
  page: number;
  pageCount: number;
  total: number;
  makeHref: (page: number) => string;
}) {
  if (pageCount <= 1) {
    return <div className="px-1 pt-3 text-[11px] font-medium text-faint">{total} data ditemukan</div>;
  }
  return (
    <div className="flex items-center justify-between border-t border-line px-1 pt-4">
      <span className="text-[11px] font-medium text-faint">
        Halaman <span className="font-bold text-muted">{page}</span> dari {pageCount} · {total} data
      </span>
      <div className="flex items-center gap-1.5">
        <Link
          href={makeHref(page - 1)}
          aria-disabled={page <= 1}
          className={
            page <= 1
              ? "flex size-8 items-center justify-center rounded-lg border border-line text-faint pointer-events-none opacity-40"
              : "flex size-8 items-center justify-center rounded-lg border border-line bg-surface text-ink hover:border-line-strong"
          }
        >
          <ChevronLeft size={15} />
        </Link>
        <Link
          href={makeHref(page + 1)}
          aria-disabled={page >= pageCount}
          className={
            page >= pageCount
              ? "flex size-8 items-center justify-center rounded-lg border border-line text-faint pointer-events-none opacity-40"
              : "flex size-8 items-center justify-center rounded-lg border border-line bg-surface text-ink hover:border-line-strong"
          }
        >
          <ChevronRight size={15} />
        </Link>
      </div>
    </div>
  );
}
