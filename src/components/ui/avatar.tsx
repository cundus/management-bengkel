import { initials } from "@/lib/format";
import { cn } from "@/lib/cn";

const PALETTES = [
  "bg-[#e8eedc] text-[#44512f]",
  "bg-[#f8e3d7] text-[#8c3e1d]",
  "bg-[#e1e9f3] text-[#365575]",
  "bg-[#f3e5cc] text-[#7a5a18]",
  "bg-[#ece3ef] text-[#62436b]",
];

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const palette = PALETTES[name.charCodeAt(0) % PALETTES.length];
  const sizes = {
    sm: "size-8 rounded-lg text-[10px]",
    md: "size-10 rounded-xl text-[11px]",
    lg: "size-14 rounded-2xl text-sm",
  };
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center font-display font-extrabold tracking-tight",
        sizes[size],
        palette,
        className,
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  );
}
