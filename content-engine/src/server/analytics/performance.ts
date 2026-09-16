import type { ChannelType } from "@prisma/client";
import { prisma } from "@/server/db/prisma";

export type Metrics = {
  /** 외부 플랫폼이 제공하지 않으면 null(N/A) */
  impressions: number | null;
  clicks: number;
  landingVisits: number;
  signups: number;
  signupStarted: number;
  activations: number;
  returnVisits: number;
  paidConversions: number;
};

export type ContentMetrics = Metrics & {
  channelContentId: string;
  channel: ChannelType;
  title: string;
  masterId: string;
  masterTitle: string;
  topicId: string | null;
  topicTitle: string;
  category: string;
  ctaLabel: string;
  status: string;
  publishedAt: string | null;
};

const ACTIVATION = new Set(["calculator_used", "stock_added", "portfolio_created"]);

export function emptyMetrics(): Metrics {
  return { impressions: null, clicks: 0, landingVisits: 0, signups: 0, signupStarted: 0, activations: 0, returnVisits: 0, paidConversions: 0 };
}

export function rate(n: number, d: number): number | null {
  return d > 0 ? n / d : null;
}

/**
 * 기간 내 이벤트를 채널 콘텐츠별로 집계한다. 귀속은 event.channelContentId(추적 링크 클릭 또는 utm_content) 기준.
 * 회원가입·활성화·재방문·유료전환은 익명 ID 기준 유니크 카운트.
 */
export async function computePerformance(workspaceId: string, since: Date, until = new Date()) {
  const events = await prisma.analyticsEvent.findMany({
    where: { workspaceId, timestamp: { gte: since, lte: until } },
    select: { channelContentId: true, anonymousId: true, eventName: true, utmContent: true },
    take: 100_000,
  });
  const contents = await prisma.channelContent.findMany({
    where: { workspaceId, deletedAt: null },
    select: { id: true, channel: true, title: true, status: true, publishedAt: true, masterId: true, master: { select: { title: true, cta: true, topicId: true, topic: { select: { title: true, category: true } } } } },
  });
  const byContent = new Map<string, ContentMetrics>();
  for (const c of contents) {
    const cta = (c.master.cta as { label?: string } | null)?.label ?? "";
    byContent.set(c.id, { ...emptyMetrics(), channelContentId: c.id, channel: c.channel, title: c.title, masterId: c.masterId, masterTitle: c.master.title, topicId: c.master.topicId, topicTitle: c.master.topic?.title ?? "(소재 없음)", category: c.master.topic?.category ?? "INFORMATIONAL", ctaLabel: cta, status: c.status, publishedAt: c.publishedAt?.toISOString() ?? null });
  }
  const uniq = new Map<string, Set<string>>();
  const mark = (key: string, anon: string) => {
    let s = uniq.get(key);
    if (!s) uniq.set(key, (s = new Set()));
    if (s.has(anon)) return false;
    s.add(anon);
    return true;
  };
  const total: Metrics = emptyMetrics();
  const unattributed: Metrics = emptyMetrics();
  for (const e of events) {
    const target = e.channelContentId ? byContent.get(e.channelContentId) : null;
    const buckets: Metrics[] = [total, target ?? unattributed];
    const key = e.channelContentId ?? "_";
    switch (e.eventName) {
      case "content_click":
        buckets.forEach((b) => b.clicks++);
        break;
      case "page_view":
        if (mark(`lv:${key}`, e.anonymousId)) buckets.forEach((b) => b.landingVisits++);
        break;
      case "signup_started":
        if (mark(`ss:${key}`, e.anonymousId)) buckets.forEach((b) => b.signupStarted++);
        break;
      case "signup_completed":
        if (mark(`su:${key}`, e.anonymousId)) buckets.forEach((b) => b.signups++);
        break;
      case "return_visit":
        if (mark(`rv:${key}`, e.anonymousId)) buckets.forEach((b) => b.returnVisits++);
        break;
      case "subscription_started":
        if (mark(`pc:${key}`, e.anonymousId)) buckets.forEach((b) => b.paidConversions++);
        break;
      default:
        if (ACTIVATION.has(e.eventName) && mark(`ac:${key}`, e.anonymousId)) buckets.forEach((b) => b.activations++);
    }
  }
  const list = [...byContent.values()];
  const group = <K extends string>(keyOf: (c: ContentMetrics) => K, labelOf: (c: ContentMetrics) => string) => {
    const m = new Map<K, Metrics & { key: K; label: string; contents: number }>();
    for (const c of list) {
      const k = keyOf(c);
      let g = m.get(k);
      if (!g) m.set(k, (g = { ...emptyMetrics(), key: k, label: labelOf(c), contents: 0 }));
      g.contents++;
      g.clicks += c.clicks; g.landingVisits += c.landingVisits; g.signups += c.signups; g.signupStarted += c.signupStarted; g.activations += c.activations; g.returnVisits += c.returnVisits; g.paidConversions += c.paidConversions;
    }
    return [...m.values()].sort((a, b) => b.clicks - a.clicks);
  };
  return {
    total,
    unattributed,
    contents: list.sort((a, b) => b.clicks - a.clicks),
    byChannel: group((c) => c.channel, (c) => c.channel),
    byTopic: group((c) => c.topicId ?? "none", (c) => c.topicTitle),
    byCategory: group((c) => c.category, (c) => c.category),
    byCta: group((c) => c.ctaLabel || "(없음)", (c) => c.ctaLabel || "(없음)"),
    eventCount: events.length,
  };
}

/** 하루 단위 ContentPerformance 저장 (점수 이력용). 같은 날짜는 upsert */
export async function rollupDaily(workspaceId: string, day = new Date()) {
  const start = new Date(day);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  const perf = await computePerformance(workspaceId, start, end);
  let n = 0;
  for (const c of perf.contents) {
    if (!c.clicks && !c.landingVisits && !c.signups && !c.activations && !c.returnVisits && !c.paidConversions) continue;
    await prisma.contentPerformance.upsert({
      where: { channelContentId_date: { channelContentId: c.channelContentId, date: start } },
      create: { workspaceId, channelContentId: c.channelContentId, channel: c.channel, date: start, impressions: null, clicks: c.clicks, landingVisits: c.landingVisits, signups: c.signups, activations: c.activations, returnVisits: c.returnVisits, paidConversions: c.paidConversions },
      update: { clicks: c.clicks, landingVisits: c.landingVisits, signups: c.signups, activations: c.activations, returnVisits: c.returnVisits, paidConversions: c.paidConversions },
    });
    n++;
  }
  return n;
}
