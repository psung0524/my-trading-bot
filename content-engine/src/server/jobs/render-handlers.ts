import type { AssetKind, Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { registerJob, type JobContext } from "./registry";
import { getStorage } from "@/server/providers/storage";
import { blogBodySchema, instagramBodySchema, shortsBodySchema } from "@/lib/schemas/content";
import { renderAllCards, zipCards } from "@/server/render/cardnews/render";
import { renderShorts } from "@/server/render/shorts/pipeline";
import { renderThumbnail } from "@/server/render/thumbnail";
import { loadBrandContext } from "@/server/content/brand-context";
import { audit } from "@/server/security/audit";

type RenderPayload = { renderJobId: string; workspaceId: string };

async function begin(payload: RenderPayload, ctx: JobContext) {
  const job = await prisma.renderJob.findFirst({ where: { id: payload.renderJobId, workspaceId: payload.workspaceId }, include: { channelContent: { include: { master: { include: { product: true } } } } } });
  if (!job) throw new Error("RenderJob 없음");
  if (job.status === "CANCELED") throw new Error("취소된 작업");
  await prisma.renderJob.update({ where: { id: job.id }, data: { status: "PROCESSING", attempts: { increment: 1 }, startedAt: new Date(), progress: 0, step: "시작", lastError: null } });
  const brand = await loadBrandContext(job.workspaceId, job.channelContent.master.productId);
  const logs: string[] = [];
  const log = (m: string) => {
    logs.push(`[${new Date().toISOString()}] ${m}`);
    ctx.log(m);
  };
  const step = async (s: string, progress: number) => {
    log(`${s} (${progress}%)`);
    await prisma.renderJob.update({ where: { id: job.id }, data: { step: s, progress } });
  };
  return { job, brand, logs, log, step, cc: job.channelContent, product: job.channelContent.master.product };
}

async function putAsset(workspaceId: string, channelContentId: string, version: number, filename: string, data: Buffer, kind: AssetKind, extra: { width?: number; height?: number; durationMs?: number; meta?: Prisma.InputJsonValue } = {}) {
  const key = `ws/${workspaceId}/content/${channelContentId}/v${version}/${filename}`;
  const mime = filename.endsWith(".png") ? "image/png" : filename.endsWith(".mp4") ? "video/mp4" : filename.endsWith(".zip") ? "application/zip" : filename.endsWith(".srt") ? "text/plain" : filename.endsWith(".wav") ? "audio/wav" : "application/octet-stream";
  await getStorage().put(key, data, mime);
  // 같은 키의 이전 자산은 대체
  await prisma.creativeAsset.updateMany({ where: { storageKey: key, deletedAt: null }, data: { deletedAt: new Date() } });
  return prisma.creativeAsset.create({ data: { workspaceId, channelContentId, kind, storageKey: key, mimeType: mime, sizeBytes: data.length, width: extra.width, height: extra.height, durationMs: extra.durationMs, meta: extra.meta ?? {} } });
}

async function finish(jobId: string, workspaceId: string, assetIds: string[], logs: string[]) {
  await prisma.renderJob.update({ where: { id: jobId }, data: { status: "SUCCEEDED", progress: 100, step: "완료", finishedAt: new Date(), resultAssetIds: assetIds, logs } });
  await audit({ workspaceId, action: "render.succeeded", entityType: "RenderJob", entityId: jobId, meta: { assets: assetIds.length } });
}

async function failed(jobId: string, e: unknown, logs: string[]) {
  const msg = e instanceof Error ? e.message : String(e);
  logs.push(`[${new Date().toISOString()}] 실패: ${msg}`);
  await prisma.renderJob.update({ where: { id: jobId }, data: { status: "FAILED", step: "실패", lastError: msg.slice(0, 2000), finishedAt: new Date(), logs } });
}

registerJob("render.cardnews", async (payload, ctx) => {
  const p = payload as RenderPayload;
  const { job, brand, logs, step, cc, product } = await begin(p, ctx);
  try {
    const body = instagramBodySchema.parse(cc.body);
    await step("카드 렌더링", 5);
    const cards = await renderAllCards({ ...body, colors: body.colors ?? brand.colors }, brand.brandName || product.name, (i) => step(`카드 ${i}/${body.cards.length}`, 5 + Math.round((i / body.cards.length) * 70)));
    await step("ZIP 생성", 80);
    const zip = await zipCards(cards, `${body.caption}\n\n${body.hashtags.join(" ")}`);
    const assetIds: string[] = [];
    for (const c of cards) {
      const a = await putAsset(p.workspaceId, cc.id, cc.currentVersion, `card-${String(c.index + 1).padStart(2, "0")}.png`, c.png, "CARD_PNG", { width: body.size.width, height: body.size.height, meta: { index: c.index, overflow: c.overflow, alt: body.altTexts[c.index] ?? "" } });
      assetIds.push(a.id);
    }
    const z = await putAsset(p.workspaceId, cc.id, cc.currentVersion, "cards.zip", zip, "CARD_ZIP", { meta: { count: cards.length } });
    assetIds.push(z.id);
    const overflowIdx = cards.filter((c) => c.overflow).map((c) => c.index + 1);
    if (overflowIdx.length) logs.push(`텍스트 오버플로 감지: 카드 ${overflowIdx.join(", ")}`);
    await finish(job.id, p.workspaceId, assetIds, logs);
    return { assetIds, overflow: overflowIdx };
  } catch (e) {
    await failed(job.id, e, logs);
    throw e;
  }
});

registerJob("render.thumbnail", async (payload, ctx) => {
  const p = payload as RenderPayload;
  const { job, brand, logs, step, cc, product } = await begin(p, ctx);
  try {
    const body = blogBodySchema.parse(cc.body);
    await step("썸네일 렌더링", 20);
    const png = await renderThumbnail(body.thumbnailText || body.title, brand.brandName || product.name, brand.colors, { width: 1200, height: 630 }, `기준일 ${body.asOfDate}`);
    const a = await putAsset(p.workspaceId, cc.id, cc.currentVersion, "thumbnail.png", png, "BLOG_THUMBNAIL", { width: 1200, height: 630 });
    await finish(job.id, p.workspaceId, [a.id], logs);
    return { assetIds: [a.id] };
  } catch (e) {
    await failed(job.id, e, logs);
    throw e;
  }
});

registerJob("render.shorts", async (payload, ctx) => {
  const p = payload as RenderPayload;
  const { job, brand, logs, step, cc, product } = await begin(p, ctx);
  try {
    if (cc.master.status === "NEEDS_SOURCE") throw new Error("Content Master에 출처가 없는 수치가 있습니다");
    const body = shortsBodySchema.parse(cc.body);
    const out = await renderShorts({ body, brandName: brand.brandName || product.name, colors: brand.colors, bgmPath: process.env.SHORTS_BGM_PATH || undefined, onStep: (s, pr) => void step(s, pr) });
    const assetIds: string[] = [];
    const v = await putAsset(p.workspaceId, cc.id, cc.currentVersion, "shorts.mp4", out.mp4, "VIDEO_MP4", { width: 1080, height: 1920, durationMs: out.totalMs, meta: { scenes: out.scenes.map((s) => ({ index: s.index, startSec: s.startSec, endSec: s.endSec, audioMs: s.audioMs })) } });
    assetIds.push(v.id);
    assetIds.push((await putAsset(p.workspaceId, cc.id, cc.currentVersion, "subtitles.srt", Buffer.from(out.srt, "utf8"), "SUBTITLE")).id);
    assetIds.push((await putAsset(p.workspaceId, cc.id, cc.currentVersion, "voice.wav", out.audio, "TTS_AUDIO", { durationMs: out.totalMs })).id);
    assetIds.push((await putAsset(p.workspaceId, cc.id, cc.currentVersion, "thumbnail.png", out.thumbnail, "VIDEO_THUMBNAIL", { width: 1080, height: 1920 })).id);
    for (let i = 0; i < out.sceneImages.length; i++) assetIds.push((await putAsset(p.workspaceId, cc.id, cc.currentVersion, `scene-${String(i + 1).padStart(2, "0")}.png`, out.sceneImages[i], "SCENE_PNG", { width: 1080, height: 1920, meta: { index: i } })).id);
    // 조정된 타이밍을 본문에 반영
    const adjusted = { ...body, scenes: out.scenes.map((s) => ({ index: s.index, startSec: s.startSec, endSec: s.endSec, narration: s.narration, onScreenText: s.onScreenText, description: s.description, subtitle: s.subtitle, factRefs: s.factRefs })) };
    await prisma.channelContent.update({ where: { id: cc.id }, data: { body: adjusted as unknown as Prisma.InputJsonValue } });
    await finish(job.id, p.workspaceId, assetIds, logs);
    return { assetIds, totalMs: out.totalMs };
  } catch (e) {
    await failed(job.id, e, logs);
    throw e;
  }
});
