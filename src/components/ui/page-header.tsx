import Link from "next/link";
import { ChevronLeft, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export function PageHeader({
  eyebrow,
  title,
  description,
  backHref,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  backHref?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {backHref && (
          <Link
            href={backHref}
            className="mb-3 inline-flex items-center gap-1 text-[11px] font-bold text-muted transition hover:text-ink"
          >
            <ChevronLeft size={14} />
            Kembali
          </Link>
        )}
        {eyebrow && <div className="eyebrow mb-2 flex items-center gap-2"><span className="h-px w-5 bg-brand" />{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted sm:text-sm">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  action,
  icon: Icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2.5">
        {Icon && (
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#f2eee6] text-muted">
            <Icon size={15} />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="section-title">{title}</h2>
          {description && <p className="mt-0.5 text-[11px] leading-relaxed text-faint sm:text-xs">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
