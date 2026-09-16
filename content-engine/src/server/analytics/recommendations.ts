import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { computePerformance } from "./performance";
import { parseWeights, scoreContents, MIN_CLICKS_FOR_SCORE, type Scored } from "./score";
import { CATEGORY_LABELS } from "@/server/content/content-mix";
import { CHANNEL_LABELS } from "@/lib/labels";

export type RecKind = "EXPAND_TOPIC" | "REDUCE_TYPE" | "GOOD_CTA" | "GOOD_CHANNEL" | "REUSE" | "STOP_CAMPAIGN" | "NEED_DATA";

type Draft = { kind: RecKind; title: string; reason: string; metrics: Record<string, unknown>; payload: Record<string, unknown>; dedupeKey: string };

function pct(v: number | null) {
  return v === null ? "N/A" : `${(v * 100).toFixed(1)}%`;
}

/**
 * 규칙 기반 추천. 사용한 지표와 이유를 함께 저장하고, 자동 적용하지 않는다(사용자 승인 필요).
 */
export function buildRecommendations(scored: Scored[], byChannel: { key: string; clicks: number; signups: number; landingVisits: number }[], byCategory: { key: string; contents: number; clicks: number; signups: number; landingVisits: number }[], byCta: { key: string; clicks: number; signups: number; landingVisits: number }[], now = new Date()): Draft[] {
  const out: Draft[] = [];
  const withScore = scored.filter((s) => s.score !== null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const top = withScore.slice(0, 3);
  const bottom = withScore.slice(-3).filter((s) => (s.score ?? 0) < 0.3);

  // 확대할 소재: 상위 점수 콘텐츠의 소재
  const seenTopic = new Set<string>();
  for (const s of top) {
    if (!s.topicId || seenTopic.has(s.topicId)) continue;
    seenTopic.add(s.topicId);
    out.push({ kind: "EXPAND_TOPIC", title: `소재 확대: ${s.topicTitle}`, reason: `점수 ${s.score} (상위 ${top.indexOf(s) + 1}위). 클릭 ${s.clicks}, 가입 전환율 ${pct(s.signupRate)}, 활성화율 ${pct(s.activationRate)}. 같은 소재의 후속 콘텐츠(FAQ·심화·다른 조건 계산)를 만들 가치가 있습니다.`, metrics: { score: s.score, clicks: s.clicks, signupRate: s.signupRate, activationRate: s.activationRate, returnRate: s.returnRate }, payload: { topicId: s.topicId, masterId: s.masterId }, dedupeKey: `EXPAND_TOPIC:${s.topicId}` });
  }
  // 재활용: 게시 14일 이상 지난 상위 콘텐츠를 다른 채널로
  for (const s of top) {
    if (!s.publishedAt || now.getTime() - new Date(s.publishedAt).getTime() < 14 * 86400_000) continue;
    out.push({ kind: "REUSE", title: `재활용: ${s.masterTitle} (${CHANNEL_LABELS[s.channel]})`, reason: `게시 ${Math.floor((now.getTime() - new Date(s.publishedAt).getTime()) / 86400_000)}일 경과, 점수 ${s.score}. 같은 Content Master로 다른 채널 콘텐츠를 만들거나 기준일을 갱신해 다시 게시하세요.`, metrics: { score: s.score, clicks: s.clicks, publishedAt: s.publishedAt }, payload: { masterId: s.masterId, channelContentId: s.channelContentId }, dedupeKey: `REUSE:${s.channelContentId}` });
  }
  // 줄일 유형: 점유율 높고 성과 낮은 카테고리
  const totalContents = byCategory.reduce((a, b) => a + b.contents, 0) || 1;
  for (const c of byCategory) {
    const share = c.contents / totalContents;
    const su = c.landingVisits >= MIN_CLICKS_FOR_SCORE ? c.signups / c.landingVisits : null;
    if (share >= 0.3 && c.clicks >= MIN_CLICKS_FOR_SCORE && su !== null && su < 0.02) {
      out.push({ kind: "REDUCE_TYPE", title: `줄일 유형: ${CATEGORY_LABELS[c.key as keyof typeof CATEGORY_LABELS] ?? c.key}`, reason: `콘텐츠의 ${Math.round(share * 100)}%를 차지하지만 가입 전환율이 ${pct(su)}로 낮습니다 (클릭 ${c.clicks}, 방문 ${c.landingVisits}).`, metrics: { share, clicks: c.clicks, signupRate: su }, payload: { category: c.key }, dedupeKey: `REDUCE_TYPE:${c.key}` });
    }
  }
  // 효과 좋은 CTA / 채널
  const bestCta = byCta.filter((c) => c.landingVisits >= MIN_CLICKS_FOR_SCORE).sort((a, b) => b.signups / b.landingVisits - a.signups / a.landingVisits)[0];
  if (bestCta && bestCta.signups > 0) out.push({ kind: "GOOD_CTA", title: `효과 좋은 CTA: "${bestCta.key}"`, reason: `가입 전환율 ${pct(bestCta.signups / bestCta.landingVisits)} (방문 ${bestCta.landingVisits}, 가입 ${bestCta.signups}). 다른 콘텐츠의 CTA로도 사용해 보세요.`, metrics: { signupRate: bestCta.signups / bestCta.landingVisits, landingVisits: bestCta.landingVisits }, payload: { ctaLabel: bestCta.key }, dedupeKey: `GOOD_CTA:${bestCta.key}` });
  const bestCh = byChannel.filter((c) => c.clicks >= MIN_CLICKS_FOR_SCORE).sort((a, b) => b.signups / Math.max(1, b.landingVisits) - a.signups / Math.max(1, a.landingVisits))[0];
  if (bestCh && bestCh.signups > 0) out.push({ kind: "GOOD_CHANNEL", title: `효과 좋은 채널: ${CHANNEL_LABELS[bestCh.key] ?? bestCh.key}`, reason: `클릭 ${bestCh.clicks}, 방문 ${bestCh.landingVisits}, 가입 ${bestCh.signups} (전환율 ${pct(bestCh.signups / Math.max(1, bestCh.landingVisits))}). 이 채널의 게시 빈도를 늘리는 것을 검토하세요.`, metrics: { clicks: bestCh.clicks, signups: bestCh.signups }, payload: { channel: bestCh.key }, dedupeKey: `GOOD_CHANNEL:${bestCh.key}` });
  // 중단: 클릭은 충분한데 가입/활성화 0
  for (const s of bottom) {
    if (s.clicks >= MIN_CLICKS_FOR_SCORE * 4 && s.signups === 0 && s.activations === 0) {
      out.push({ kind: "STOP_CAMPAIGN", title: `성과 낮음: ${s.masterTitle} (${CHANNEL_LABELS[s.channel]})`, reason: `클릭 ${s.clicks}회지만 가입·핵심 기능 사용이 0입니다 (점수 ${s.score}). CTA·랜딩 페이지를 바꾸거나 캠페인을 중단하세요.`, metrics: { clicks: s.clicks, signups: 0, score: s.score }, payload: { channelContentId: s.channelContentId }, dedupeKey: `STOP_CAMPAIGN:${s.channelContentId}` });
    }
  }
  // 데이터 부족: 게시 7일 지났는데 표본 부족
  for (const s of scored) {
    if (s.needsData && s.publishedAt && now.getTime() - new Date(s.publishedAt).getTime() > 7 * 86400_000) {
      out.push({ kind: "NEED_DATA", title: `추가 데이터 필요: ${s.masterTitle} (${CHANNEL_LABELS[s.channel]})`, reason: `게시 후 7일이 지났지만 클릭이 ${s.clicks}회로 점수를 계산할 최소 표본(${MIN_CLICKS_FOR_SCORE}회)에 미달합니다. 판단을 보류하고 노출을 늘리세요.`, metrics: { clicks: s.clicks, required: MIN_CLICKS_FOR_SCORE }, payload: { channelContentId: s.channelContentId }, dedupeKey: `NEED_DATA:${s.channelContentId}` });
    }
  }
  return out;
}

export async function generateRecommendations(workspaceId: string, days = 30) {
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  const weights = parseWeights(ws?.settings);
  const perf = await computePerformance(workspaceId, new Date(Date.now() - days * 86400_000));
  const scored = scoreContents(perf.contents, weights);
  const drafts = buildRecommendations(scored, perf.byChannel, perf.byCategory, perf.byCta);
  const existing = await prisma.recommendation.findMany({ where: { workspaceId, status: { in: ["PENDING", "ACCEPTED"] } } });
  const seen = new Set(existing.map((e) => (e.payload as { dedupeKey?: string })?.dedupeKey ?? ""));
  let created = 0;
  for (const d of drafts) {
    if (seen.has(d.dedupeKey)) continue;
    await prisma.recommendation.create({ data: { workspaceId, kind: d.kind, title: d.title, reason: d.reason, metrics: { ...d.metrics, weights, days } as Prisma.InputJsonValue, payload: { ...d.payload, dedupeKey: d.dedupeKey } as Prisma.InputJsonValue } });
    created++;
  }
  return { created, scored };
}

/** 사용자가 승인한 추천을 실제 행동으로 반영 */
export async function applyRecommendation(workspaceId: string, id: string, userId: string) {
  const rec = await prisma.recommendation.findFirst({ where: { id, workspaceId } });
  if (!rec) throw new Error("추천을 찾을 수 없습니다");
  const payload = rec.payload as Record<string, string>;
  let result = "";
  if (rec.kind === "EXPAND_TOPIC" && payload.topicId) {
    const t = await prisma.contentTopic.findFirst({ where: { id: payload.topicId, workspaceId } });
    if (t) {
      const nt = await prisma.contentTopic.create({ data: { workspaceId, productId: t.productId, title: `${t.title} — 후속`, coreQuestion: t.coreQuestion, targetAudience: t.targetAudience, purpose: `성과가 좋은 소재의 후속 (추천 ${rec.id.slice(0, 6)})`, category: t.category, expectedChannels: t.expectedChannels, evidence: t.evidence as Prisma.InputJsonValue, sources: t.sources as Prisma.InputJsonValue, riskLevel: t.riskLevel, status: "SELECTED", similarContentIds: [t.id], sources_: { create: { type: "MANUAL_INPUT", payload: { fromRecommendation: rec.id } } } } });
      result = `후속 소재 생성: ${nt.id}`;
    }
  } else if (rec.kind === "REUSE" && payload.masterId) {
    const m = await prisma.contentMaster.findFirst({ where: { id: payload.masterId, workspaceId } });
    if (m?.topicId) await prisma.contentTopic.update({ where: { id: m.topicId }, data: { status: "SELECTED" } });
    result = "소재를 다시 선택 상태로 두었습니다. 기준일을 갱신해 새 Master를 만드세요";
  } else if (rec.kind === "STOP_CAMPAIGN" && payload.channelContentId) {
    await prisma.channelContent.updateMany({ where: { id: payload.channelContentId, workspaceId, status: { in: ["SCHEDULED", "APPROVED"] } }, data: { status: "ARCHIVED", scheduledAt: null } });
    await prisma.publishJob.updateMany({ where: { workspaceId, channelContentId: payload.channelContentId, status: "QUEUED" }, data: { status: "CANCELED" } });
    result = "예약·승인 상태였다면 보관 처리했습니다";
  } else if (rec.kind === "REDUCE_TYPE" && payload.category) {
    const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    const settings = (ws?.settings as Record<string, unknown>) ?? {};
    const reduce = new Set<string>(((settings.reduceCategories as string[]) ?? []).concat(payload.category));
    await prisma.workspace.update({ where: { id: workspaceId }, data: { settings: { ...settings, reduceCategories: [...reduce] } as Prisma.InputJsonValue } });
    result = "소재 추천 순서에서 이 유형의 우선순위를 낮춥니다";
  } else {
    result = "확인했습니다 (참고용)";
  }
  await prisma.recommendation.update({ where: { id }, data: { status: "ACCEPTED", metrics: { ...(rec.metrics as object), appliedResult: result, appliedBy: userId, appliedAt: new Date().toISOString() } as Prisma.InputJsonValue } });
  return result;
}
