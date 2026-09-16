import type { Fact, ValidationIssue } from "@/lib/schemas/content";
import { parseKoreanNumbers } from "@/lib/format/number-ko";

/**
 * Consistency Validator: 채널 콘텐츠의 숫자가 Content Master facts와 일치하는지 검사한다.
 * facts에 없는 숫자는 NEEDS_SOURCE(BLOCK)로 표시한다.
 */

const DEFAULT_ALLOW = new Set<number>([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 24, 30, 45, 60, 100, 365, 1080, 1350, 1920]);

function nearlyEqual(a: number, b: number) {
  if (a === b) return true;
  const tol = Math.max(Math.abs(b) * 0.005, 1e-9);
  return Math.abs(a - b) <= tol;
}

export function factValueSet(facts: Fact[]): number[] {
  const values: number[] = [];
  for (const f of facts) {
    if (typeof f.value === "number") {
      values.push(f.value);
      // 비율 fact는 % 표기(3%)와 소수(0.03) 둘 다 허용
      if (f.unit === "ratio") values.push(f.value * 100);
    }
    if (f.display) for (const n of parseKoreanNumbers(f.display)) values.push(n.value);
  }
  return values;
}

export function checkConsistency(text: string, facts: Fact[], opts: { asOfDate?: string; extraAllowed?: number[]; location?: string } = {}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const allowed = factValueSet(facts);
  const extra = new Set<number>(opts.extraAllowed ?? []);
  if (opts.asOfDate) {
    for (const part of opts.asOfDate.split("-")) extra.add(Number(part));
    extra.add(Number(opts.asOfDate.replace(/-/g, "")));
  }
  // 날짜 문자열(2026-09-16), 시간(00:15), 해시태그, URL은 제외
  const cleaned = text
    .replace(/\d{4}-\d{2}-\d{2}/g, " ")
    .replace(/\d{1,2}:\d{2}/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/#\S+/g, " ");
  const numbers = parseKoreanNumbers(cleaned);
  const seen = new Set<string>();
  for (const n of numbers) {
    if (seen.has(n.raw)) continue;
    seen.add(n.raw);
    const v = n.value;
    const candidates = n.kind === "percent" ? [v, v * 100] : [v];
    const ok = candidates.some((c) => DEFAULT_ALLOW.has(c) || extra.has(c) || allowed.some((a) => nearlyEqual(c, a)));
    if (!ok) {
      issues.push({
        code: "NEEDS_SOURCE",
        severity: "BLOCK",
        message: `Content Master에 없는 숫자 "${n.raw}"가 있습니다. 출처를 추가하거나 문장을 수정하세요`,
        location: opts.location ?? "",
        excerpt: n.raw,
      });
    }
  }
  return issues;
}

/** Master 자체 검사: needsSource fact, 기준일, 출처 */
export function checkMasterIntegrity(master: { facts: Fact[]; sources: { name: string }[]; asOfDate: string; cautions: string[] }): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const f of master.facts) {
    if (f.needsSource) issues.push({ code: "NEEDS_SOURCE", severity: "BLOCK", message: `"${f.label}" 수치의 출처가 없습니다`, location: `facts.${f.key}`, excerpt: "" });
    if (typeof f.value === "number" && !f.sourceRef && !f.formula) issues.push({ code: "UNSOURCED_NUMBER", severity: "WARN", message: `"${f.label}"에 출처나 계산식이 없습니다`, location: `facts.${f.key}`, excerpt: "" });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(master.asOfDate)) issues.push({ code: "MISSING_AS_OF_DATE", severity: "BLOCK", message: "기준일이 없습니다", location: "asOfDate", excerpt: "" });
  if (master.facts.some((f) => typeof f.value === "number") && master.sources.length === 0) issues.push({ code: "MISSING_SOURCE", severity: "WARN", message: "숫자가 있지만 출처 목록이 비어 있습니다", location: "sources", excerpt: "" });
  if (master.cautions.length === 0) issues.push({ code: "MISSING_CAUTIONS", severity: "WARN", message: "주의사항(세금·환율 등)이 없습니다", location: "cautions", excerpt: "" });
  return issues;
}
