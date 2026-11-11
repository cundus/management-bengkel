import Link from "next/link";
import { CalendarDays, Download } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ReportTabs } from "@/components/reports/report-tabs";
import { monthOptions } from "@/lib/queries/reports";
import { addDaysISO, MAX_REPORT_RANGE_DAYS, todayISO } from "@/lib/dates";
import type { ReportPeriodContext } from "@/lib/report-period";
import { cn } from "@/lib/cn";

function ModeToggle({ basePath, ctx }: { basePath: string; ctx: ReportPeriodContext }) {
  const today = todayISO();
  return (
    <nav className="flex rounded-xl border border-line-strong bg-surface p-0.5 text-[11px] font-extrabold" aria-label="Mode periode">
      <Link
        href={`${basePath}?month=${ctx.period.month}`}
        aria-current={!ctx.isDaily ? "page" : undefined}
        className={cn("rounded-[10px] px-3 py-2", !ctx.isDaily ? "bg-pine text-white" : "text-muted hover:text-ink")}
      >
        Bulanan
      </Link>
      <Link
        href={`${basePath}?from=${today}&to=${today}`}
        aria-current={ctx.isDaily ? "page" : undefined}
        className={cn("rounded-[10px] px-3 py-2", ctx.isDaily ? "bg-pine text-white" : "text-muted hover:text-ink")}
      >
        Harian
      </Link>
    </nav>
  );
}

function PeriodForm({ basePath, ctx }: { basePath: string; ctx: ReportPeriodContext }) {
  const { period } = ctx;
  const fieldClass =
    "h-10 min-w-0 rounded-xl border border-line-strong bg-surface text-[11.5px] font-extrabold text-ink outline-none focus:border-brand";
  if (ctx.isDaily) {
    return (
      <form method="get" action={basePath} className="flex w-full items-center gap-1.5 sm:w-auto">
        <input type="date" name="from" defaultValue={period.start} className={cn(fieldClass, "flex-1 px-2.5 sm:flex-none")} aria-label="Dari tanggal" />
        <span className="text-[10px] font-bold text-faint">s/d</span>
        <input type="date" name="to" defaultValue={period.end} className={cn(fieldClass, "flex-1 px-2.5 sm:flex-none")} aria-label="Sampai tanggal" />
        <button type="submit" className="btn-primary h-10 shrink-0 px-3 text-[11px]">
          Lihat
        </button>
      </form>
    );
  }
  return (
    <form method="get" action={basePath} className="flex w-full items-center gap-1.5 sm:w-auto">
      <div className="relative flex-1 sm:flex-none">
        <CalendarDays size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
        <select name="month" defaultValue={period.month} className={cn(fieldClass, "w-full appearance-none pl-8 pr-8")} aria-label="Pilih bulan laporan">
          {monthOptions(12).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="btn-primary h-10 shrink-0 px-3 text-[11px]">
        Lihat
      </button>
    </form>
  );
}

function QuickRanges({ basePath, ctx }: { basePath: string; ctx: ReportPeriodContext }) {
  const today = todayISO();
  const ranges = [
    { label: "Hari ini", from: today, to: today },
    { label: "Kemarin", from: addDaysISO(today, -1), to: addDaysISO(today, -1) },
    { label: "7 hari", from: addDaysISO(today, -6), to: today },
    { label: "30 hari", from: addDaysISO(today, -29), to: today },
  ];
  return (
    <nav className="no-print mb-3 flex flex-wrap items-center gap-1.5" aria-label="Rentang cepat">
      {ranges.map((range) => {
        const active = range.from === ctx.period.start && range.to === ctx.period.end;
        return (
          <Link
            key={range.label}
            href={`${basePath}?from=${range.from}&to=${range.to}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[10px] font-extrabold",
              active ? "border-pine bg-pine text-white" : "border-line-strong bg-surface text-muted hover:text-ink",
            )}
          >
            {range.label}
          </Link>
        );
      })}
      <span className="text-[9.5px] font-medium text-faint">Maks. {MAX_REPORT_RANGE_DAYS} hari.</span>
    </nav>
  );
}

function ExportLink({ href }: { href: string }) {
  return (
    <a href={href} className="btn-secondary h-10 shrink-0" aria-label="Ekspor CSV">
      <Download size={15} />
      <span className="hidden sm:inline">Ekspor CSV</span>
    </a>
  );
}

/**
 * Header bersama semua halaman laporan. Urutannya: judul → tab antar-laporan →
 * filter periode (jika laporan berbasis periode) → info periode.
 */
export function ReportHeader({
  active,
  eyebrow,
  title,
  description,
  ctx,
  tabQuery,
  exportHref,
  meta,
}: {
  active: string;
  eyebrow: string;
  title: string;
  description: string;
  ctx?: ReportPeriodContext;
  tabQuery?: string;
  exportHref?: string;
  meta?: React.ReactNode;
}) {
  return (
    <>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
      />
      <ReportTabs active={active} query={tabQuery ?? ctx?.query} />
      {ctx && (
        <div className="no-print mb-3 flex flex-wrap items-center gap-2">
          <ModeToggle basePath={active} ctx={ctx} />
          <div className="order-last w-full sm:order-none sm:w-auto">
            <PeriodForm basePath={active} ctx={ctx} />
          </div>
          {exportHref && (
            <div className="ml-auto">
              <ExportLink href={exportHref} />
            </div>
          )}
        </div>
      )}
      {ctx?.isDaily && <QuickRanges basePath={active} ctx={ctx} />}
      {(ctx || meta) && (
        <section className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {ctx && (
              <span className="badge-neutral">
                <CalendarDays size={11} /> {ctx.label}
              </span>
            )}
            {meta}
          </div>
          {!ctx && exportHref ? (
            <ExportLink href={exportHref} />
          ) : (
            <div className="hidden text-[10px] font-semibold text-faint sm:block">Semua angka dalam Rupiah</div>
          )}
        </section>
      )}
    </>
  );
}
