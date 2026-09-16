import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { withUtm } from "@/server/analytics/tracking";
import { rateLimiter, clientIp } from "@/server/security/rate-limit";
import { randomToken } from "@/server/security/crypto";

/** 추적 링크: 클릭 이벤트 기록 후 UTM이 붙은 목적지로 302 */
export async function GET(req: Request, ctx: RouteContext<"/api/t/[code]">) {
  const { code } = await ctx.params;
  const link = await prisma.trackingLink.findUnique({ where: { code }, include: { channelContent: { select: { masterId: true, master: { select: { productId: true } } } } } });
  if (!link) return NextResponse.json({ error: "링크 없음" }, { status: 404 });
  const ip = clientIp(req.headers);
  const rl = await rateLimiter.check(`t:${ip}`, 120, 60_000);
  const dest = withUtm(link.destinationUrl, link);
  if (!rl.ok) return NextResponse.redirect(dest, 302);

  // 익명 ID 쿠키 (개인정보 아님, 무작위 값)
  const cookieHeader = req.headers.get("cookie") ?? "";
  let anon = cookieHeader.match(/(?:^|;\s*)ce_aid=([^;]+)/)?.[1];
  const setCookie = !anon;
  anon ??= randomToken(12);
  const isBot = /bot|crawler|spider|preview|facebookexternalhit|Twitterbot|Slackbot/i.test(req.headers.get("user-agent") ?? "");
  if (!isBot) {
    await prisma.$transaction([
      prisma.trackingLink.update({ where: { id: link.id }, data: { clickCount: { increment: 1 } } }),
      prisma.analyticsEvent.create({
        data: {
          workspaceId: link.workspaceId,
          productId: link.channelContent?.master.productId ?? null,
          campaignId: link.campaignId,
          channelContentId: link.channelContentId,
          trackingLinkId: link.id,
          anonymousId: anon,
          sessionId: randomToken(8),
          eventName: "content_click",
          properties: { code: link.code },
          timestamp: new Date(),
          referrer: req.headers.get("referer"),
          utmSource: link.utmSource,
          utmMedium: link.utmMedium,
          utmCampaign: link.utmCampaign,
          utmContent: link.utmContent,
        },
      }),
    ]);
  }
  const res = NextResponse.redirect(dest, 302);
  if (setCookie) res.headers.append("set-cookie", `ce_aid=${anon}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`);
  res.headers.set("cache-control", "no-store");
  return res;
}
