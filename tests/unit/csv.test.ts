import { describe, expect, it } from "vitest";
import { csvEscape, toCsv } from "@/lib/csv";

describe("ekspor CSV", () => {
  it("melindungi nilai yang mengandung delimiter dan kutip", () => {
    expect(csvEscape("Servis; ganti oli")).toBe('"Servis; ganti oli"');
    expect(csvEscape('Oli "Premium"')).toBe('"Oli ""Premium"""');
    expect(csvEscape("baris\nbaru")).toBe('"baris\nbaru"');
  });

  it("mencegah formula injection", () => {
    expect(csvEscape("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
    expect(csvEscape("+62 812")).toBe("'+62 812");
    expect(csvEscape("-100")).toBe("'-100");
    expect(csvEscape("@user")).toBe("'@user");
  });

  it("menyusun baris dengan delimiter titik koma", () => {
    expect(toCsv([["A", "B"], [1, 2]])).toBe("A;B\r\n1;2");
  });
});
