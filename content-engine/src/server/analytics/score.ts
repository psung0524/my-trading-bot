import type { ContentMetrics } from "./performance";
import { rate } from "./performance";

export type ScoreWeights = { click: number; signup: number; activation: number; return: number };
export const DEFAULT_WEIGHTS: ScoreWeights = { click: 0.2, signup: 0.35, activation: 0.3, return: 0.15 };
/** 점수를 계산하기 위한 최소 표본 */
export const MIN_CLICKS_FOR_SCORE = 5;

export function parseWeights(settings: unknown): ScoreWeights {
  const s = (settings as { scoreWeights?: Partial<ScoreWeights> } | null)?.scoreWeights ?? {};
  const w = { ...DEFAULT_WEIGHTS, ...s };
  const sum = w.click + w.signup + w.activation + w.return;
  return sum > 0 ? { click: w.click / sum, signup: w.signup / sum, activation: w.activation / sum, return: w.return / sum } : DEFAULT_WEIGHTS;
}

export type Scored = ContentMetrics & {
  clickRate: number | null;
  signupRate: number | null;
  activationRate: number | null;
  returnRate: number | null;
  score: number | null;
  needsData: boolean;
};

function normalize(values: (number | null)[]): (number | null)[] {
  const nums = values.filter((v): v is number => v !== null);
  const max = nums.length ? Math.max(...nums) : 0;
  return values.map((v) => (v === null ? null : max > 0 ? v / max : 0));
}

/**
 * performanceScore = clickRate*w1 + signupRate*w2 + activationRate*w3 + returnRate*w4
 * 각 비율은 워크스페이스 내 최대값으로 정규화(0~1). 노출 데이터가 없으므로 clickRate는 클릭/랜딩 방문 기준 근사치가 아닌
 * "클릭 수 자체"를 정규화해 사용한다(플랫폼 노출 미제공 → N/A). 표본이 부족하면 score=null, needsData=true.
 */
export function scoreContents(contents: ContentMetrics[], weights = DEFAULT_WEIGHTS): Scored[] {
  const clickRate = contents.map((c) => (c.impressions ? rate(c.clicks, c.impressions) : c.clicks));
  const signupRate = contents.map((c) => rate(c.signups, c.landingVisits));
  const activationRate = contents.map((c) => rate(c.activations, Math.max(c.signups, c.landingVisits)));
  const returnRate = contents.map((c) => rate(c.returnVisits, c.landingVisits));
  const n = { c: normalize(clickRate), s: normalize(signupRate), a: normalize(activationRate), r: normalize(returnRate) };
  return contents.map((c, i) => {
    const needsData = c.clicks < MIN_CLICKS_FOR_SCORE;
    const parts = [n.c[i], n.s[i], n.a[i], n.r[i]].map((v) => v ?? 0);
    const score = needsData ? null : Math.round((parts[0] * weights.click + parts[1] * weights.signup + parts[2] * weights.activation + parts[3] * weights.return) * 1000) / 1000;
    return { ...c, clickRate: clickRate[i], signupRate: signupRate[i], activationRate: activationRate[i], returnRate: returnRate[i], score, needsData };
  });
}
