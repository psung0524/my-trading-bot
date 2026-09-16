import { prisma } from "@/server/db/prisma";
import type { CollectEvent } from "@/lib/schemas/analytics";
import { getAnalyticsForwarders } from "@/server/providers/analytics";

/**
 * 이벤트 저장. utm_content가 이 워크스페이스의 채널 콘텐츠 id이면 channelContentId로 귀속한다.
 * 존재하지 않는 workspaceId는 조용히 무시한다(외부 스크립트에 정보 노출 방지).
 */
export async function ingestEvents(events: CollectEvent[]) {
  const wsIds = [...new Set(events.map((e) => e.workspaceId))];
  const workspaces = await prisma.workspace.findMany({ where: { id: { in: wsIds }, deletedAt: null }, select: { id: true } });
  const valid = new Set(workspaces.map((w) => w.id));
  const contentIds = [...new Set(events.flatMap((e) => [e.channelContentId, e.utm?.content]).filter((x): x is string => Boolean(x)))];
  const contents = contentIds.length ? await prisma.channelContent.findMany({ where: { id: { in: contentIds } }, select: { id: true, workspaceId: true, masterId: true, master: { select: { productId: true } } } }) : [];
  const contentMap = new Map(contents.map((c) => [c.id, c]));
  const forwarders = getAnalyticsForwarders();
  let stored = 0;
  for (const e of events) {
    if (!valid.has(e.workspaceId)) continue;
    const cc = contentMap.get(e.channelContentId ?? "") ?? contentMap.get(e.utm?.content ?? "");
    const channelContentId = cc && cc.workspaceId === e.workspaceId ? cc.id : null;
    const ts = e.timestamp ? new Date(e.timestamp) : new Date();
    const safeTs = Math.abs(ts.getTime() - Date.now()) > 7 * 86400_000 ? new Date() : ts;
    await prisma.analyticsEvent.create({
      data: {
        workspaceId: e.workspaceId,
        productId: e.productId ?? cc?.master.productId ?? null,
        campaignId: e.campaignId ?? null,
        channelContentId,
        anonymousId: e.anonymousId,
        userId: e.userId ?? null,
        sessionId: e.sessionId,
        eventName: e.eventName,
        properties: e.properties,
        timestamp: safeTs,
        landingPage: e.landingPage ?? null,
        referrer: e.referrer ?? null,
        utmSource: e.utm?.source ?? null,
        utmMedium: e.utm?.medium ?? null,
        utmCampaign: e.utm?.campaign ?? null,
        utmContent: e.utm?.content ?? null,
      },
    });
    stored++;
    for (const f of forwarders) f.forward({ ...e, channelContentId }).catch(() => undefined);
  }
  return stored;
}
