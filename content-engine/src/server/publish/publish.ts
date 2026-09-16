import { prisma } from "@/server/db/prisma";
import { enqueueJob } from "@/server/jobs/runner";
import { getJobQueue } from "@/server/providers/queue";
import { audit } from "@/server/security/audit";

/**
 * PublishJob 생성. 멱등키 = publish:{ccId}:v{version} → 같은 버전은 두 번 게시되지 않는다.
 * scheduledFor가 있으면 그 시각에 실행되도록 Job.runAt을 둔다.
 */
export async function createPublishJob(workspaceId: string, channelContentId: string, opts: { scheduledFor?: Date | null; channelAccountId?: string | null; userId?: string } = {}) {
  const cc = await prisma.channelContent.findFirst({ where: { id: channelContentId, workspaceId, deletedAt: null } });
  if (!cc) throw new Error("채널 콘텐츠를 찾을 수 없습니다");
  const idempotencyKey = `publish:${cc.id}:v${cc.currentVersion}`;
  const existing = await prisma.publishJob.findUnique({ where: { idempotencyKey } });
  if (existing && existing.status === "SUCCEEDED") throw new Error("이 버전은 이미 게시되었습니다");
  if (existing && (existing.status === "PROCESSING")) throw new Error("게시가 진행 중입니다");
  let account = null;
  if (opts.channelAccountId) account = await prisma.channelAccount.findFirst({ where: { id: opts.channelAccountId, workspaceId, channel: cc.channel, deletedAt: null } });
  if (!account) account = await prisma.channelAccount.findFirst({ where: { workspaceId, channel: cc.channel, deletedAt: null }, orderBy: { isMock: "asc" } });

  const job = existing
    ? await prisma.publishJob.update({ where: { id: existing.id }, data: { status: "QUEUED", scheduledFor: opts.scheduledFor ?? null, channelAccountId: account?.id ?? null, lastError: null, logs: [], startedAt: null, finishedAt: null } })
    : await prisma.publishJob.create({ data: { workspaceId, channelContentId: cc.id, channel: cc.channel, channelAccountId: account?.id ?? null, idempotencyKey, scheduledFor: opts.scheduledFor ?? null } });
  await audit({ workspaceId, userId: opts.userId, action: "publish.request", entityType: "PublishJob", entityId: job.id, meta: { scheduledFor: opts.scheduledFor?.toISOString() ?? null, account: account?.provider ?? null } });
  const res = await enqueueJob({ type: "publish.channel", workspaceId, payload: { publishJobId: job.id, workspaceId }, idempotencyKey: `${idempotencyKey}:${job.updatedAt.getTime()}`, runAt: opts.scheduledFor ?? undefined, maxAttempts: 3 });
  // inline 실행기는 enqueue 중에 이미 처리했을 수 있으므로 기존 로그를 보존하고 큐 Job id만 덧붙인다
  const current = await prisma.publishJob.findUnique({ where: { id: job.id }, select: { logs: true } });
  await prisma.publishJob.update({ where: { id: job.id }, data: { logs: [...((current?.logs as string[]) ?? []), `queue job ${res.jobId}`] } });
  return job;
}

export async function cancelPublishJobs(workspaceId: string, channelContentId: string) {
  const jobs = await prisma.publishJob.findMany({ where: { workspaceId, channelContentId, status: "QUEUED" } });
  const queue = getJobQueue();
  for (const j of jobs) {
    await prisma.publishJob.update({ where: { id: j.id }, data: { status: "CANCELED", finishedAt: new Date() } });
    const logs = (j.logs as string[]) ?? [];
    const qid = logs.find((l) => l.startsWith("queue job "))?.replace("queue job ", "");
    if (qid) await queue.cancel(qid);
  }
  return jobs.length;
}

/** 지금 실행 가능한 예약 Job을 처리 (워커가 없을 때 수동/크론 호출) */
export async function processDuePublishJobs(limit = 10) {
  const { processOne } = await import("@/server/jobs/runner");
  let n = 0;
  for (let i = 0; i < limit; i++) {
    const did = await processOne(`tick-${process.pid}`, ["publish.channel"]);
    if (!did) break;
    n++;
  }
  return n;
}
