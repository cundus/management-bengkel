function safeCell(value: string | number | null | undefined): string {
  let text = value == null ? "" : String(value);
  // Cegah formula injection saat CSV dibuka di spreadsheet.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return text;
}

export function csvEscape(value: string | number | null | undefined): string {
  const text = safeCell(value);
  if (/[";\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export function toCsv(rows: (string | number | null | undefined)[][], delimiter = ";"): string {
  return rows.map((row) => row.map(csvEscape).join(delimiter)).join("\r\n");
}

export function csvResponse(filename: string, content: string): Response {
  return new Response(`\uFEFF${content}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
