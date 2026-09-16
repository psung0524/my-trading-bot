import type { ContentCategory } from "@prisma/client";

/** 기본 콘텐츠 비율 (요구사항 §6) */
export const TARGET_MIX: Record<ContentCategory, number> = {
  INFORMATIONAL: 0.4,
  DATA: 0.25,
  ENGAGEMENT: 0.15,
  BRANDING: 0.1,
  PROMOTION: 0.1,
};

export const CATEGORY_LABELS: Record<ContentCategory, string> = {
  INFORMATIONAL: "정보형",
  DATA: "데이터형",
  ENGAGEMENT: "참여형",
  BRANDING: "브랜딩·제작 과정",
  PROMOTION: "직접 홍보",
};

export type MixReport = {
  counts: Record<ContentCategory, number>;
  ratios: Record<ContentCategory, number>;
  target: Record<ContentCategory, number>;
  /** 목표 대비 가장 부족한 순서 */
  recommendedOrder: ContentCategory[];
  warning: string | null;
};

export function analyzeMix(recentCategories: ContentCategory[], reduceCategories: ContentCategory[] = []): MixReport {
  const cats = Object.keys(TARGET_MIX) as ContentCategory[];
  const counts = Object.fromEntries(cats.map((c) => [c, 0])) as Record<ContentCategory, number>;
  for (const c of recentCategories) counts[c] = (counts[c] ?? 0) + 1;
  const total = recentCategories.length;
  const ratios = Object.fromEntries(cats.map((c) => [c, total ? counts[c] / total : 0])) as Record<ContentCategory, number>;
  const deficit = cats.map((c) => ({ c, d: TARGET_MIX[c] - ratios[c] })).sort((a, b) => b.d - a.d);
  let recommendedOrder = deficit.map((x) => x.c);
  let warning: string | null = null;
  if (total >= 3 && ratios.PROMOTION > TARGET_MIX.PROMOTION * 1.5) {
    warning = `최근 콘텐츠의 ${Math.round(ratios.PROMOTION * 100)}%가 직접 홍보입니다. 다음 소재는 정보형이나 참여형을 우선하세요.`;
    recommendedOrder = ["INFORMATIONAL", "ENGAGEMENT", ...recommendedOrder.filter((c) => c !== "INFORMATIONAL" && c !== "ENGAGEMENT")];
  }
  if (reduceCategories.length) {
    const reduce = new Set(reduceCategories);
    recommendedOrder = [...recommendedOrder.filter((c) => !reduce.has(c)), ...recommendedOrder.filter((c) => reduce.has(c))];
  }
  return { counts, ratios, target: TARGET_MIX, recommendedOrder, warning };
}

/** 간단한 토큰 Jaccard 유사도 (중복도) */
export function similarity(a: string, b: string): number {
  const tok = (s: string) => new Set(s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((t) => t.length > 1));
  const A = tok(a);
  const B = tok(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}
