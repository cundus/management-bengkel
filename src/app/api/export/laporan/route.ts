import { getCurrentUser } from "@/lib/auth";
import { getMonthlyReport } from "@/lib/queries/reports";
import { csvResponse, toCsv } from "@/lib/csv";
import { currentMonthISO, isValidMonth, monthLabel } from "@/lib/dates";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const requested = url.searchParams.get("month");
  const month = isValidMonth(requested) ? requested : currentMonthISO();
  const report = await getMonthlyReport(month);

  const rows: (string | number)[][] = [
    ["Laporan Bulanan WMC 225", monthLabel(month)],
    ["Periode", `${report.start} s/d ${report.end}`],
    [],
    ["RINGKASAN", "NILAI (Rp)"],
    ["Omset", report.revenue],
    ["Transaksi", report.transactions],
    ["HPP", report.cogs],
    ["Laba kotor", report.grossProfit],
    ["Biaya operasional", report.expenses],
    ["Laba bersih", report.netProfit],
    ["Kas diterima", report.cashIn],
    ["Kas keluar", report.cashOut],
    ["Arus kas bersih", report.netCash],
    ["Piutang berjalan", report.outstanding],
    ["Piutang lewat tempo", report.overdue],
    [],
    ["MARGIN PER JENIS PRODUK"],
    ["Jenis", "Omset", "Modal (HPP)", "Laba kotor", "Margin (%)", "Qty"],
    ...(["jasa", "sparepart"] as const).map((key) => {
      const summary = report.categoryMargins[key];
      return [
        key === "jasa" ? "Jasa" : "Barang",
        summary.revenue,
        summary.cost,
        summary.grossProfit,
        summary.margin,
        summary.qty,
      ];
    }),
    [],
    ["MARGIN PRODUK JASA"],
    ["Jasa", "Qty", "Omset", "Modal (HPP)", "Laba kotor", "Margin (%)"],
    ...report.itemMargins.jasa.map((item) => [item.name, item.qty, item.revenue, item.cost, item.grossProfit, item.margin]),
    [],
    ["MARGIN PRODUK BARANG"],
    ["Barang", "Qty", "Omset", "Modal (HPP)", "Laba kotor", "Margin (%)"],
    ...report.itemMargins.sparepart.map((item) => [
      item.name,
      item.qty,
      item.revenue,
      item.cost,
      item.grossProfit,
      item.margin,
    ]),
    [],
    ["PENDAPATAN HARIAN"],
    ["Tanggal", "Transaksi", "Omset", "Kas diterima"],
    ...report.daily.map((day) => [day.date, day.transactions, day.revenue, day.cash]),
    [],
    ["PENGELUARAN PER KATEGORI"],
    ["Kategori", "Nominal"],
    ...report.expenseByCategory.map((item) => [item.category, item.amount]),
    [],
    ["METODE PEMBAYARAN"],
    ["Metode", "Jumlah transaksi", "Nominal"],
    ...report.paymentMethods.map((item) => [item.method, item.count, item.amount]),
    [],
    ["ITEM TERLARIS"],
    ["Item", "Kategori", "Qty", "Pendapatan"],
    ...report.topItems.map((item) => [item.name, item.category, item.qty, item.revenue]),
  ];

  return csvResponse(`wmc225-laporan-${month}.csv`, toCsv(rows));
}
