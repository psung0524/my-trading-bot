import { describe, expect, it } from "vitest";
import { scoreContents, parseWeights, DEFAULT_WEIGHTS } from "@/server/analytics/score";
import { buildRecommendations } from "@/server/analytics/recommendations";
import type { ContentMetrics } from "@/server/analytics/performance";

function c(over: Partial<ContentMetrics>): ContentMetrics {
  return { impressions: null, clicks: 0, landingVisits: 0, signups: 0, signupStarted: 0, activations: 0, returnVisits: 0, paidConversions: 0, channelContentId: "cc", channel: "THREADS", title: "t", masterId: "m", masterTitle: "M", topicId: "topic", topicTitle: "T", category: "DATA", ctaLabel: "계산하기", status: "PUBLISHED", publishedAt: new Date(Date.now() - 20 * 86400_000).toISOString(), ...over };
}

describe("score", () => {
  it("가중치 정규화", () => {
    expect(parseWeights(null)).toEqual(DEFAULT_WEIGHTS);
    const w = parseWeights({ scoreWeights: { click: 1, signup: 1, activation: 1, return: 1 } });
    expect(w.click).toBeCloseTo(0.25);
  });
  it("표본 부족은 needsData, 상위 콘텐츠는 점수 1에 가까움", () => {
    const s = scoreContents([
      c({ channelContentId: "a", clicks: 20, landingVisits: 20, signups: 4, activations: 4, returnVisits: 2 }),
      c({ channelContentId: "b", clicks: 10, landingVisits: 10, signups: 1, activations: 0, returnVisits: 0 }),
      c({ channelContentId: "z", clicks: 2 }),
    ]);
    const a = s.find((x) => x.channelContentId === "a")!;
    const z = s.find((x) => x.channelContentId === "z")!;
    expect(a.score).toBe(1);
    expect(a.needsData).toBe(false);
    expect(z.score).toBeNull();
    expect(z.needsData).toBe(true);
  });
});

describe("recommendations", () => {
  it("확대/재활용/중단/데이터부족 규칙", () => {
    const scored = scoreContents([
      c({ channelContentId: "good", topicId: "t1", topicTitle: "좋은 소재", clicks: 30, landingVisits: 30, signups: 6, activations: 5, returnVisits: 3 }),
      c({ channelContentId: "bad", topicId: "t2", topicTitle: "나쁜 소재", clicks: 40, landingVisits: 40, signups: 0, activations: 0, returnVisits: 0 }),
      c({ channelContentId: "new", topicId: "t3", clicks: 1, publishedAt: new Date(Date.now() - 10 * 86400_000).toISOString() }),
    ]);
    const recs = buildRecommendations(scored, [{ key: "THREADS", clicks: 71, signups: 6, landingVisits: 71 }], [{ key: "DATA", contents: 3, clicks: 71, signups: 6, landingVisits: 71 }], [{ key: "계산하기", clicks: 71, signups: 6, landingVisits: 71 }]);
    const kinds = recs.map((r) => r.kind);
    expect(kinds).toContain("EXPAND_TOPIC");
    expect(kinds).toContain("REUSE");
    expect(kinds).toContain("STOP_CAMPAIGN");
    expect(kinds).toContain("NEED_DATA");
    expect(kinds).toContain("GOOD_CTA");
    expect(kinds).toContain("GOOD_CHANNEL");
    expect(recs.find((r) => r.kind === "EXPAND_TOPIC")?.title).toContain("좋은 소재");
    expect(recs.find((r) => r.kind === "STOP_CAMPAIGN")?.reason).toContain("가입·핵심 기능 사용이 0");
    for (const r of recs) expect(r.reason.length).toBeGreaterThan(10);
  });
  it("홍보 편중 + 낮은 전환이면 REDUCE_TYPE", () => {
    const recs = buildRecommendations([], [], [{ key: "PROMOTION", contents: 5, clicks: 50, signups: 0, landingVisits: 50 }, { key: "INFORMATIONAL", contents: 2, clicks: 5, signups: 1, landingVisits: 5 }], []);
    expect(recs.some((r) => r.kind === "REDUCE_TYPE" && r.title.includes("직접 홍보"))).toBe(true);
  });
});
