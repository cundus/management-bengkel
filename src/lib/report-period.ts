import { getMonthlyReport, getReport } from "@/lib/queries/reports";
import { monthLabel, rangeLabel, resolveReportPeriod, type ReportPeriod } from "@/lib/dates";
import type { ReportData } from "@/lib/types";

export type ReportSearchParams = { month?: string; from?: string; to?: string };

export type ReportPeriodContext = {
  period: ReportPeriod;
  isDaily: boolean;
  /** Query string periode (tanpa `?`) untuk tautan antar-laporan dan ekspor. */
  query: string;
  label: string;
  previousLabel: string;
  /** Frasa untuk empty state, mis. "bulan ini" atau "pada periode ini". */
  thisPeriod: string;
};

export function reportPeriodContext(params: ReportSearchParams): ReportPeriodContext {
  const period = resolveReportPeriod(params);
  const isDaily = period.mode === "harian";
  return {
    period,
    isDaily,
    query: isDaily ? `from=${period.start}&to=${period.end}` : `month=${period.month}`,
    label: isDaily ? rangeLabel(period.start, period.end) : monthLabel(period.month),
    previousLabel: isDaily ? "vs periode sebelumnya" : "vs bulan lalu",
    thisPeriod: isDaily ? (period.start === period.end ? "pada hari ini" : "pada periode ini") : "bulan ini",
  };
}

export function loadReport(ctx: ReportPeriodContext): Promise<ReportData> {
  return ctx.isDaily ? getReport(ctx.period.start, ctx.period.end) : getMonthlyReport(ctx.period.month);
}

/** Query periode dari URL apa adanya, untuk halaman laporan yang tidak memakai periode. */
export function passthroughPeriodQuery(params: ReportSearchParams): string {
  const query = new URLSearchParams();
  for (const key of ["month", "from", "to"] as const) {
    const value = params[key];
    if (typeof value === "string" && value) query.set(key, value);
  }
  return query.toString();
}
