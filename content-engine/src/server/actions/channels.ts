"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ChannelType } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { requireWorkspaceMember } from "@/server/tenancy/context";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { audit } from "@/server/security/audit";
import { encryptSecret } from "@/server/security/crypto";

const channelSchema = z.enum(["THREADS", "INSTAGRAM", "BLOG", "YOUTUBE_SHORTS"]);

/** Mock 계정 연결: 외부 API 없이 게시 흐름 데모 */
export async function connectMockAccountAction(slug: string, channel: string): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireWorkspaceMember(slug, "manageChannels");
  const parsed = channelSchema.safeParse(channel);
  if (!parsed.success) return fail("잘못된 채널");
  const existing = await prisma.channelAccount.findFirst({ where: { workspaceId: ctx.workspace.id, channel: parsed.data, provider: "mock", deletedAt: null } });
  if (existing) return ok({ id: existing.id });
  const acct = await prisma.channelAccount.create({ data: { workspaceId: ctx.workspace.id, channel: parsed.data, provider: "mock", displayName: `Mock ${parsed.data}`, isMock: true } });
  await audit({ workspaceId: ctx.workspace.id, userId: ctx.user.id, action: "channel.connect", entityType: "ChannelAccount", entityId: acct.id, meta: { provider: "mock", channel } });
  revalidatePath(`/w/${slug}/channels`);
  return ok({ id: acct.id });
}

const wordpressSchema = z.object({ siteUrl: z.string().url(), username: z.string().min(1), appPassword: z.string().min(1), status: z.enum(["draft", "publish"]).default("draft") });

export async function connectWordPressAction(slug: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireWorkspaceMember(slug, "manageChannels");
  const parsed = wordpressSchema.safeParse(input);
  if (!parsed.success) return fail("입력값을 확인하세요");
  const acct = await prisma.channelAccount.create({
    data: { workspaceId: ctx.workspace.id, channel: "BLOG", provider: "wordpress", displayName: parsed.data.siteUrl, accessTokenEnc: encryptSecret(parsed.data.appPassword), config: { siteUrl: parsed.data.siteUrl, username: parsed.data.username, status: parsed.data.status } },
  });
  await audit({ workspaceId: ctx.workspace.id, userId: ctx.user.id, action: "channel.connect", entityType: "ChannelAccount", entityId: acct.id, meta: { provider: "wordpress" } });
  revalidatePath(`/w/${slug}/channels`);
  return ok({ id: acct.id });
}

export async function disconnectAccountAction(slug: string, accountId: string): Promise<ActionResult<undefined>> {
  const ctx = await requireWorkspaceMember(slug, "manageChannels");
  const r = await prisma.channelAccount.updateMany({ where: { id: accountId, workspaceId: ctx.workspace.id, deletedAt: null }, data: { deletedAt: new Date(), accessTokenEnc: null, refreshTokenEnc: null } });
  if (r.count === 0) return fail("계정을 찾을 수 없습니다");
  await audit({ workspaceId: ctx.workspace.id, userId: ctx.user.id, action: "channel.disconnect", entityType: "ChannelAccount", entityId: accountId });
  revalidatePath(`/w/${slug}/channels`);
  return ok(undefined);
}

export async function listAccountsForChannel(slug: string, channel: ChannelType) {
  const ctx = await requireWorkspaceMember(slug, "viewContent");
  return prisma.channelAccount.findMany({ where: { workspaceId: ctx.workspace.id, channel, deletedAt: null }, select: { id: true, provider: true, displayName: true, isMock: true } });
}
