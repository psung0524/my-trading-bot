import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { registerJob } from "./registry";
import { getPublisher, PublishError } from "@/server/providers/publish";
import { validationResultSchema } from "@/lib/schemas/content";
import { PUBLISHABLE } from "@/server/publish/state-machine";
import { decryptSecret } from "@/server/security/crypto";
import { getStorage } from "@/server/providers/storage";
import { audit } from "@/server/security/audit";
import { refreshThreadsToken } from "@/server/providers/publish/threads";
import { encryptSecret } from "@/server/security/crypto";
import { prepareBodyForPublish } from "@/server/analytics/tracking";

type Payload = { publishJobId: string; workspaceId: string };

/**
 * 게시 핸들러. 클라이언트 상태를 믿지 않고 서버에서 다시 확인한다:
 * 1) 콘텐츠가 APPROVED/SCHEDULED 2) 검증 BLOCK 없음 3) 승인 로그의 버전 == 현재 버전 4) 멱등키 중복 아님
 */
registerJob("publish.channel", async (payload, ctx) => {
  const p = payload as Payload;
  const job = await prisma.publishJob.findFirst({ where: { id: p.publishJobId, workspaceId: p.workspaceId }, include: { channelContent: { include: { master: true, assets: { where: { deletedAt: null } } } }, channelAccount: true } });
  if (!job) throw new Error("PublishJob 없음");
  if (job.status === "CANCELED") {
    ctx.log("취소된 작업");
    return;
  }
  if (job.status === "SUCCEEDED") {
    ctx.log("이미 게시됨(멱등)");
    return;
  }
  const cc = job.channelContent;
  const logs: string[] = (job.logs as string[]) ?? [];
  const log = (m: string) => {
    logs.push(`[${new Date().toISOString()}] ${m}`);
    ctx.log(m);
  };
  const fail = async (msg: string, retryable: boolean) => {
    log(`실패: ${msg}`);
    await prisma.publishJob.update({ where: { id: job.id }, data: { status: retryable && ctx.attempt < 3 ? "QUEUED" : "FAILED", lastError: msg.slice(0, 2000), logs, attempts: { increment: 1 }, finishedAt: retryable ? null : new Date() } });
    await prisma.channelContent.update({ where: { id: cc.id }, data: { status: "FAILED" } });
    await audit({ workspaceId: p.workspaceId, action: "content.publish_failed", entityType: "ChannelContent", entityId: cc.id, meta: { error: msg } });
  };

  // 서버측 재검증
  if (!PUBLISHABLE.includes(cc.status)) {
    await prisma.publishJob.update({ where: { id: job.id }, data: { status: "CANCELED", lastError: `게시 불가 상태: ${cc.status}`, logs, finishedAt: new Date() } });
    log(`게시 불가 상태: ${cc.status}`);
    return;
  }
  const v = validationResultSchema.safeParse(cc.validation);
  if (v.success && v.data.blocked) {
    await fail("검증에 실패한 콘텐츠는 게시할 수 없습니다", false);
    throw new Error("검증 실패 콘텐츠");
  }
  const approval = await prisma.approval.findFirst({ where: { channelContentId: cc.id, decision: "APPROVED" }, orderBy: { createdAt: "desc" } });
  if (!approval || approval.contentVersion !== cc.currentVersion) {
    await fail(`승인된 버전(v${approval?.contentVersion ?? "-"})과 현재 버전(v${cc.currentVersion})이 다릅니다. 다시 승인하세요`, false);
    throw new Error("승인 버전 불일치");
  }
  if (cc.master.status === "NEEDS_SOURCE") {
    await fail("Content Master에 출처가 없는 수치가 있습니다", false);
    throw new Error("NEEDS_SOURCE");
  }

  await prisma.$transaction([
    prisma.publishJob.update({ where: { id: job.id }, data: { status: "PROCESSING", startedAt: new Date(), attempts: { increment: 1 } } }),
    prisma.channelContent.update({ where: { id: cc.id }, data: { status: "PUBLISHING" } }),
  ]);

  // 계정 토큰 준비 (만료 임박 시 갱신)
  let account: Parameters<ReturnType<typeof getPublisher>["publish"]>[0]["account"] = null;
  if (job.channelAccount && !job.channelAccount.isMock) {
    let token = job.channelAccount.accessTokenEnc ? decryptSecret(job.channelAccount.accessTokenEnc) : null;
    if (job.channelAccount.provider === "threads" && token && job.channelAccount.tokenExpiresAt && job.channelAccount.tokenExpiresAt.getTime() - Date.now() < 7 * 86400_000) {
      try {
        const r = await refreshThreadsToken(token);
        token = r.accessToken;
        await prisma.channelAccount.update({ where: { id: job.channelAccount.id }, data: { accessTokenEnc: encryptSecret(token), tokenExpiresAt: r.expiresAt } });
        log("Threads 토큰 갱신");
      } catch (e) {
        log(`토큰 갱신 실패: ${(e as Error).message}`);
      }
    }
    account = { id: job.channelAccount.id, provider: job.channelAccount.provider, externalId: job.channelAccount.externalId, accessToken: token, config: (job.channelAccount.config ?? {}) as Record<string, unknown> };
  } else if (job.channelAccount?.isMock) {
    account = { id: job.channelAccount.id, provider: "mock", externalId: null, accessToken: null, config: {} };
  }

  const publisher = getPublisher(cc.channel, account?.provider);
  const storage = getStorage();
  try {
    const { body, trackingLinks } = await prepareBodyForPublish(p.workspaceId, cc);
    if (trackingLinks.length) log(`추적 링크 적용: ${trackingLinks.map((t) => t.code).join(", ")}`);
    const result = await publisher.publish({
      workspaceId: p.workspaceId,
      channelContentId: cc.id,
      channel: cc.channel,
      body,
      assets: cc.assets.filter((a) => a.storageKey.includes(`/v${cc.currentVersion}/`)).map((a) => ({ kind: a.kind, key: a.storageKey, url: storage.url(a.storageKey), data: () => storage.get(a.storageKey) })),
      idempotencyKey: job.idempotencyKey,
      account,
      log,
    });
    log(`게시 완료 ${result.externalId} ${result.externalUrl}`);
    await prisma.$transaction([
      prisma.publishJob.update({ where: { id: job.id }, data: { status: "SUCCEEDED", externalId: result.externalId, externalUrl: result.externalUrl, logs, finishedAt: new Date() } }),
      prisma.channelContent.update({ where: { id: cc.id }, data: { status: "PUBLISHED", publishedAt: new Date(), externalId: result.externalId, externalUrl: result.externalUrl } }),
    ]);
    await audit({ workspaceId: p.workspaceId, action: "content.publish", entityType: "ChannelContent", entityId: cc.id, meta: { externalId: result.externalId, externalUrl: result.externalUrl, provider: publisher.name } as Prisma.InputJsonValue });
    return { externalId: result.externalId, externalUrl: result.externalUrl };
  } catch (e) {
    const retryable = e instanceof PublishError ? e.retryable : true;
    await fail((e as Error).message, retryable);
    if (retryable) throw e;
    return { failed: true };
  }
});
