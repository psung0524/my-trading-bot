import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { enqueueJob } from "@/server/jobs/runner";
import { audit } from "@/server/security/audit";

export type RenderKind = "CARDNEWS" | "SHORTS" | "BLOG_THUMBNAIL";

const JOB_TYPE: Record<RenderKind, string> = { CARDNEWS: "render.cardnews", SHORTS: "render.shorts", BLOG_THUMBNAIL: "render.thumbnail" };

/**
 * RenderJob 생성 + Job 큐 등록. 같은 콘텐츠·버전에 진행 중인 렌더가 있으면 중복 생성하지 않는다.
 */
export async function requestRender(workspaceId: string, channelContentId: string, kind: RenderKind, userId?: string) {
  const cc = await prisma.channelContent.findFirst({ where: { id: channelContentId, workspaceId, deletedAt: null } });
  if (!cc) throw new Error("채널 콘텐츠를 찾을 수 없습니다");
  const idempotencyKey = `render:${kind}:${cc.id}:v${cc.currentVersion}`;
  const existing = await prisma.renderJob.findUnique({ where: { idempotencyKey } });
  if (existing && (existing.status === "QUEUED" || existing.status === "PROCESSING")) return { renderJobId: existing.id, deduplicated: true };
  const job = existing
    ? await prisma.renderJob.update({ where: { id: existing.id }, data: { status: "QUEUED", attempts: 0, progress: 0, step: "대기", lastError: null, logs: [], startedAt: null, finishedAt: null } })
    : await prisma.renderJob.create({ data: { workspaceId, channelContentId: cc.id, kind, idempotencyKey, step: "대기" } });
  await audit({ workspaceId, userId, action: "render.request", entityType: "RenderJob", entityId: job.id, meta: { kind, channelContentId } });
  await enqueueJob({ type: JOB_TYPE[kind], workspaceId, payload: { renderJobId: job.id, workspaceId }, idempotencyKey: `${idempotencyKey}:${job.attempts}:${Date.now()}` });
  return { renderJobId: job.id, deduplicated: false };
}

export async function retryRender(workspaceId: string, renderJobId: string, userId?: string) {
  const job = await prisma.renderJob.findFirst({ where: { id: renderJobId, workspaceId } });
  if (!job) throw new Error("렌더 작업을 찾을 수 없습니다");
  if (job.status === "PROCESSING" || job.status === "QUEUED") throw new Error("이미 진행 중입니다");
  return requestRender(workspaceId, job.channelContentId, job.kind as RenderKind, userId);
}

export async function markRender(renderJobId: string, data: Prisma.RenderJobUpdateInput) {
  await prisma.renderJob.update({ where: { id: renderJobId }, data });
}
