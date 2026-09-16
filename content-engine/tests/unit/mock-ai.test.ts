import { describe, expect, it } from "vitest";
import { z } from "zod";
import { MockAIProvider } from "@/server/providers/ai/mock";
import { blogBodySchema, contentMasterBodySchema, instagramBodySchema, shortsBodySchema, threadsBodySchema } from "@/lib/schemas/content";
import { computeDividendTarget, CALC_CAUTIONS } from "@/server/content/dividend-calculator";
import { validateChannelBody, validateMaster } from "@/server/content/validators";
import { DEFAULT_FORBIDDEN_PHRASES } from "@/lib/brand/defaults";

const ai = new MockAIProvider();
const brand = { brandName: "배당 계산기", tone: "차분", financeDisclaimer: "면책", ctas: [{ label: "내 목표 배당금 계산하기", url: "https://example.com/calculator", strength: "low" }], forbiddenPhrases: DEFAULT_FORBIDDEN_PHRASES, colors: { primary: "#0F766E", secondary: "#F0FDFA", accent: "#F59E0B" } };

async function makeMaster() {
  const calc = computeDividendTarget(500000, [0.03, 0.04, 0.05]);
  const res = await ai.generateStructured({
    promptKey: "master.generate", promptVersion: 1, system: "", user: "", schema: contentMasterBodySchema, schemaName: "ContentMaster",
    context: { topic: { title: "월 50만 원의 배당금을 받기 위해 필요한 투자금", coreQuestion: "" }, facts: calc.facts, cautions: CALC_CAUTIONS, asOfDate: "2026-09-16", brand },
  });
  return res.data;
}

describe("Mock AI → validators 일관성", () => {
  it("master가 검증 통과", async () => {
    const m = await makeMaster();
    expect(validateMaster(m, DEFAULT_FORBIDDEN_PHRASES).blocked).toBe(false);
    expect(m.facts.find((f) => f.key === "principal1")?.display).toBe("2억 원");
  });
  it("Threads 3종이 Master 숫자만 사용", async () => {
    const m = await makeMaster();
    const res = await ai.generateStructured({ promptKey: "threads.generate", promptVersion: 1, system: "", user: "", schema: z.object({ posts: z.array(threadsBodySchema).length(3) }), schemaName: "x", context: { master: m, brand, options: {} } });
    for (const p of res.data.posts) {
      const v = validateChannelBody("THREADS", p, m, DEFAULT_FORBIDDEN_PHRASES);
      expect(v.blocked, JSON.stringify(v.issues)).toBe(false);
      expect(p.text.length).toBeLessThanOrEqual(500);
    }
    expect(res.data.posts.map((p) => p.variant)).toEqual(["INFO", "OBSERVATION", "ENGAGEMENT"]);
  });
  it("Instagram/Blog/Shorts도 검증 통과", async () => {
    const m = await makeMaster();
    const ig = await ai.generateStructured({ promptKey: "instagram.generate", promptVersion: 1, system: "", user: "", schema: instagramBodySchema, schemaName: "x", context: { master: m, brand, template: "number-focus" } });
    expect(ig.data.cards.length).toBeGreaterThanOrEqual(5);
    expect(ig.data.cards.length).toBeLessThanOrEqual(8);
    expect(validateChannelBody("INSTAGRAM", ig.data, m, DEFAULT_FORBIDDEN_PHRASES).blocked).toBe(false);
    const blog = await ai.generateStructured({ promptKey: "blog.generate", promptVersion: 1, system: "", user: "", schema: blogBodySchema, schemaName: "x", context: { master: m, brand, product: { name: "배당 계산기", url: "https://example.com" } } });
    expect(blog.data.titleCandidates.length).toBe(5);
    const bv = validateChannelBody("BLOG", blog.data, m, DEFAULT_FORBIDDEN_PHRASES);
    expect(bv.blocked, JSON.stringify(bv.issues)).toBe(false);
    const shorts = await ai.generateStructured({ promptKey: "shorts.generate", promptVersion: 1, system: "", user: "", schema: shortsBodySchema, schemaName: "x", context: { master: m, brand, durationSec: 45 } });
    expect(shorts.data.scenes.at(-1)?.endSec).toBe(45);
    const sv = validateChannelBody("YOUTUBE_SHORTS", shorts.data, m, DEFAULT_FORBIDDEN_PHRASES);
    expect(sv.blocked, JSON.stringify(sv.issues)).toBe(false);
  });
  it("계산이 아닌 소재는 숫자를 만들지 않고 NEEDS_SOURCE", async () => {
    const res = await ai.generateStructured({ promptKey: "master.generate", promptVersion: 1, system: "", user: "", schema: contentMasterBodySchema, schemaName: "x", context: { topic: { title: "배당락일 전에 사면 배당을 받을 수 있나요", coreQuestion: "배당락일 전에 사면?" }, facts: [], cautions: [], asOfDate: "2026-09-16", brand } });
    const v = validateMaster(res.data, DEFAULT_FORBIDDEN_PHRASES);
    expect(v.blocked).toBe(true);
    expect(v.issues.some((i) => i.code === "NEEDS_SOURCE")).toBe(true);
  });
});
