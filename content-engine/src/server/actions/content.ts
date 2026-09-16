"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ChannelType, SourceType } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { requireWorkspaceMember } from "@/server/tenancy/context";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { zodFieldErrors } from "@/lib/zod-errors";
import { contentMasterBodySchema, createTopicSchema } from "@/lib/schemas/content";
import { createTopic, discoverTopics } from "@/server/content/topics";
import { generateMasterFromTopic, updateMasterBody } from "@/server/content/master";
import { enqueueJob } from "@/server/jobs/runner";
import { DISCOVERABLE_SOURCE_TYPES } from "@/server/providers/topics";
import { audit } from "@/server/security/audit";
import type { GenerateOptions } from "@/server/content/channels/generate";

export async function createTopicAction(slug: string, productId: string, input: unknown): Promise<ActionResult<{ topicId: string }>> {
  const ctx = await requireWorkspaceMember(slug, "editContent");
  const parsed = createTopicSchema.safeParse(input);
  if (!parsed.success) return fail("입력값을 확인하세요", zodFieldErrors(parsed.error));
  const product = await prisma.product.findFirst({ where: { id: productId, workspaceId: ctx.workspace.id, deletedAt: null } });
  if (!product) return fail("제품을 찾을 수 없습니다");
  const topic = await createTopic(ctx.workspace.id, product.id, parsed.data);
  await audit({ workspaceId: ctx.workspace.id, userId: ctx.user.id, action: "topic.create", entityType: "ContentTopic", entityId: topic.id, meta: { sourceType: parsed.data.sourceType } });
  revalidatePath(`/w/${slug}/topics`);
  return ok({ topicId: topic.id });
}

export async function discoverTopicsAction(slug: string, productId: string, sourceType: string): Promise<ActionResult<{ count: number }>> {
  const ctx = await requireWorkspaceMember(slug, "editContent");
  if (!DISCOVERABLE_SOURCE_TYPES.includes(sourceType as SourceType)) return fail("지원하지 않는 소재 유형입니다");
  try {
    const created = await discoverTopics(ctx.workspace.id, productId, sourceType as SourceType);
    await audit({ workspaceId: ctx.workspace.id, userId: ctx.user.id, action: "topic.discover", entityType: "ContentTopic", meta: { sourceType, count: created.length } });
    revalidatePath(`/w/${slug}/topics`);
    return ok({ count: created.length });
  } catch (e) {
    return fail((e as Error).message);
  }
}

const topicStatusSchema = z.enum(["CANDIDATE", "SELECTED", "DISMISSED"]);
export async function setTopicStatusAction(slug: string, topicId: string, status: string): Promise<ActionResult<undefined>> {
  const ctx = await requireWorkspaceMember(slug, "editContent");
  const parsed = topicStatusSchema.safeParse(status);
  if (!parsed.success) return fail("잘못된 상태");
  const r = await prisma.contentTopic.updateMany({ where: { id: topicId, workspaceId: ctx.workspace.id, deletedAt: null }, data: { status: parsed.data } });
  if (r.count === 0) return fail("소재를 찾을 수 없습니다");
  revalidatePath(`/w/${slug}/topics`);
  return ok(undefined);
}

export async function generateMasterAction(slug: string, topicId: string): Promise<ActionResult<{ masterId: string; status: string }>> {
  const ctx = await requireWorkspaceMember(slug, "generateContent");
  try {
    const master = await generateMasterFromTopic(ctx.workspace.id, topicId, ctx.user.id);
    revalidatePath(`/w/${slug}/topics`);
    revalidatePath(`/w/${slug}/content`);
    return ok({ masterId: master.id, status: master.status });
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function updateMasterAction(slug: string, masterId: string, input: unknown): Promise<ActionResult<{ status: string }>> {
  const ctx = await requireWorkspaceMember(slug, "editContent");
  const parsed = contentMasterBodySchema.safeParse(input);
  if (!parsed.success) return fail("입력값을 확인하세요", zodFieldErrors(parsed.error));
  try {
    const m = await updateMasterBody(ctx.workspace.id, masterId, parsed.data, ctx.user.id);
    revalidatePath(`/w/${slug}/content/${masterId}`);
    return ok({ status: m.status });
  } catch (e) {
    return fail((e as Error).message);
  }
}

const generateSchema = z.object({
  channels: z.array(z.enum(["THREADS", "INSTAGRAM", "BLOG", "YOUTUBE_SHORTS"])).min(1),
  options: z
    .object({
      threads: z.object({ includeLink: z.boolean().optional(), ctaStrength: z.enum(["none", "low", "medium", "high"]).optional(), lessAdLike: z.boolean().optional() }).optional(),
      instagram: z.object({ template: z.enum(["magazine", "number-focus", "comparison", "checklist", "steps", "schedule"]).optional(), cardCount: z.number().int().min(5).max(8).optional() }).optional(),
      shorts: z.object({ durationSec: z.union([z.literal(30), z.literal(45), z.literal(60)]).optional() }).optional(),
    })
    .default({}),
});

export async function generateChannelsAction(slug: string, masterId: string, input: unknown): Promise<ActionResult<{ jobId: string; warnings: string[] }>> {
  const ctx = await requireWorkspaceMember(slug, "generateContent");
  const parsed = generateSchema.safeParse(input);
  if (!parsed.success) return fail("입력값을 확인하세요", zodFieldErrors(parsed.error));
  const master = await prisma.contentMaster.findFirst({ where: { id: masterId, workspaceId: ctx.workspace.id, deletedAt: null } });
  if (!master) return fail("Content Master를 찾을 수 없습니다");
  if (master.status === "NEEDS_SOURCE") return fail("출처가 없는 수치가 있습니다. Content Master를 먼저 보완하세요");
  if (master.status === "GENERATING") return fail("이미 생성 중입니다");
  const res = await enqueueJob({
    type: "content.generate",
    workspaceId: ctx.workspace.id,
    payload: { workspaceId: ctx.workspace.id, masterId, channels: parsed.data.channels as ChannelType[], options: parsed.data.options as GenerateOptions, userId: ctx.user.id },
    idempotencyKey: `content.generate:${masterId}:${Date.now()}`,
  });
  const job = await prisma.job.findUnique({ where: { id: res.jobId } });
  if (job?.status === "FAILED") return fail(`생성 실패: ${job.lastError ?? "알 수 없는 오류"}`);
  const warnings = ((job?.result as { _errors?: string[] } | null)?._errors ?? []).map(humanizeGenerateError);
  revalidatePath(`/w/${slug}/content/${masterId}`);
  return ok({ jobId: res.jobId, warnings });
}

function humanizeGenerateError(msg: string): string {
  if (/ReferencePost|does not exist|relation .* does not exist/i.test(msg)) return `${msg.split(":")[0]}: 데이터베이스가 최신이 아닙니다. 터미널에서 npm run db:migrate 를 실행한 뒤 다시 시도하세요`;
  return msg;
}
