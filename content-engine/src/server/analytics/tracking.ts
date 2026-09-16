import type { ChannelContent, ChannelType } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { randomCode } from "@/server/security/crypto";

const MEDIUM: Record<ChannelType, string> = { THREADS: "social", INSTAGRAM: "social", BLOG: "blog", YOUTUBE_SHORTS: "video" };
const SOURCE: Record<ChannelType, string> = { THREADS: "threads", INSTAGRAM: "instagram", BLOG: "blog", YOUTUBE_SHORTS: "youtube" };

export function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** 채널 콘텐츠의 추적 링크를 만들거나 재사용한다 (목적지별 1개) */
export async function ensureTrackingLink(workspaceId: string, cc: Pick<ChannelContent, "id" | "channel" | "masterId">, destinationUrl: string, campaignId?: string | null) {
  const existing = await prisma.trackingLink.findFirst({ where: { workspaceId, channelContentId: cc.id, destinationUrl } });
  if (existing) return existing;
  const campaign = campaignId ? await prisma.campaign.findFirst({ where: { id: campaignId, workspaceId } }) : await prisma.campaignItem.findFirst({ where: { channelContentId: cc.id }, include: { campaign: true } }).then((i) => i?.campaign ?? null);
  return prisma.trackingLink.create({
    data: {
      workspaceId,
      channelContentId: cc.id,
      campaignId: campaign?.id ?? null,
      code: randomCode(8),
      destinationUrl,
      utmSource: SOURCE[cc.channel],
      utmMedium: MEDIUM[cc.channel],
      utmCampaign: campaign?.slug ?? cc.masterId,
      utmContent: cc.id,
    },
  });
}

export function trackingUrl(code: string) {
  return `${appUrl()}/api/t/${code}`;
}

/** 목적지 URL에 UTM을 붙인다 (기존 쿼리 보존) */
export function withUtm(destination: string, link: { utmSource: string; utmMedium: string; utmCampaign: string; utmContent: string }) {
  try {
    const u = new URL(destination);
    u.searchParams.set("utm_source", link.utmSource);
    u.searchParams.set("utm_medium", link.utmMedium);
    u.searchParams.set("utm_campaign", link.utmCampaign);
    u.searchParams.set("utm_content", link.utmContent);
    return u.toString();
  } catch {
    return destination;
  }
}

/**
 * 게시 직전 본문의 CTA URL을 추적 링크로 치환한다. 승인된 텍스트는 링크 치환 외에는 바뀌지 않는다.
 * 반환된 body는 저장하지 않고 게시에만 쓴다(원본 보존).
 */
export async function prepareBodyForPublish(workspaceId: string, cc: ChannelContent) {
  const body = JSON.parse(JSON.stringify(cc.body)) as Record<string, unknown>;
  const urls = new Set<string>();
  const collect = (v: unknown) => {
    if (typeof v === "string") for (const m of v.matchAll(/https?:\/\/[^\s)\]"']+/g)) urls.add(m[0]);
    else if (Array.isArray(v)) v.forEach(collect);
    else if (v && typeof v === "object") Object.values(v).forEach(collect);
  };
  collect(body);
  const links = [];
  let text = JSON.stringify(body);
  for (const url of urls) {
    if (url.includes("/api/t/")) continue;
    const link = await ensureTrackingLink(workspaceId, cc, url);
    links.push(link);
    text = text.split(JSON.stringify(url).slice(1, -1)).join(trackingUrl(link.code));
  }
  return { body: JSON.parse(text) as unknown, trackingLinks: links };
}
