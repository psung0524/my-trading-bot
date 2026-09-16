import { describe, expect, it } from "vitest";
import { computeDividendTarget, CALC_CAUTIONS } from "@/server/content/dividend-calculator";
import { checkConsistency, checkMasterIntegrity } from "@/server/content/validators/consistency";
import { checkFinanceSafety } from "@/server/content/validators/finance-safety";
import { validateChannelBody, validateMaster } from "@/server/content/validators";
import { DEFAULT_FORBIDDEN_PHRASES } from "@/lib/brand/defaults";
import type { ContentMasterBody } from "@/lib/schemas/content";

const calc = computeDividendTarget(500000, [0.03, 0.04, 0.05]);
const master: ContentMasterBody = {
  title: "월 50만 원의 배당금을 받기 위해 필요한 투자금",
  summary: "요약",
  asOfDate: "2026-09-16",
  facts: calc.facts,
  sources: [{ name: "내부 계산기", url: "", retrievedAt: "2026-09-16", note: "" }],
  cautions: CALC_CAUTIONS,
  cta: { label: "계산하기", url: "https://example.com/calculator", strength: "low" },
  keyMessages: ["월 50만 원 = 연 600만 원"],
};

describe("dividend calculator", () => {
  it("요구사항 예시와 일치", () => {
    expect(calc.annualTarget).toBe(6000000);
    expect(calc.scenarios).toEqual([
      { dividendYield: 0.03, requiredPrincipal: 200000000 },
      { dividendYield: 0.04, requiredPrincipal: 150000000 },
      { dividendYield: 0.05, requiredPrincipal: 120000000 },
    ]);
    expect(calc.facts.find((f) => f.key === "principal2")?.display).toBe("1억 5,000만 원");
  });
});

describe("consistency validator", () => {
  it("facts에 있는 숫자는 통과", () => {
    const text = "월 50만 원을 받으려면 연 600만 원, 배당수익률 4%면 약 1억 5,000만 원이 필요합니다 (2026-09-16 기준)";
    expect(checkConsistency(text, master.facts, { asOfDate: master.asOfDate })).toEqual([]);
  });
  it("facts에 없는 숫자는 NEEDS_SOURCE", () => {
    const issues = checkConsistency("배당수익률 7%면 약 8,571만 원이 필요합니다", master.facts);
    expect(issues.map((i) => i.excerpt)).toEqual(["7%", "8,571만"]);
    expect(issues.every((i) => i.code === "NEEDS_SOURCE" && i.severity === "BLOCK")).toBe(true);
  });
  it("needsSource fact가 있으면 master BLOCK", () => {
    const issues = checkMasterIntegrity({ ...master, facts: [{ ...master.facts[0], needsSource: true }] });
    expect(issues.some((i) => i.code === "NEEDS_SOURCE")).toBe(true);
  });
});

describe("finance safety", () => {
  const ctx = { facts: master.facts, asOfDate: "2026-09-16", cautions: CALC_CAUTIONS, forbiddenPhrases: DEFAULT_FORBIDDEN_PHRASES };
  it("수익 보장/매수 지시/금지 표현 차단", () => {
    const codes = (t: string) => checkFinanceSafety(t, ctx).map((i) => i.code);
    expect(codes("이 종목은 무조건 오른다")).toContain("GUARANTEE");
    expect(codes("지금 사세요, 확실한 수익")).toEqual(expect.arrayContaining(["DIRECTIVE", "GUARANTEE"]));
    expect(codes("인생 종목 발견")).toContain("FORBIDDEN_PHRASE");
    expect(codes("놓치면 후회합니다")).toContain("FEAR");
  });
  it("기준일/세금 누락 경고", () => {
    const issues = checkFinanceSafety("월 50만 원 배당에는 1억 5,000만 원이 필요합니다", ctx);
    expect(issues.map((i) => i.code)).toEqual(expect.arrayContaining(["MISSING_AS_OF_DATE", "MISSING_TAX_NOTE"]));
    expect(issues.every((i) => i.severity === "WARN")).toBe(true);
  });
  it("안전한 문장은 통과", () => {
    expect(checkFinanceSafety("월 50만 원 배당에는 배당수익률 4% 기준 약 1억 5,000만 원이 필요합니다 (기준일 2026-09-16, 세금 미반영)", ctx)).toEqual([]);
  });
});

describe("validate helpers", () => {
  it("validateMaster ok", () => {
    const r = validateMaster(master, DEFAULT_FORBIDDEN_PHRASES);
    expect(r.blocked).toBe(false);
  });
  it("validateChannelBody threads", () => {
    const r = validateChannelBody("THREADS", { variant: "INFO", text: "월 50만 원 배당, 4%면 약 1억 5,000만 원 (기준일 2026-09-16, 세금 미반영)", includeLink: true, ctaStrength: "low", lessAdLike: true, factRefs: [] }, master, DEFAULT_FORBIDDEN_PHRASES);
    expect(r.blocked).toBe(false);
    const bad = validateChannelBody("THREADS", { variant: "INFO", text: "9%면 6,667만 원. 무조건 오른다", includeLink: true, ctaStrength: "low", lessAdLike: true, factRefs: [] }, master, DEFAULT_FORBIDDEN_PHRASES);
    expect(bad.blocked).toBe(true);
  });
});
