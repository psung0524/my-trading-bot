import { describe, expect, it } from "vitest";
import { z } from "zod";
import { estimateUsd } from "@/server/providers/ai/usage";
import { MockAIProvider } from "@/server/providers/ai/mock";
import { contentMasterBodySchema, threadsBodySchema } from "@/lib/schemas/content";
import { computeDividendTarget, CALC_CAUTIONS } from "@/server/content/dividend-calculator";

describe("AI 비용 추정", () => {
  it("Sonnet 5 기본 단가", () => {
    expect(estimateUsd("claude-sonnet-5", 1_000_000, 0)).toBeCloseTo(2);
    expect(estimateUsd("claude-sonnet-5", 0, 1_000_000)).toBeCloseTo(10);
  });
  it("캐시 읽기 0.1배, 쓰기 1.25배, 배치 0.5배", () => {
    expect(estimateUsd("claude-sonnet-5", 0, 0, { cacheReadTokens: 1_000_000 })).toBeCloseTo(0.2);
    expect(estimateUsd("claude-sonnet-5", 0, 0, { cacheWriteTokens: 1_000_000 })).toBeCloseTo(2.5);
    expect(estimateUsd("claude-sonnet-5", 1_000_000, 1_000_000, { batch: true })).toBeCloseTo(6);
  });
  it("모르는 모델은 0", () => {
    expect(estimateUsd("unknown-model", 1000, 1000)).toBe(0);
  });
});

describe("Mock 배치", () => {
  it("제출 즉시 끝나고 customId로 결과를 돌려준다", async () => {
    const ai = new MockAIProvider();
    const calc = computeDividendTarget(500000, [0.03, 0.04, 0.05]);
    const brand = { brandName: "배당 계산기", ctas: [{ label: "계산하기", url: "https://example.com/calc", strength: "low" }] };
    const master = (await ai.generateStructured({ promptKey: "master.generate", promptVersion: 1, system: "", user: "", schema: contentMasterBodySchema, schemaName: "ContentMaster", context: { topic: { title: "월 50만 원 배당" }, facts: calc.facts, cautions: CALC_CAUTIONS, asOfDate: "2026-09-16", brand } })).data;
    const schema = z.object({ posts: z.array(threadsBodySchema).min(1).max(3) });
    const { batchId } = await ai.submitBatch([{ customId: "THREADS", input: { promptKey: "threads.generate", promptVersion: 1, system: "", user: "", schema, schemaName: "ThreadsPosts", context: { master, brand, options: {} } } }]);
    const status = await ai.fetchBatch(batchId);
    expect(status.ended).toBe(true);
    const r = status.results?.find((x) => x.customId === "THREADS");
    expect(r?.ok).toBe(true);
    if (r?.ok) {
      expect(r.usage?.batch).toBe(true);
      const parsed = schema.parse(r.raw);
      expect(parsed.posts.length).toBe(3);
      expect(parsed.posts[0].replyText).toContain("https://example.com/calc");
    }
  });
});
