import { cn } from "@/lib/cn";

export function BrandMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <rect width="48" height="48" rx="14" fill="#17231D" />
      <path
        d="M9 15L16.5 34L24 21L31.5 34L39 15"
        stroke="#F05A28"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 39H22" stroke="#D8F28A" strokeWidth="3" strokeLinecap="round" />
      <circle cx="31" cy="39" r="2.6" fill="#D8F28A" />
      <circle cx="38" cy="39" r="2.6" fill="#F05A28" />
    </svg>
  );
}

export function BrandLogo({
  compact = false,
  light = false,
  className,
}: {
  compact?: boolean;
  light?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <BrandMark size={compact ? 34 : 40} />
      <div className="leading-none">
        <div
          className={cn(
            "font-display text-[19px] font-extrabold tracking-[-0.045em]",
            light ? "text-white" : "text-ink",
          )}
        >
          WMC<span className={light ? "text-lime" : "text-brand"}> 225</span>
        </div>
        {!compact && (
          <div className={cn("mt-1 text-[9px] font-bold uppercase tracking-[0.2em]", light ? "text-white/45" : "text-faint")}>
            Bengkel & Servis
          </div>
        )}
      </div>
    </div>
  );
}
