import { formatCompactRupiah, formatRupiah } from "@/lib/format";
import { formatDayShort } from "@/lib/dates";
import { cn } from "@/lib/cn";

export function RevenueBars({
  data,
  today,
}: {
  data: { date: string; revenue: number; cash: number }[];
  today: string;
}) {
  const max = Math.max(...data.map((point) => point.revenue), 1);
  const total = data.reduce((sum, point) => sum + point.revenue, 0);

  return (
    <div>
      <div className="mb-4 flex items-end justify-between">
        <div>
          <div className="eyebrow">7 hari terakhir</div>
          <div className="mt-1 font-display text-xl font-extrabold tracking-tight text-ink tabular">
            {formatRupiah(total)}
          </div>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-semibold text-faint">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-brand" /> Omset
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-pine/20" /> Kas
          </span>
        </div>
      </div>

      <div className="flex h-[148px] items-end gap-1.5 sm:gap-2.5">
        {data.map((point) => {
          const revenueHeight = Math.max(6, Math.round((point.revenue / max) * 100));
          const cashHeight = Math.max(3, Math.round((point.cash / max) * 100));
          const isToday = point.date === today;
          return (
            <div key={point.date} className="group flex h-full flex-1 flex-col items-center justify-end gap-2">
              <div
                className="relative flex h-[118px] w-full items-end justify-center"
                title={`${formatDayShort(point.date)}: ${formatRupiah(point.revenue)}`}
              >
                <div
                  className={cn(
                    "absolute bottom-0 w-full max-w-[26px] rounded-t-md transition-all",
                    isToday ? "bg-brand" : "bg-brand/25 group-hover:bg-brand/55",
                  )}
                  style={{ height: `${revenueHeight}%` }}
                />
                <div
                  className="absolute bottom-0 w-full max-w-[10px] rounded-t-sm bg-pine/15"
                  style={{ height: `${cashHeight}%` }}
                />
              </div>
              <div className="text-center">
                <div className={cn("text-[9px] font-bold leading-none", isToday ? "text-brand" : "text-faint")}>
                  {formatDayShort(point.date).split(" ")[0]}
                </div>
                <div className={cn("mt-1 text-[9px] font-semibold leading-none tabular", isToday ? "text-ink" : "text-faint/70")}>
                  {formatCompactRupiah(point.revenue).replace("Rp", "")}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
