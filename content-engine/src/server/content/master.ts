import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { contentMasterBodySchema, type ContentMasterBody, type Fact, type SourceRef } from "@/lib/schemas/content";
import { getAIProvider } from "@/server/providers/ai";
import { resolvePrompt } from "./prompt-registry";
import { loadBrandContext } from "./brand-context";
import { computeDividendTarget, CALC_CAUTIONS } from "./dividend-calculator";
import { validateMaster } from "./validators";
import { audit } from "@/server/security/audit";

/**
 * 소재 → Content Master. CALCULATION 소재는 결정론적 계산기가 facts를 만들고 AI는 문장만 만든다.
 */
export async function generateMasterFromTopic(workspaceId: string, topicId: string, userId?: string) {
  const topic = await prisma.contentTopic.findFirst({ where: { id: topicId, workspaceId, deletedAt: null }, include: { sources_: true, product: true } });
  if (!topic) throw new Error("소재를 찾을 수 없습니다");
  const brand = await loadBrandContext(workspaceId, topic.productId);
  const asOfDate = new Date().toISOString().slice(0, 10);

  let facts: Fact[] = [];
  let cautions: string[] = [];
  const calcSource = topic.sources_.find((s) => s.type === "CALCULATION");
  if (calcSource) {
    const p = calcSource.payload as { monthlyTarget: number; yields: number[] };
    facts = computeDividendTarget(p.monthlyTarget, p.yields).facts;
    cautions = CALC_CAUTIONS;
  }
  const topicSources = (Array.isArray(topic.sources) ? topic.sources : []) as SourceRef[];
  const cta = brand.ctas[0] ?? { label: "자세히 보기", url: topic.product.url, strength: "low" as const };

  const prompt = await resolvePrompt("master.generate", workspaceId);
  const res = await getAIProvider().generateStructured({
    promptKey: prompt.key,
    promptVersion: prompt.version,
    system: prompt.system,
    user: prompt.user,
    schema: contentMasterBodySchema,
    schemaName: prompt.schemaName,
    context: {
      topic: { title: topic.title, coreQuestion: topic.coreQuestion, category: topic.category, sourceType: topic.sources_[0]?.type, evidence: topic.evidence, sources: topicSources },
      product: { name: topic.product.name, url: topic.product.url, description: topic.product.description },
      brand,
      asOfDate,
      facts,
      cautions,
      cta,
    },
  });

  // 계산 facts는 AI 응답과 무관하게 계산기 결과를 강제한다 (숫자 변조 방지)
  const body: ContentMasterBody = { ...res.data, asOfDate, facts: facts.length ? facts : res.data.facts, cautions: cautions.length ? cautions : res.data.cautions };
  if (!body.sources.length && topicSources.length) body.sources = topicSources;
  const validation = validateMaster(body, brand.forbiddenPhrases);
  const status = validation.blocked ? (validation.issues.some((i) => i.code === "NEEDS_SOURCE") ? "NEEDS_SOURCE" : "NEEDS_REVIEW") : "DRAFT";

  const master = await prisma.contentMaster.create({
    data: {
      workspaceId,
      productId: topic.productId,
      topicId: topic.id,
      title: body.title,
      summary: body.summary,
      asOfDate: new Date(body.asOfDate),
      facts: body.facts as unknown as Prisma.InputJsonValue,
      sources: body.sources as unknown as Prisma.InputJsonValue,
      cautions: body.cautions,
      cta: body.cta as unknown as Prisma.InputJsonValue,
      validation: { ...validation, keyMessages: body.keyMessages, promptVersion: prompt.version, provider: res.provider, model: res.model } as unknown as Prisma.InputJsonValue,
      status,
    },
  });
  await prisma.contentTopic.update({ where: { id: topic.id }, data: { status: "IN_PROGRESS" } });
  await audit({ workspaceId, userId, action: "master.create", entityType: "ContentMaster", entityId: master.id, meta: { topicId, status } });
  return master;
}

/** DB 레코드 → ContentMasterBody */
export function masterToBody(m: { title: string; summary: string; asOfDate: Date; facts: unknown; sources: unknown; cautions: string[]; cta: unknown; validation: unknown }): ContentMasterBody {
  const v = (m.validation ?? {}) as { keyMessages?: string[] };
  return contentMasterBodySchema.parse({
    title: m.title,
    summary: m.summary,
    asOfDate: m.asOfDate.toISOString().slice(0, 10),
    facts: m.facts ?? [],
    sources: m.sources ?? [],
    cautions: m.cautions ?? [],
    cta: m.cta ?? null,
    keyMessages: v.keyMessages ?? [],
  });
}

/** 사용자가 Master를 수정하면 재검증하고 저장 */
export async function updateMasterBody(workspaceId: string, masterId: string, body: ContentMasterBody, userId?: string) {
  const existing = await prisma.contentMaster.findFirst({ where: { id: masterId, workspaceId, deletedAt: null } });
  if (!existing) throw new Error("Content Master를 찾을 수 없습니다");
  const brand = await loadBrandContext(workspaceId, existing.productId);
  const validation = validateMaster(body, brand.forbiddenPhrases);
  const prevValidation = (existing.validation ?? {}) as Record<string, unknown>;
  const status = validation.blocked ? (validation.issues.some((i) => i.code === "NEEDS_SOURCE") ? "NEEDS_SOURCE" : "NEEDS_REVIEW") : existing.status === "NEEDS_SOURCE" || existing.status === "NEEDS_REVIEW" ? "DRAFT" : existing.status;
  const updated = await prisma.contentMaster.update({
    where: { id: masterId },
    data: {
      title: body.title,
      summary: body.summary,
      asOfDate: new Date(body.asOfDate),
      facts: body.facts as unknown as Prisma.InputJsonValue,
      sources: body.sources as unknown as Prisma.InputJsonValue,
      cautions: body.cautions,
      cta: body.cta as unknown as Prisma.InputJsonValue,
      validation: { ...prevValidation, ...validation, keyMessages: body.keyMessages } as unknown as Prisma.InputJsonValue,
      status,
    },
  });
  await audit({ workspaceId, userId, action: "master.update", entityType: "ContentMaster", entityId: masterId, meta: { status } });
  return updated;
}
