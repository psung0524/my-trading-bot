import type { Fact } from "@/lib/schemas/content";
import { formatKrw, formatPercent } from "@/lib/format/number-ko";

/**
 * 결정론적 배당 계산기. AI는 이 결과를 인용만 하고 숫자를 새로 만들지 않는다.
 * requiredPrincipal = annualTarget / dividendYield (세금·환율 미반영)
 */
export function computeDividendTarget(monthlyTarget: number, yields: number[]) {
  const annualTarget = monthlyTarget * 12;
  const scenarios = yields.map((y) => ({
    dividendYield: y,
    requiredPrincipal: Math.round(annualTarget / y),
  }));
  const facts: Fact[] = [
    {
      key: "monthlyTarget",
      label: "월 목표 배당금",
      value: monthlyTarget,
      unit: "KRW",
      display: formatKrw(monthlyTarget),
      formula: "입력값",
      assumptions: [],
      sourceRef: "calc",
      needsSource: false,
    },
    {
      key: "annualTarget",
      label: "연간 목표 배당금",
      value: annualTarget,
      unit: "KRW",
      display: formatKrw(annualTarget),
      formula: "monthlyTarget × 12",
      assumptions: [],
      sourceRef: "calc",
      needsSource: false,
    },
    ...scenarios.flatMap((s, i) => [
      {
        key: `yield${i + 1}`,
        label: `시나리오 ${i + 1} 배당수익률`,
        value: s.dividendYield,
        unit: "ratio",
        display: formatPercent(s.dividendYield),
        formula: "가정",
        assumptions: ["세전 배당수익률"],
        sourceRef: "calc",
        needsSource: false,
      },
      {
        key: `principal${i + 1}`,
        label: `배당수익률 ${formatPercent(s.dividendYield)}일 때 필요 투자금`,
        value: s.requiredPrincipal,
        unit: "KRW",
        display: formatKrw(s.requiredPrincipal),
        formula: `annualTarget ÷ ${formatPercent(s.dividendYield)}`,
        assumptions: ["세금 미반영", "환율 변동 미반영", "배당금은 변동되거나 삭감될 수 있음"],
        sourceRef: "calc",
        needsSource: false,
      },
    ]),
  ];
  return { annualTarget, scenarios, facts };
}

export const CALC_CAUTIONS = ["세금 미반영", "환율 변동 미반영", "배당금은 변동되거나 삭감될 수 있음", "과거 배당수익률이 미래를 보장하지 않음"];
