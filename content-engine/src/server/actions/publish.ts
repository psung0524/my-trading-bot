"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { requireWorkspaceMember } from "@/server/tenancy/context";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { approveContent, rejectContent, reopenContent, reschedule, revokeApproval } from "@/server/publish/approval";
import { createPublishJob, processDuePublishJobs } from "@/server/publish/publish";

const approveSchema = z.object({ scheduledAt: z.string().datetime().optional().nullable(), note: z.string().max(500).optional(), channelAccountId: z.string().optional().nullable(), publishNow: z.boolean().optional() });

function refresh(slug: string) {
  revalidatePath(`/w/${slug}`, "layout");
}

export async function approveAction(slug: string, channelContentId: string, input: unknown = {}): Promise<ActionResult<{ status: string }>> {
  const ctx = await requireWorkspaceMember(slug, "approveContent");
  const parsed = approveSchema.safeParse(input ?? {});
  if (!parsed.success) return fail("입력값을 확인하세요");
  try {
    const scheduledAt = parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null;
    const cc = await approveContent(ctx.workspace.id, channelContentId, ctx.user.id, { scheduledAt, note: parsed.data.note, channelAccountId: parsed.data.channelAccountId });
    let status = cc.status as string;
    if (parsed.data.publishNow && !scheduledAt) {
      await createPublishJob(ctx.workspace.id, channelContentId, { channelAccountId: parsed.data.channelAccountId, userId: ctx.user.id });
      status = (await prisma.channelContent.findUnique({ where: { id: channelContentId } }))?.status ?? status;
    }
    refresh(slug);
    return ok({ status });
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function rejectAction(slug: string, channelContentId: string, note = ""): Promise<ActionResult<undefined>> {
  const ctx = await requireWorkspaceMember(slug, "approveContent");
  try {
    await rejectContent(ctx.workspace.id, channelContentId, ctx.user.id, note.slice(0, 500));
    refresh(slug);
    return ok(undefined);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function revokeAction(slug: string, channelContentId: string): Promise<ActionResult<undefined>> {
  const ctx = await requireWorkspaceMember(slug, "approveContent");
  try {
    await revokeApproval(ctx.workspace.id, channelContentId, ctx.user.id);
    refresh(slug);
    return ok(undefined);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function reopenAction(slug: string, channelContentId: string): Promise<ActionResult<undefined>> {
  const ctx = await requireWorkspaceMember(slug, "editContent");
  try {
    await reopenContent(ctx.workspace.id, channelContentId, ctx.user.id);
    refresh(slug);
    return ok(undefined);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function publishNowAction(slug: string, channelContentId: string, channelAccountId?: string | null): Promise<ActionResult<{ status: string; externalUrl: string | null }>> {
  const ctx = await requireWorkspaceMember(slug, "publishContent");
  try {
    const cc = await prisma.channelContent.findFirst({ where: { id: channelContentId, workspaceId: ctx.workspace.id, deletedAt: null } });
    if (!cc) return fail("채널 콘텐츠를 찾을 수 없습니다");
    if (cc.status !== "APPROVED" && cc.status !== "SCHEDULED" && cc.status !== "FAILED") return fail(`승인된 콘텐츠만 게시할 수 있습니다 (현재: ${cc.status})`);
    if (cc.status === "FAILED") await prisma.channelContent.update({ where: { id: cc.id }, data: { status: "APPROVED" } });
    const job = await createPublishJob(ctx.workspace.id, cc.id, { channelAccountId, userId: ctx.user.id });
    const after = await prisma.channelContent.findUnique({ where: { id: cc.id } });
    const pj = await prisma.publishJob.findUnique({ where: { id: job.id } });
    refresh(slug);
    if (pj?.status === "FAILED") return fail(`게시 실패: ${pj.lastError ?? "알 수 없는 오류"}`);
    return ok({ status: after?.status ?? cc.status, externalUrl: after?.externalUrl ?? null });
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function rescheduleAction(slug: string, channelContentId: string, scheduledAtIso: string, channelAccountId?: string | null): Promise<ActionResult<undefined>> {
  const ctx = await requireWorkspaceMember(slug, "publishContent");
  const d = new Date(scheduledAtIso);
  if (Number.isNaN(d.getTime())) return fail("예약 시각이 올바르지 않습니다");
  try {
    await reschedule(ctx.workspace.id, channelContentId, ctx.user.id, d, channelAccountId);
    refresh(slug);
    return ok(undefined);
  } catch (e) {
    return fail((e as Error).message);
  }
}

/** 예약 시각이 지난 게시 Job을 지금 처리 (워커가 없을 때) */
export async function runDuePublishAction(slug: string): Promise<ActionResult<{ processed: number }>> {
  await requireWorkspaceMember(slug, "publishContent");
  const processed = await processDuePublishJobs();
  refresh(slug);
  return ok({ processed });
}
