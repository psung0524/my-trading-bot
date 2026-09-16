import type { ContentCategory, Prisma, SourceType } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { calculationParamsSchema, type CreateTopicInput, type TopicCandidate } from "@/lib/schemas/content";
import { formatKrw, formatPercent } from "@/lib/format/number-ko";
import { analyzeMix, similarity } from "./content-mix";
import { getTopicSourceProvider } from "@/server/providers/topics";
import { productAnalysisSchema } from "@/lib/schemas/product";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function parseYields(s: string): number[] {
  const nums = s.split(/[,\s]+/).map((x) => Number(x.replace("%", ""))).filter((n) => Number.isFinite(n) && n > 0);
  const ratios = nums.map((n) => (n > 1 ? n / 100 : n));
  return calculationParamsSchema.shape.yields.parse(ratios.length ? ratios : [0.03, 0.04, 0.05]);
}

/** 입력 유형별로 ContentTopic + ContentSource를 만든다 */
export function topicFromInput(input: CreateTopicInput): { candidate: TopicCandidate; sourceType: SourceType; payload: Prisma.InputJsonValue } {
  switch (input.sourceType) {
    case "MANUAL_INPUT":
      return {
        sourceType: "MANUAL_INPUT",
        payload: { notes: input.notes },
        candidate: { title: input.title, coreQuestion: input.coreQuestion, targetAudience: "", purpose: "", category: input.category, expectedChannels: ["THREADS", "INSTAGRAM", "BLOG", "YOUTUBE_SHORTS"], riskLevel: "LOW", expectedTypes: [], evidence: input.notes ? { notes: input.notes } : {}, sources: [] },
      };
    case "USER_QUESTION":
      return {
        sourceType: "USER_QUESTION",
        payload: { question: input.question, context: input.context },
        candidate: { title: input.question.replace(/\?$/, ""), coreQuestion: input.question, targetAudience: "같은 질문을 가진 사용자", purpose: "질문에 답하며 기준을 제시", category: "INFORMATIONAL", expectedChannels: ["THREADS", "BLOG"], riskLevel: "LOW", expectedTypes: ["설명형"], evidence: input.context ? { context: input.context } : {}, sources: [] },
      };
    case "CALCULATION": {
      const yields = parseYields(input.yields);
      const monthly = input.monthlyTarget;
      return {
        sourceType: "CALCULATION",
        payload: { monthlyTarget: monthly, yields },
        candidate: {
          title: `월 ${formatKrw(monthly)}의 배당금을 받기 위해 필요한 투자금`,
          coreQuestion: `월 ${formatKrw(monthly)} 배당을 받으려면 배당수익률별로 얼마가 필요할까?`,
          targetAudience: "목표 배당금을 정한 투자자",
          purpose: "계산 정보 제공",
          category: "DATA",
          expectedChannels: ["THREADS", "INSTAGRAM", "BLOG", "YOUTUBE_SHORTS"],
          riskLevel: "LOW",
          expectedTypes: ["숫자 강조형", "비교표형"],
          evidence: { monthlyTarget: monthly, yields: yields.map(formatPercent) },
          sources: [{ name: "서비스 내부 계산기(단순 계산)", url: "", retrievedAt: today(), note: "requiredPrincipal = monthlyTarget × 12 ÷ dividendYield" }],
        },
      };
    }
    case "FEATURE_UPDATE":
      return {
        sourceType: "FEATURE_UPDATE",
        payload: { featureName: input.featureName, summary: input.summary, url: input.url },
        candidate: { title: `새 기능: ${input.featureName}`, coreQuestion: `${input.featureName}로 무엇이 편해질까?`, targetAudience: "기존 사용자와 잠재 사용자", purpose: "기능 안내", category: "BRANDING", expectedChannels: ["THREADS", "INSTAGRAM"], riskLevel: "LOW", expectedTypes: ["단계 설명형"], evidence: { summary: input.summary, url: input.url }, sources: input.url ? [{ name: input.featureName, url: input.url, retrievedAt: today(), note: "기능 안내 페이지" }] : [] },
      };
  }
}

export async function createTopic(workspaceId: string, productId: string, input: CreateTopicInput) {
  const { candidate, sourceType, payload } = topicFromInput(input);
  return createTopicFromCandidate(workspaceId, productId, candidate, sourceType, payload);
}

export async function createTopicFromCandidate(workspaceId: string, productId: string, c: TopicCandidate, sourceType: SourceType, payload: Prisma.InputJsonValue = {}) {
  const existing = await prisma.contentTopic.findMany({ where: { workspaceId, deletedAt: null }, select: { id: true, title: true } });
  let duplicateScore = 0;
  const similar: string[] = [];
  for (const e of existing) {
    const s = similarity(c.title, e.title);
    if (s > duplicateScore) duplicateScore = s;
    if (s >= 0.5) similar.push(e.id);
  }
  return prisma.contentTopic.create({
    data: {
      workspaceId,
      productId,
      title: c.title,
      coreQuestion: c.coreQuestion,
      targetAudience: c.targetAudience,
      purpose: c.purpose,
      category: c.category as ContentCategory,
      expectedChannels: c.expectedChannels,
      evidence: c.evidence as Prisma.InputJsonValue,
      asOfDate: new Date(),
      sources: c.sources,
      riskLevel: c.riskLevel,
      duplicateScore: Math.round(duplicateScore * 100) / 100,
      similarContentIds: similar,
      expectedTypes: c.expectedTypes,
      sources_: { create: { type: sourceType, payload } },
    },
  });
}

/** Provider(Mock)로 소재 후보를 발견해 CANDIDATE로 저장 */
export async function discoverTopics(workspaceId: string, productId: string, sourceType: SourceType) {
  const product = await prisma.product.findFirst({ where: { id: productId, workspaceId, deletedAt: null } });
  if (!product) throw new Error("제품을 찾을 수 없습니다");
  const analysis = productAnalysisSchema.safeParse(product.analysis);
  const existing = await prisma.contentTopic.findMany({ where: { workspaceId, deletedAt: null }, select: { title: true } });
  const provider = getTopicSourceProvider(sourceType);
  const candidates = await provider.discover({
    workspaceId,
    product: { name: product.name, url: product.url, description: product.description, features: analysis.success ? analysis.data.features : [] },
    existingTitles: existing.map((e) => e.title),
  });
  const created = [];
  for (const c of candidates) created.push(await createTopicFromCandidate(workspaceId, productId, c, sourceType, { discovered: true }));
  return created;
}

/** 최근 콘텐츠 비율 리포트 */
export async function getMixReport(workspaceId: string) {
  const recent = await prisma.contentTopic.findMany({
    where: { workspaceId, deletedAt: null, status: { in: ["SELECTED", "IN_PROGRESS", "DONE"] } },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: { category: true },
  });
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { settings: true } });
  const reduce = (((ws?.settings as { reduceCategories?: string[] } | null)?.reduceCategories) ?? []) as ContentCategory[];
  return analyzeMix(recent.map((r) => r.category), reduce);
}
