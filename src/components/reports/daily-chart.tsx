import { formatCompactRupiah, formatRupiah } from "@/lib/format";
import { cn } from "@/lib/cn";

export function DailyRevenueChart({
  daily,
  start,
  end,
}: {
  daily: { date: string; revenue: number; transactions: number }[];
  start: string;
  end: string;
}) {
  const max = Math.max(...daily.map((day) => day.revenue), 1);
  const total = daily.reduce((sum, day) => sum + day.revenue, 0);
  const activeDays = daily.filter((day) => day.revenue > 0).length;
  const bestDay = [...daily].sort((a, b) => b.revenue - a.revenue)[0];
  const shortDate = (iso: string) =>
    new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", timeZone: "UTC" }).format(
      new Date(`${iso}T12:00:00Z`),
    );
  const middle = daily[Math.floor((daily.length - 1) / 2)]?.date ?? start;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Pendapatan harian</div>
          <div className="mt-1 font-display text-[1.65rem] font-extrabold tracking-tight text-ink tabular">
            {formatRupiah(total)}
          </div>
          <div className="mt-1 text-[10px] font-medium text-faint">
            {activeDays} hari aktif · rata-rata {formatCompactRupiah(Math.round(total / Math.max(activeDays, 1)))}/hari
          </div>
        </div>
        <div className="flex gap-2">
          <div className="rounded-lg bg-[#f8f5ef] px-2.5 py-1.5 text-right">
            <div className="text-[8px] font-extrabold uppercase tracking-wider text-faint">Hari terbaik</div>
            <div className="mt-0.5 text-[10px] font-extrabold text-ink">
              {bestDay?.revenue ? `${formatCompactRupiah(bestDay.revenue)} · ${shortDate(bestDay.date)}` : "—"}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex h-[170px] items-end gap-[3px] sm:gap-1.5">
        {daily.map((day) => {
          const height = day.revenue > 0 ? Math.max(4, (day.revenue / max) * 100) : 2;
          const isBest = day.date === bestDay?.date && day.revenue > 0;
          return (
            <div key={day.date} className="group relative flex h-full flex-1 flex-col justify-end">
              <div className="relative flex h-[148px] items-end">
                <div
                  className={cn(
                    "w-full rounded-t-[3px] transition-all",
                    isBest ? "bg-brand" : day.revenue > 0 ? "bg-pine/70 group-hover:bg-pine" : "bg-line-strong/60",
                  )}
                  style={{ height: `${height}%` }}
                  title={`${day.date}: ${formatRupiah(day.revenue)} (${day.transactions} transaksi)`}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between border-t border-line pt-2">
        <span className="text-[9px] font-bold text-faint">{shortDate(start)}</span>
        {daily.length > 2 && <span className="text-[9px] font-bold text-faint">{shortDate(middle)}</span>}
        {end !== start && <span className="text-[9px] font-bold text-faint">{shortDate(end)}</span>}
      </div>
    </div>
  );
}
