import { describe, expect, it } from "vitest";
import {
  addDaysISO,
  daysBetween,
  dueLabel,
  endOfMonthISO,
  isValidISODate,
  monthLabel,
  monthRange,
  resolveReportPeriod,
  startOfMonthISO,
  todayISO,
} from "@/lib/dates";

describe("tanggal", () => {
  it("menambah hari melewati batas bulan dan tahun", () => {
    expect(addDaysISO("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysISO("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("menghitung batas bulan termasuk tahun kabisat", () => {
    expect(startOfMonthISO("2026-11-09")).toBe("2026-11-01");
    expect(endOfMonthISO("2024-02-10")).toBe("2024-02-29");
    expect(endOfMonthISO("2026-02-10")).toBe("2026-02-28");
    expect(monthRange("2026-11")).toEqual({ start: "2026-11-01", end: "2026-11-30" });
  });

  it("memvalidasi format tanggal bisnis", () => {
    expect(isValidISODate("2026-11-09")).toBe(true);
    expect(isValidISODate("2026-02-30")).toBe(false);
    expect(isValidISODate("09-11-2026")).toBe(false);
    expect(isValidISODate("")).toBe(false);
  });

  it("memberi label jatuh tempo yang ramah", () => {
    const today = "2026-11-09";
    expect(dueLabel(null, today).tone).toBe("none");
    expect(dueLabel("2026-11-20", today)).toMatchObject({ tone: "safe", days: 11 });
    expect(dueLabel("2026-11-10", today)).toMatchObject({ tone: "soon", days: 1 });
    expect(dueLabel("2026-11-09", today)).toMatchObject({ tone: "soon", days: 0 });
    expect(dueLabel("2026-11-02", today)).toMatchObject({ tone: "overdue", days: -7 });
  });

  it("menghitung jarak hari dan label bulan", () => {
    expect(daysBetween("2026-11-01", "2026-11-09")).toBe(8);
    expect(monthLabel("2026-11")).toContain("November");
    expect(monthLabel("2026-11")).toContain("2026");
    expect(todayISO(new Date("2026-11-09T17:30:00Z"))).toBe("2026-11-10");
  });

  it("menentukan periode laporan bulanan atau interval harian", () => {
    expect(resolveReportPeriod({ month: "2026-02" })).toEqual({
      mode: "bulanan",
      month: "2026-02",
      start: "2026-02-01",
      end: "2026-02-28",
    });
    expect(resolveReportPeriod({ from: "2026-11-01", to: "2026-11-07" })).toMatchObject({
      mode: "harian",
      start: "2026-11-01",
      end: "2026-11-07",
    });
    // Tanggal terbalik ditukar; satu tanggal saja berarti satu hari.
    expect(resolveReportPeriod({ from: "2026-11-07", to: "2026-11-01" })).toMatchObject({
      start: "2026-11-01",
      end: "2026-11-07",
    });
    expect(resolveReportPeriod({ from: "2026-11-05" })).toMatchObject({ start: "2026-11-05", end: "2026-11-05" });
    // Tanggal tidak valid jatuh ke mode bulanan.
    expect(resolveReportPeriod({ from: "2026-02-30", month: "2026-03" }).mode).toBe("bulanan");
    // Rentang dibatasi 366 hari dihitung mundur dari tanggal akhir.
    expect(resolveReportPeriod({ from: "2020-01-01", to: "2026-11-12" })).toMatchObject({
      start: addDaysISO("2026-11-12", -365),
      end: "2026-11-12",
    });
  });
});
