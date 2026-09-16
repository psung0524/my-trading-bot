"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ChannelType } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { requireWorkspaceMember } from "@/server/tenancy/context";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import type { ValidationResult } from "@/lib/schemas/content";
import { saveUserEdit, archiveContent } from "@/server/content/edit";
import { generateBlog, generateInstagram, generateShorts, generateThreads } from "@/server/content/channels/generate";
import { requestRender, retryRender, type RenderKind } from "@/server/render/render-jobs";

export async function saveContentAction(slug: string, channelContentId: string, body: unknown, changeSummary?: string): Promise<ActionResult<{ status: string; version: number; validation: ValidationResult }>> {
  const ctx = await requireWorkspaceMember(slug, "editContent");
  try {
    const { content, validation } = await saveUserEdit(ctx.workspace.id, channelContentId, body, ctx.user.id, changeSummary);
    revalidatePath(`/w/${slug}/content/${content.masterId}/${channelContentId}`);
    return ok({ status: content.status, version: content.currentVersion, validation });
  } catch (e) {
    return fail(e instanceof z.ZodError ? `입력 형식 오류: ${e.issues[0]?.path.join(".")} ${e.issues[0]?.message}` : (e as Error).message);
  }
}

const regenSchema = z.object({
  threads: z.object({ includeLink: z.boolean().optional(), ctaStrength: z.enum(["none", "low", "medium", "high"]).optional(), lessAdLike: z.boolean().optional() }).optional(),
  instagram: z.object({ template: z.enum(["magazine", "number-focus", "comparison", "checklist", "steps", "schedule"]).optional() }).optional(),
  shorts: z.object({ durationSec: z.union([z.literal(30), z.literal(45), z.literal(60)]).optional() }).optional(),
  blog: z.object({ targetLength: z.union([z.literal(1500), z.literal(2500), z.literal(4000)]).optional() }).optional(),
});

/** 채널 콘텐츠 하나만 재생성 (같은 레코드에 새 버전으로 저장) */
export async function regenerateContentAction(slug: string, channelContentId: string, input: unknown = {}): Promise<ActionResult<{ version: number }>> {
  const ctx = await requireWorkspaceMember(slug, "generateContent");
  const parsed = regenSchema.safeParse(input ?? {});
  if (!parsed.success) return fail("옵션이 잘못되었습니다");
  const cc = await prisma.channelContent.findFirst({ where: { id: channelContentId, workspaceId: ctx.workspace.id, deletedAt: null } });
  if (!cc) return fail("채널 콘텐츠를 찾을 수 없습니다");
  if (cc.status === "PUBLISHED" || cc.status === "PUBLISHING") return fail("게시된 콘텐츠는 재생성할 수 없습니다");
  try {
    const opts = parsed.data;
    let version = cc.currentVersion + 1;
    if (cc.channel === "THREADS") {
      const res = await generateThreads(ctx.workspace.id, cc.masterId, opts.threads, ctx.user.id, { [cc.variant]: cc.id });
      // 다른 variant는 새로 생기지 않도록 정리: 재생성 대상이 아닌 새 레코드는 삭제
      for (const r of res) if (r.id !== cc.id) await prisma.channelContent.delete({ where: { id: r.id } });
      version = res.find((r) => r.id === cc.id)?.currentVersion ?? version;
    } else if (cc.channel === "INSTAGRAM") version = (await generateInstagram(ctx.workspace.id, cc.masterId, opts.instagram, ctx.user.id, cc.id)).currentVersion;
    else if (cc.channel === "BLOG") version = (await generateBlog(ctx.workspace.id, cc.masterId, ctx.user.id, cc.id, opts.blog)).currentVersion;
    else if (cc.channel === "YOUTUBE_SHORTS") version = (await generateShorts(ctx.workspace.id, cc.masterId, opts.shorts, ctx.user.id, cc.id)).currentVersion;
    revalidatePath(`/w/${slug}/content/${cc.masterId}/${cc.id}`);
    return ok({ version });
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function archiveContentAction(slug: string, channelContentId: string): Promise<ActionResult<undefined>> {
  const ctx = await requireWorkspaceMember(slug, "editContent");
  try {
    await archiveContent(ctx.workspace.id, channelContentId, ctx.user.id);
    revalidatePath(`/w/${slug}/content`, "layout");
    return ok(undefined);
  } catch (e) {
    return fail((e as Error).message);
  }
}

const kindByChannel: Partial<Record<ChannelType, RenderKind>> = { INSTAGRAM: "CARDNEWS", YOUTUBE_SHORTS: "SHORTS", BLOG: "BLOG_THUMBNAIL" };

export async function renderContentAction(slug: string, channelContentId: string): Promise<ActionResult<{ renderJobId: string }>> {
  const ctx = await requireWorkspaceMember(slug, "editContent");
  const cc = await prisma.channelContent.findFirst({ where: { id: channelContentId, workspaceId: ctx.workspace.id, deletedAt: null } });
  if (!cc) return fail("채널 콘텐츠를 찾을 수 없습니다");
  const kind = kindByChannel[cc.channel];
  if (!kind) return fail("이 채널은 렌더링이 필요 없습니다");
  try {
    const res = await requestRender(ctx.workspace.id, cc.id, kind, ctx.user.id);
    revalidatePath(`/w/${slug}/content/${cc.masterId}/${cc.id}`);
    revalidatePath(`/w/${slug}/renders`);
    return ok({ renderJobId: res.renderJobId });
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function retryRenderAction(slug: string, renderJobId: string): Promise<ActionResult<{ renderJobId: string }>> {
  const ctx = await requireWorkspaceMember(slug, "editContent");
  try {
    const res = await retryRender(ctx.workspace.id, renderJobId, ctx.user.id);
    revalidatePath(`/w/${slug}/renders`);
    return ok({ renderJobId: res.renderJobId });
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function getRenderStatusAction(slug: string, renderJobId: string): Promise<ActionResult<{ status: string; step: string; progress: number; lastError: string | null }>> {
  const ctx = await requireWorkspaceMember(slug, "viewContent");
  const job = await prisma.renderJob.findFirst({ where: { id: renderJobId, workspaceId: ctx.workspace.id } });
  if (!job) return fail("렌더 작업을 찾을 수 없습니다");
  return ok({ status: job.status, step: job.step, progress: job.progress, lastError: job.lastError });
}
