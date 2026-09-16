import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("computePerformance (DB 통합)", () => {
  const ids = { ws: "", product: "", master: "", cc: "" };
  beforeAll(async () => {
    const ws = await prisma.workspace.create({ data: { slug: `perf-${Date.now().toString(36)}`, name: "perf" } });
    const product = await prisma.product.create({ data: { workspaceId: ws.id, name: "p", url: "https://example.com" } });
    const master = await prisma.contentMaster.create({ data: { workspaceId: ws.id, productId: product.id, title: "m", asOfDate: new Date(), cta: { label: "계산하기", url: "https://example.com" } } });
    const cc = await prisma.channelContent.create({ data: { workspaceId: ws.id, masterId: master.id, channel: "THREADS", title: "t", body: {} } });
    Object.assign(ids, { ws: ws.id, product: product.id, master: master.id, cc: cc.id });
    const now = new Date();
    const ev = (eventName: string, anonymousId: string, channelContentId: string | null = cc.id) => ({ workspaceId: ws.id, channelContentId, anonymousId, sessionId: "s", eventName, timestamp: now });
    await prisma.analyticsEvent.createMany({
      data: [
        ev("content_click", "a"), ev("content_click", "b"), ev("content_click", "a"),
        ev("page_view", "a"), ev("page_view", "a"), ev("page_view", "b"),
        ev("signup_completed", "a"), ev("signup_completed", "a"),
        ev("calculator_used", "a"), ev("return_visit", "b"),
        ev("signup_completed", "zzz", null),
      ],
    });
  });
  afterAll(async () => {
    if (ids.ws) await prisma.workspace.delete({ where: { id: ids.ws } });
    await prisma.$disconnect();
  });

  it("클릭은 합산, 가입/방문/활성화는 익명ID 유니크, 미귀속은 별도", async () => {
    const { computePerformance } = await import("@/server/analytics/performance");
    const perf = await computePerformance(ids.ws, new Date(Date.now() - 3600_000));
    const c = perf.contents.find((x) => x.channelContentId === ids.cc)!;
    expect(c.clicks).toBe(3);
    expect(c.landingVisits).toBe(2);
    expect(c.signups).toBe(1);
    expect(c.activations).toBe(1);
    expect(c.returnVisits).toBe(1);
    expect(c.impressions).toBeNull();
    expect(perf.unattributed.signups).toBe(1);
    expect(perf.total.signups).toBe(2);
    expect(perf.byChannel.find((g) => g.key === "THREADS")?.clicks).toBe(3);
    expect(perf.byCta[0].label).toBe("계산하기");
  });
});
