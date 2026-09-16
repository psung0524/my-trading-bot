import { describe, expect, it } from "vitest";
import { formatKrw, formatPercent, parseKoreanNumbers } from "@/lib/format/number-ko";

describe("formatKrw", () => {
  it("만/억 단위", () => {
    expect(formatKrw(500000)).toBe("50만 원");
    expect(formatKrw(6000000)).toBe("600만 원");
    expect(formatKrw(150000000)).toBe("1억 5,000만 원");
    expect(formatKrw(200000000)).toBe("2억 원");
    expect(formatKrw(120000000)).toBe("1억 2,000만 원");
    expect(formatKrw(9500)).toBe("9,500원");
  });
  it("percent", () => {
    expect(formatPercent(0.03)).toBe("3%");
    expect(formatPercent(0.045)).toBe("4.5%");
  });
});

describe("parseKoreanNumbers", () => {
  it("표기 역파싱", () => {
    const vals = (s: string) => parseKoreanNumbers(s).map((n) => n.value);
    expect(vals("600만 원")).toEqual([6000000]);
    expect(vals("1억 5,000만 원")).toEqual([150000000]);
    expect(vals("2억 원")).toEqual([200000000]);
    expect(vals("6,000,000원")).toEqual([6000000]);
    expect(vals("배당수익률 3%")).toEqual([0.03]);
    expect(vals("50만 원과 4% 그리고 1억 2,000만 원")).toEqual([500000, 0.04, 120000000]);
  });
  it("왕복", () => {
    for (const n of [500000, 6000000, 120000000, 150000000, 200000000, 1234567890]) {
      expect(parseKoreanNumbers(formatKrw(n))[0].value).toBe(n);
    }
  });
});
