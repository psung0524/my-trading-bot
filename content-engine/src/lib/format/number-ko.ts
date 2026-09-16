/**
 * 한국어 금액/숫자 표기와 역파싱.
 * formatKrw(6000000) → "600만 원", formatKrw(150000000) → "1억 5,000만 원"
 */
export function formatKrw(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  const sign = n < 0 ? "-" : "";
  const abs = Math.round(Math.abs(n));
  if (abs < 10000) return `${sign}${abs.toLocaleString("ko-KR")}원`;
  const eok = Math.floor(abs / 100_000_000);
  const man = Math.floor((abs % 100_000_000) / 10_000);
  const rest = abs % 10_000;
  const parts: string[] = [];
  if (eok) parts.push(`${eok.toLocaleString("ko-KR")}억`);
  if (man) parts.push(`${man.toLocaleString("ko-KR")}만`);
  if (rest) parts.push(rest.toLocaleString("ko-KR"));
  return `${sign}${parts.join(" ")} 원`;
}

export function formatPercent(ratio: number, digits = 1): string {
  return `${(ratio * 100).toFixed(digits).replace(/\.0+$/, "")}%`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString("ko-KR");
}

/**
 * 본문에서 숫자 토큰을 추출해 실제 값으로 정규화한다.
 * 지원: "6,000,000", "600만", "1억 5,000만", "12억 3,456만 7,890", "2억", "3%", "0.04", "50만 원"
 */
export function parseKoreanNumbers(text: string): { raw: string; value: number; kind: "percent" | "number" }[] {
  const out: { raw: string; value: number; kind: "percent" | "number" }[] = [];
  const UNIT: Record<string, number> = { 억: 100_000_000, 만: 10_000, 천: 1_000 };
  const tokenRe = /(\d[\d,]*(?:\.\d+)?)\s*(억|만|천)?/g;
  let m: RegExpExecArray | null;
  let i = 0;
  const tokens: { start: number; end: number; num: number; unit: string | undefined }[] = [];
  while ((m = tokenRe.exec(text))) {
    const num = Number(m[1].replace(/,/g, ""));
    if (!Number.isFinite(num)) continue;
    tokens.push({ start: m.index, end: m.index + m[0].length, num, unit: m[2] });
  }
  while (i < tokens.length) {
    const first = tokens[i];
    let value = first.num * (first.unit ? UNIT[first.unit] : 1);
    let end = first.end;
    let lastUnit = first.unit ? UNIT[first.unit] : 1;
    let j = i + 1;
    // 연속된 하위 단위 그룹("1억 5,000만 7,890")을 합친다
    while (first.unit && j < tokens.length) {
      const next = tokens[j];
      const gap = text.slice(end, next.start);
      if (!/^\s*$/.test(gap)) break;
      const nextUnit = next.unit ? UNIT[next.unit] : 1;
      if (nextUnit >= lastUnit) break;
      if (!next.unit && next.num >= 10_000) break;
      value += next.num * nextUnit;
      end = next.end;
      lastUnit = nextUnit;
      j++;
    }
    const tail = text.slice(end).match(/^\s*(%|퍼센트)/);
    const isPercent = Boolean(tail);
    const rawEnd = tail ? end + tail[0].length : end;
    out.push({ raw: text.slice(first.start, rawEnd).trim(), value: isPercent ? value / 100 : value, kind: isPercent ? "percent" : "number" });
    i = j;
  }
  return out;
}
