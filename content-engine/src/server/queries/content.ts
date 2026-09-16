import { prisma } from "@/server/db/prisma";

export async function listTopics(workspaceId: string, productId?: string) {
  return prisma.contentTopic.findMany({
    where: { workspaceId, deletedAt: null, ...(productId ? { productId } : {}), status: { not: "DISMISSED" } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { sources_: { select: { type: true } }, masters: { select: { id: true, status: true }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
}

export async function listMasters(workspaceId: string) {
  return prisma.contentMaster.findMany({
    where: { workspaceId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { product: { select: { name: true } }, channels: { where: { deletedAt: null }, select: { id: true, channel: true, variant: true, status: true } } },
  });
}

export async function getMasterDetail(workspaceId: string, masterId: string) {
  return prisma.contentMaster.findFirst({
    where: { id: masterId, workspaceId, deletedAt: null },
    include: {
      product: { select: { id: true, name: true, url: true } },
      topic: { select: { id: true, title: true, category: true } },
      channels: { where: { deletedAt: null }, orderBy: [{ channel: "asc" }, { createdAt: "asc" }], include: { assets: { select: { id: true, kind: true } }, renderJobs: { orderBy: { updatedAt: "desc" }, take: 1, select: { id: true, status: true, step: true, lastError: true } } } },
    },
  });
}

export async function getChannelContent(workspaceId: string, channelId: string) {
  return prisma.channelContent.findFirst({
    where: { id: channelId, workspaceId, deletedAt: null },
    include: {
      master: { include: { product: { select: { id: true, name: true, url: true } } } },
      versions: { orderBy: { version: "desc" }, take: 10, select: { id: true, version: true, source: true, changeSummary: true, createdAt: true } },
      assets: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
      renderJobs: { orderBy: { updatedAt: "desc" }, take: 3 },
      approvals: { orderBy: { createdAt: "desc" }, take: 5, include: { user: { select: { name: true, email: true } } } },
      publishJobs: { orderBy: { createdAt: "desc" }, take: 3 },
      trackingLinks: { take: 3 },
    },
  });
}
