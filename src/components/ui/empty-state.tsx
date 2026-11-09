import Link from "next/link";
import { Inbox, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  actionLabel,
  actionHref,
  className,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actionLabel?: string;
  actionHref?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-5 py-12 text-center", className)}>
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-line bg-[#f8f5ef] text-faint">
        <Icon size={23} strokeWidth={1.7} />
      </div>
      <h3 className="font-display text-[15px] font-bold text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-muted">{description}</p>}
      {actionHref && actionLabel && (
        <Link href={actionHref} className="btn-secondary mt-4 btn-sm">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
