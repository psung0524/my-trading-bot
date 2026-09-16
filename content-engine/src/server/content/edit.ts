import type { ChannelType, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { channelBodySchemas } from "@/lib/schemas/content";
import { loadBrandContext } from "./brand-context";
import { masterToBody } from "./master";
import { validateChannelBody } from "./validators";
import { extractChannelTexts } from "./channel-text";
import { getAIProvider } from "@/server/providers/ai";
import { resolvePrompt } from "./prompt-registry";
import { audit } from "@/server/security/audit";

const learningSchema = z.object({ patterns: z.array(z.object({ pattern: z.string(), description: z.string() })).max(10) });

/**
 * 사용자 수정 저장: 새 ContentVersion(USER) + 재검증 + 상태 조정.
 * 승인된 콘텐츠를 수정하면 다시 NEEDS_REVIEW로 돌아간다(승인 당시 버전과 달라졌으므로).
 */
export async function saveUserEdit(workspaceId: string, channelContentId: string, rawBody: unknown, userId: string, changeSummary = "사용자 수정") {
  const cc = await prisma.channelContent.findFirst({ where: { id: channelContentId, workspaceId, deletedAt: null }, include: { master: true } });
  if (!cc) throw new Error("채널 콘텐츠를 찾을 수 없습니다");
  if (cc.status === "PUBLISHED" || cc.status === "PUBLISHING") throw new Error("게시된 콘텐츠는 수정할 수 없습니다. 새 버전으로 복제하세요");
  const schema = channelBodySchemas[cc.channel];
  const body = schema.parse(rawBody);
  const brand = await loadBrandContext(workspaceId, cc.master.productId);
  const masterBody = masterToBody(cc.master);
  const validation = validateChannelBody(cc.channel, body, masterBody, brand.forbiddenPhrases);
  const status = validation.blocked ? (validation.issues.some((i) => i.code === "NEEDS_SOURCE") ? "NEEDS_SOURCE" : "NEEDS_REVIEW") : "NEEDS_REVIEW";
  const nextVersion = cc.currentVersion + 1;
  const prevValidation = (cc.validation ?? {}) as Record<string, unknown>;
  const updated = await prisma.channelContent.update({
    where: { id: cc.id },
    data: {
      body: body as Prisma.InputJsonValue,
      status,
      currentVersion: nextVersion,
      validation: { ...prevValidation, ...validation } as unknown as Prisma.InputJsonValue,
      versions: { create: { version: nextVersion, body: body as Prisma.InputJsonValue, source: "USER", editedById: userId, changeSummary } },
    },
  });
  await audit({ workspaceId, userId, action: "content.edit", entityType: "ChannelContent", entityId: cc.id, meta: { version: nextVersion, status } });
  // 브랜드 학습: 직전 AI 버전과 비교
  try {
    await captureLearning(workspaceId, cc.id, cc.channel, cc.body, body);
  } catch (e) {
    console.warn("brand learning 실패", e);
  }
  return { content: updated, validation };
}

/** 원본(AI)과 수정본의 텍스트를 비교해 반복 가능한 패턴을 BrandLearning(PENDING)으로 저장 */
export async function captureLearning(workspaceId: string, channelContentId: string, channel: ChannelType, beforeBody: unknown, afterBody: unknown) {
  const before = extractChannelTexts(channel, beforeBody).map((t) => t.text).join("\n");
  const after = extractChannelTexts(channel, afterBody).map((t) => t.text).join("\n");
  if (before === after) return [];
  const prompt = await resolvePrompt("learning.analyze", workspaceId);
  const res = await getAIProvider().generateStructured({ promptKey: prompt.key, promptVersion: prompt.version, system: prompt.system, user: prompt.user, schema: learningSchema, schemaName: prompt.schemaName, context: { workspaceId, before, after, channel } });
  const created = [];
  for (const p of res.data.patterns) {
    const dup = await prisma.brandLearning.findFirst({ where: { workspaceId, pattern: p.pattern, status: { not: "DELETED" } } });
    if (dup) {
      await prisma.brandLearning.update({ where: { id: dup.id }, data: { evidence: { ...(dup.evidence as object), count: ((dup.evidence as { count?: number }).count ?? 1) + 1, lastChannelContentId: channelContentId } } });
      continue;
    }
    created.push(await prisma.brandLearning.create({ data: { workspaceId, channelContentId, channel, pattern: p.pattern, description: p.description, evidence: { count: 1, beforeSample: before.slice(0, 300), afterSample: after.slice(0, 300) } } }));
  }
  return created;
}

export async function archiveContent(workspaceId: string, channelContentId: string, userId: string) {
  const r = await prisma.channelContent.updateMany({ where: { id: channelContentId, workspaceId, deletedAt: null, status: { notIn: ["PUBLISHING"] } }, data: { status: "ARCHIVED" } });
  if (r.count === 0) throw new Error("보관할 수 없습니다");
  await audit({ workspaceId, userId, action: "content.archive", entityType: "ChannelContent", entityId: channelContentId });
}
