import { AlertCircle, CheckCircle2, Clock3, MinusCircle } from "lucide-react";
import type { PaymentStatus } from "@/lib/types";
import { cn } from "@/lib/cn";

const CONFIG: Record<
  PaymentStatus,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  lunas: { label: "Lunas", className: "bg-success-soft text-success", icon: CheckCircle2 },
  sebagian: { label: "DP / Sebagian", className: "bg-warning-soft text-warning", icon: Clock3 },
  belum_bayar: { label: "Belum bayar", className: "bg-danger-soft text-danger", icon: AlertCircle },
  batal: { label: "Dibatalkan", className: "bg-[#f0ece4] text-muted", icon: MinusCircle },
};

export function PaymentBadge({ status, compact = false }: { status: PaymentStatus; compact?: boolean }) {
  const config = CONFIG[status];
  const Icon = config.icon;
  return (
    <span className={cn("badge", config.className)}>
      {!compact && <Icon size={11} strokeWidth={2.8} />}
      {config.label}
    </span>
  );
}

export function DueBadge({
  label,
  tone,
}: {
  label: string;
  tone: "safe" | "soon" | "overdue" | "none";
}) {
  const classes = {
    safe: "text-muted",
    soon: "text-warning",
    overdue: "text-danger",
    none: "text-faint",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-bold", classes[tone])}>
      {tone === "overdue" ? <AlertCircle size={11} /> : <Clock3 size={11} />}
      {label}
    </span>
  );
}
