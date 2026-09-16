import type { ChannelType } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { validationResultSchema } from "@/lib/schemas/content";
import { assertTransition } from "./state-machine";
import { audit } from "@/server/security/audit";
import { createPublishJob, cancelPublishJobs } from "./publish";

async function loadContent(workspaceId: string, channelContentId: string) {
  const cc = await prisma.channelContent.findFirst({ where: { id: channelContentId, workspaceId, deletedAt: null }, include: { master: true } });
  if (!cc) throw new Error("채널 콘텐츠를 찾을 수 없습니다");
  return cc;
}

/** 승인: 검증 BLOCK이 없어야 하며 승인 로그에 버전을 기록한다. scheduledAt이 있으면 SCHEDULED + 예약 Job */
export async function approveContent(workspaceId: string, channelContentId: string, userId: string, opts: { scheduledAt?: Date | null; note?: string; channelAccountId?: string | null } = {}) {
  const cc = await loadContent(workspaceId, channelContentId);
  if (cc.master.status === "NEEDS_SOURCE") throw new Error("Content Master에 출처가 없는 수치가 있어 승인할 수 없습니다");
  const v = validationResultSchema.safeParse(cc.validation);
  if (v.success && v.data.blocked) throw new Error("검증에 실패한 콘텐츠는 승인할 수 없습니다. 이슈를 먼저 해결하세요");
  const target = opts.scheduledAt ? "SCHEDULED" : "APPROVED";
  assertTransition(cc.status, target === "SCHEDULED" && cc.status === "NEEDS_REVIEW" ? "APPROVED" : target);
  if (opts.scheduledAt && opts.scheduledAt.getTime() < Date.now() - 60_000) throw new Error("예약 시각은 현재 이후여야 합니다");

  const updated = await prisma.channelContent.update({ where: { id: cc.id }, data: { status: target, scheduledAt: opts.scheduledAt ?? null } });
  await prisma.approval.create({ data: { workspaceId, channelContentId: cc.id, userId, decision: "APPROVED", contentVersion: cc.currentVersion, channel: cc.channel, scheduledAt: opts.scheduledAt ?? null, note: opts.note ?? "" } });
  await audit({ workspaceId, userId, action: "content.approve", entityType: "ChannelContent", entityId: cc.id, meta: { version: cc.currentVersion, scheduledAt: opts.scheduledAt?.toISOString() ?? null } });
  if (opts.scheduledAt) await createPublishJob(workspaceId, cc.id, { scheduledFor: opts.scheduledAt, channelAccountId: opts.channelAccountId ?? null, userId });
  return updated;
}

export async function rejectContent(workspaceId: string, channelContentId: string, userId: string, note = "") {
  const cc = await loadContent(workspaceId, channelContentId);
  assertTransition(cc.status, "REJECTED");
  await prisma.channelContent.update({ where: { id: cc.id }, data: { status: "REJECTED", scheduledAt: null } });
  await prisma.approval.create({ data: { workspaceId, channelContentId: cc.id, userId, decision: "REJECTED", contentVersion: cc.currentVersion, channel: cc.channel, note } });
  await audit({ workspaceId, userId, action: "content.reject", entityType: "ChannelContent", entityId: cc.id, meta: { note } });
}

/** 승인 취소 / 예약 취소 → NEEDS_REVIEW */
export async function revokeApproval(workspaceId: string, channelContentId: string, userId: string, note = "") {
  const cc = await loadContent(workspaceId, channelContentId);
  assertTransition(cc.status, "NEEDS_REVIEW");
  await cancelPublishJobs(workspaceId, cc.id);
  await prisma.channelContent.update({ where: { id: cc.id }, data: { status: "NEEDS_REVIEW", scheduledAt: null } });
  await prisma.approval.create({ data: { workspaceId, channelContentId: cc.id, userId, decision: "REVOKED", contentVersion: cc.currentVersion, channel: cc.channel, note } });
  await audit({ workspaceId, userId, action: "content.revoke", entityType: "ChannelContent", entityId: cc.id });
}

export async function reschedule(workspaceId: string, channelContentId: string, userId: string, scheduledAt: Date, channelAccountId?: string | null) {
  const cc = await loadContent(workspaceId, channelContentId);
  if (cc.status !== "SCHEDULED" && cc.status !== "APPROVED") throw new Error("승인된 콘텐츠만 예약할 수 있습니다");
  if (scheduledAt.getTime() < Date.now() - 60_000) throw new Error("예약 시각은 현재 이후여야 합니다");
  await cancelPublishJobs(workspaceId, cc.id);
  await prisma.channelContent.update({ where: { id: cc.id }, data: { status: "SCHEDULED", scheduledAt } });
  await createPublishJob(workspaceId, cc.id, { scheduledFor: scheduledAt, channelAccountId: channelAccountId ?? null, userId });
  await audit({ workspaceId, userId, action: "content.reschedule", entityType: "ChannelContent", entityId: cc.id, meta: { scheduledAt: scheduledAt.toISOString() } });
}

/** 되돌리기: NEEDS_REVIEW로 (REJECTED/FAILED에서 다시 검토) */
export async function reopenContent(workspaceId: string, channelContentId: string, userId: string) {
  const cc = await loadContent(workspaceId, channelContentId);
  assertTransition(cc.status, "NEEDS_REVIEW");
  await prisma.channelContent.update({ where: { id: cc.id }, data: { status: "NEEDS_REVIEW" } });
  await audit({ workspaceId, userId, action: "content.reopen", entityType: "ChannelContent", entityId: cc.id });
}

export type InboxItem = { id: string; masterId: string; channel: ChannelType; variant: string; title: string; status: string; version: number; scheduledAt: string | null; blocked: boolean; issueCount: number; snippet: string };
