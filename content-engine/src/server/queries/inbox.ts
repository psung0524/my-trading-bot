import { prisma } from "@/server/db/prisma";
import { validationResultSchema } from "@/lib/schemas/content";
import { extractChannelTexts } from "@/server/content/channel-text";

export async function listInbox(workspaceId: string) {
  const items = await prisma.channelContent.findMany({
    where: { workspaceId, deletedAt: null, status: { in: ["NEEDS_REVIEW", "NEEDS_SOURCE", "APPROVED", "SCHEDULED", "FAILED", "REJECTED"] } },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: { master: { select: { id: true, title: true, status: true } }, approvals: { orderBy: { createdAt: "desc" }, take: 1, include: { user: { select: { name: true, email: true } } } }, publishJobs: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  const accounts = await prisma.channelAccount.findMany({ where: { workspaceId, deletedAt: null }, select: { id: true, channel: true, provider: true, displayName: true, isMock: true } });
  return {
    accounts,
    items: items.map((c) => {
      const v = validationResultSchema.safeParse(c.validation);
      let snippet = "";
      try {
        snippet = extractChannelTexts(c.channel, c.body).map((t) => t.text).join(" ").slice(0, 160);
      } catch {
        snippet = c.title;
      }
      return {
        id: c.id,
        masterId: c.masterId,
        masterTitle: c.master.title,
        masterNeedsSource: c.master.status === "NEEDS_SOURCE",
        channel: c.channel,
        variant: c.variant,
        title: c.title,
        status: c.status,
        version: c.currentVersion,
        scheduledAt: c.scheduledAt?.toISOString() ?? null,
        blocked: v.success ? v.data.blocked : false,
        issueCount: v.success ? v.data.issues.length : 0,
        snippet,
        lastApproval: c.approvals[0] ? { decision: c.approvals[0].decision, version: c.approvals[0].contentVersion, by: c.approvals[0].user.name || c.approvals[0].user.email, at: c.approvals[0].createdAt.toISOString() } : null,
        lastError: c.publishJobs[0]?.lastError ?? null,
      };
    }),
  };
}
