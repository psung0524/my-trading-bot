import type { ChannelType, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { formatForMobile } from "@/lib/blog-format";
import { blogBodySchema, instagramBodySchema, shortsBodySchema, threadsBodySchema, type ContentMasterBody } from "@/lib/schemas/content";
import { getAIProvider } from "@/server/providers/ai";
import type { BatchRequest, GenerateInput } from "@/server/providers/ai/types";
import { resolvePrompt } from "../prompt-registry";
import { loadBrandContext, type BrandContext } from "../brand-context";
import { masterToBody } from "../master";
import { validateChannelBody } from "../validators";
import { audit } from "@/server/security/audit";
import { loadStyleContext } from "../references";

export type ThreadsOptions = { includeLink?: boolean; ctaStrength?: "none" | "low" | "medium" | "high"; lessAdLike?: boolean; /** 생성할 글 수(기본 1). 후킹이 가장 강한 각도 하나로 쓴다 */ count?: number };
export type InstagramOptions = { template?: "magazine" | "number-focus" | "comparison" | "checklist" | "steps" | "schedule"; cardCount?: number };
export type ShortsOptions = { durationSec?: 30 | 45 | 60 };
export type BlogOptions = { targetLength?: 1500 | 2500 | 4000 };
export type GenerateOptions = { threads?: ThreadsOptions; instagram?: InstagramOptions; shorts?: ShortsOptions; blog?: BlogOptions };
/** immediate: 즉시 호출. batch: Message Batches(약 50% 저렴, 결과는 수 분~최대 24시간 뒤, 워커 또는 "지금 확인"으로 회수) */
export type GenerateMode = "immediate" | "batch";

type Ctx = { workspaceId: string; master: { id: string; productId: string }; body: ContentMasterBody; brand: BrandContext; product: { name: string; url: string }; userId?: string };

async function loadCtx(workspaceId: string, masterId: string, userId?: string): Promise<Ctx> {
  const master = await prisma.contentMaster.findFirst({ where: { id: masterId, workspaceId, deletedAt: null }, include: { product: true } });
  if (!master) throw new Error("Content Master를 찾을 수 없습니다");
  if (master.status === "NEEDS_SOURCE") throw new Error("출처가 없는 수치가 있어 채널 콘텐츠를 만들 수 없습니다. Content Master를 먼저 보완하세요");
  const brand = await loadBrandContext(workspaceId, master.productId);
  return { workspaceId, master, body: masterToBody(master), brand, product: { name: master.product.name, url: master.product.url }, userId };
}

function statusFor(blocked: boolean, hasNeedsSource: boolean) {
  if (!blocked) return "NEEDS_REVIEW" as const;
  return hasNeedsSource ? ("NEEDS_SOURCE" as const) : ("NEEDS_REVIEW" as const);
}

async function saveChannelContent(ctx: Ctx, channel: ChannelType, variant: string, title: string, body: unknown, options: Prisma.InputJsonValue, meta: Record<string, unknown>, replaceId?: string) {
  const validation = validateChannelBody(channel, body, ctx.body, ctx.brand.forbiddenPhrases);
  const status = statusFor(validation.blocked, validation.issues.some((i) => i.code === "NEEDS_SOURCE"));
  const validationJson = { ...validation, ...meta } as unknown as Prisma.InputJsonValue;
  const bodyJson = body as Prisma.InputJsonValue;

  if (replaceId) {
    const existing = await prisma.channelContent.findFirst({ where: { id: replaceId, workspaceId: ctx.workspaceId }, select: { currentVersion: true } });
    if (!existing) throw new Error("채널 콘텐츠를 찾을 수 없습니다");
    const nextVersion = existing.currentVersion + 1;
    const updated = await prisma.channelContent.update({
      where: { id: replaceId },
      data: { title, body: bodyJson, status, currentVersion: nextVersion, validation: validationJson, options, versions: { create: { version: nextVersion, body: bodyJson, source: "AI", changeSummary: "재생성" } } },
    });
    return updated;
  }
  return prisma.channelContent.create({
    data: {
      workspaceId: ctx.workspaceId,
      masterId: ctx.master.id,
      channel,
      variant,
      title,
      body: bodyJson,
      status,
      validation: validationJson,
      options,
      versions: { create: { version: 1, body: bodyJson, source: "AI", changeSummary: "AI 생성" } },
    },
  });
}

// ---------- 채널별 준비(prepare) / 마무리(finish) ----------
// prepare: 프롬프트·스키마·컨텍스트를 만든다(DB만 읽음). finish: 모델 결과를 검증·저장한다.
// 즉시 생성은 prepare → provider → finish, 배치는 prepare → submitBatch → (나중에) 재-prepare → finish.

type PromptInfo = Awaited<ReturnType<typeof resolvePrompt>>;
type Meta = { promptVersion: number; provider: string; model: string };

function baseInput<T>(ctx: Ctx, prompt: PromptInfo, schema: z.ZodType<T>, context: Record<string, unknown>, maxTokens?: number): GenerateInput<T> {
  // 공통 규칙 + Master/브랜드/제품은 모든 채널이 공유하므로 캐시 접두사(stableContext)로 보낸다
  return {
    promptKey: prompt.key,
    promptVersion: prompt.version,
    system: prompt.system,
    sharedSystem: prompt.shared,
    user: prompt.user,
    schema,
    schemaName: prompt.schemaName,
    stableContext: { master: ctx.body, brand: ctx.brand, product: ctx.product },
    context: { workspaceId: ctx.workspaceId, ...context },
    maxTokens,
  };
}

/** 출력 다이어트: 프로그램이 채울 수 있는 필드는 모델이 쓰지 않는다 */
const blogAiSchema = blogBodySchema.omit({ toc: true, sources: true, asOfDate: true, disclaimer: true, internalLinks: true, factRefs: true });
const instagramAiSchema = instagramBodySchema.omit({ altTexts: true, colors: true, size: true });
const threadsAiSchema = (count: number) => z.object({ posts: z.array(threadsBodySchema).min(1).max(Math.max(count, 3)) });

async function prepareThreads(ctx: Ctx, opts: ThreadsOptions) {
  const settings = (ctx.brand.channelSettings.threads ?? {}) as ThreadsOptions;
  const count = Math.min(3, Math.max(1, opts.count ?? settings.count ?? 1));
  const options = { includeLink: opts.includeLink ?? settings.includeLink ?? false, ctaStrength: opts.ctaStrength ?? settings.ctaStrength ?? "low", lessAdLike: opts.lessAdLike ?? settings.lessAdLike ?? true, count };
  const prompt = await resolvePrompt("threads.generate", ctx.workspaceId);
  const input = baseInput(ctx, prompt, threadsAiSchema(count), { options, count, countGuide: count === 1 ? "가장 후킹이 강한 각도 하나로 1편만 씁니다(posts 길이 1)." : `서로 다른 포맷으로 ${count}편(posts 길이 ${count}).` });
  return { prompt, options, input };
}

async function finishThreads(ctx: Ctx, data: z.infer<ReturnType<typeof threadsAiSchema>>, options: Awaited<ReturnType<typeof prepareThreads>>["options"], meta: Meta, replaceIds?: Partial<Record<string, string>>) {
  const out = [];
  const { count, ...saved } = options;
  for (const post of data.posts.slice(0, count)) {
    const merged = { ...post, ...saved };
    out.push(await saveChannelContent(ctx, "THREADS", post.variant, `${ctx.body.title} · ${post.variant}`, merged, saved, meta, replaceIds?.[post.variant]));
  }
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.userId, action: "content.generate", entityType: "ChannelContent", entityId: ctx.master.id, meta: { channel: "THREADS", count: out.length } });
  return out;
}

async function prepareInstagram(ctx: Ctx, opts: InstagramOptions) {
  const settings = (ctx.brand.channelSettings.instagram ?? {}) as InstagramOptions;
  const options = { template: opts.template ?? settings.template ?? "magazine", cardCount: opts.cardCount ?? settings.cardCount ?? 8 };
  const prompt = await resolvePrompt("instagram.generate", ctx.workspaceId);
  const input = baseInput(ctx, prompt, instagramAiSchema, { template: options.template, cardCount: options.cardCount });
  return { prompt, options, input };
}

async function finishInstagram(ctx: Ctx, data: z.infer<typeof instagramAiSchema>, options: Awaited<ReturnType<typeof prepareInstagram>>["options"], meta: Meta, replaceId?: string) {
  const cards = data.cards.map((c, i) => ({ ...c, id: c.id || `c${i + 1}` }));
  // altText는 카드 제목·본문에서 자동 생성 (모델 출력 절약)
  const altTexts = cards.map((c) => `${c.title.replace(/\n/g, " ")}${c.value ? ` - ${c.label} ${c.value}` : ""}${c.subtitle ? ` (${c.subtitle})` : ""}${c.body && !c.value ? ` ${c.body.replace(/\n/g, " ").slice(0, 80)}` : ""}`.trim());
  const body = { ...data, cards, altTexts, size: { width: 1080, height: 1350 }, colors: ctx.brand.colors };
  const cc = await saveChannelContent(ctx, "INSTAGRAM", options.template, `${ctx.body.title} · 카드뉴스`, body, options, meta, replaceId);
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.userId, action: "content.generate", entityType: "ChannelContent", entityId: cc.id, meta: { channel: "INSTAGRAM" } });
  return cc;
}

async function prepareBlog(ctx: Ctx, opts: BlogOptions) {
  const settings = (ctx.brand.channelSettings.blog ?? {}) as BlogOptions;
  const targetLength = opts.targetLength ?? settings.targetLength ?? 1500;
  const prompt = await resolvePrompt("blog.generate", ctx.workspaceId);
  const style = await loadStyleContext(ctx.workspaceId, "BLOG", ctx.brand.channelSettings);
  const input = baseInput(ctx, prompt, blogAiSchema, { styleGuide: style.styleGuide, examples: style.examples, targetLength, lengthGuide: `전체 본문 ${targetLength}자 안팎(±20%). 섹션 ${targetLength >= 4000 ? "6~8" : targetLength >= 2500 ? "4~6" : "3~4"}개` }, targetLength >= 4000 ? 16000 : 8192);
  return { prompt, options: { targetLength }, input };
}

async function finishBlog(ctx: Ctx, data: z.infer<typeof blogAiSchema>, options: { targetLength: number }, meta: Meta, replaceId?: string) {
  const sections = data.sections.map((s) => ({ ...s, markdown: formatForMobile(s.markdown) }));
  const body = {
    ...data,
    sections,
    faq: data.faq.map((f) => ({ ...f, a: formatForMobile(f.a) })),
    // 프로그램이 채우는 필드 (출력 다이어트)
    toc: sections.map((s) => s.heading),
    sources: ctx.body.sources,
    asOfDate: ctx.body.asOfDate,
    disclaimer: ctx.brand.financeDisclaimer,
    internalLinks: [] as { label: string; url: string }[],
    factRefs: ctx.body.facts.map((f) => f.key),
  };
  const cc = await saveChannelContent(ctx, "BLOG", "default", body.title, body, options, meta, replaceId);
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.userId, action: "content.generate", entityType: "ChannelContent", entityId: cc.id, meta: { channel: "BLOG" } });
  return cc;
}

async function prepareShorts(ctx: Ctx, opts: ShortsOptions) {
  const settings = (ctx.brand.channelSettings.youtube ?? {}) as ShortsOptions;
  const durationSec = opts.durationSec ?? settings.durationSec ?? 45;
  const prompt = await resolvePrompt("shorts.generate", ctx.workspaceId);
  const input = baseInput(ctx, prompt, shortsBodySchema, { durationSec });
  return { prompt, options: { durationSec }, input };
}

async function finishShorts(ctx: Ctx, data: z.infer<typeof shortsBodySchema>, options: { durationSec: 30 | 45 | 60 }, meta: Meta, replaceId?: string) {
  const cc = await saveChannelContent(ctx, "YOUTUBE_SHORTS", `${options.durationSec}s`, `${ctx.body.title} · Shorts`, { ...data, durationSec: options.durationSec }, options, meta, replaceId);
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.userId, action: "content.generate", entityType: "ChannelContent", entityId: cc.id, meta: { channel: "YOUTUBE_SHORTS" } });
  return cc;
}

function metaOf(promptVersion: number, res: { provider: string; model: string }): Meta {
  return { promptVersion, provider: res.provider, model: res.model };
}

// ---------- 즉시 생성 ----------

export async function generateThreads(workspaceId: string, masterId: string, opts: ThreadsOptions = {}, userId?: string, replaceIds?: Partial<Record<string, string>>) {
  const ctx = await loadCtx(workspaceId, masterId, userId);
  const p = await prepareThreads(ctx, opts);
  const res = await getAIProvider().generateStructured(p.input);
  return finishThreads(ctx, res.data, p.options, metaOf(p.prompt.version, res), replaceIds);
}

export async function generateInstagram(workspaceId: string, masterId: string, opts: InstagramOptions = {}, userId?: string, replaceId?: string) {
  const ctx = await loadCtx(workspaceId, masterId, userId);
  const p = await prepareInstagram(ctx, opts);
  const res = await getAIProvider().generateStructured(p.input);
  return finishInstagram(ctx, res.data, p.options, metaOf(p.prompt.version, res), replaceId);
}

export async function generateBlog(workspaceId: string, masterId: string, userId?: string, replaceId?: string, opts: BlogOptions = {}) {
  const ctx = await loadCtx(workspaceId, masterId, userId);
  const p = await prepareBlog(ctx, opts);
  const res = await getAIProvider().generateStructured(p.input);
  return finishBlog(ctx, res.data, p.options, metaOf(p.prompt.version, res), replaceId);
}

export async function generateShorts(workspaceId: string, masterId: string, opts: ShortsOptions = {}, userId?: string, replaceId?: string) {
  const ctx = await loadCtx(workspaceId, masterId, userId);
  const p = await prepareShorts(ctx, opts);
  const res = await getAIProvider().generateStructured(p.input);
  return finishShorts(ctx, res.data, p.options, metaOf(p.prompt.version, res), replaceId);
}

export async function generateAllChannels(workspaceId: string, masterId: string, channels: ChannelType[], options: GenerateOptions = {}, userId?: string) {
  const results: Record<string, string[]> = {};
  const errors: Record<string, string> = {};
  const run = async (channel: ChannelType, fn: () => Promise<string[]>) => {
    try {
      results[channel] = await fn();
    } catch (e) {
      errors[channel] = e instanceof Error ? e.message : String(e);
      console.error(`채널 생성 실패 ${channel}`, e);
    }
  };
  if (channels.includes("THREADS")) await run("THREADS", async () => (await generateThreads(workspaceId, masterId, options.threads, userId)).map((c) => c.id));
  if (channels.includes("INSTAGRAM")) await run("INSTAGRAM", async () => [(await generateInstagram(workspaceId, masterId, options.instagram, userId)).id]);
  if (channels.includes("BLOG")) await run("BLOG", async () => [(await generateBlog(workspaceId, masterId, userId, undefined, options.blog)).id]);
  if (channels.includes("YOUTUBE_SHORTS")) await run("YOUTUBE_SHORTS", async () => [(await generateShorts(workspaceId, masterId, options.shorts, userId)).id]);
  if (Object.keys(results).length === 0) {
    throw new Error(Object.entries(errors).map(([c, m]) => `${c}: ${m}`).join(" / ") || "생성된 채널이 없습니다");
  }
  return { ...results, _errors: Object.entries(errors).map(([c, m]) => `${c}: ${m}`) };
}

// ---------- 배치 생성 (Message Batches) ----------

async function prepareAll(ctx: Ctx, channels: ChannelType[], options: GenerateOptions) {
  const items: { channel: ChannelType; customId: string; prepared: Awaited<ReturnType<typeof prepareThreads>> | Awaited<ReturnType<typeof prepareInstagram>> | Awaited<ReturnType<typeof prepareBlog>> | Awaited<ReturnType<typeof prepareShorts>> }[] = [];
  if (channels.includes("THREADS")) items.push({ channel: "THREADS", customId: "THREADS", prepared: await prepareThreads(ctx, options.threads ?? {}) });
  if (channels.includes("INSTAGRAM")) items.push({ channel: "INSTAGRAM", customId: "INSTAGRAM", prepared: await prepareInstagram(ctx, options.instagram ?? {}) });
  if (channels.includes("BLOG")) items.push({ channel: "BLOG", customId: "BLOG", prepared: await prepareBlog(ctx, options.blog ?? {}) });
  if (channels.includes("YOUTUBE_SHORTS")) items.push({ channel: "YOUTUBE_SHORTS", customId: "YOUTUBE_SHORTS", prepared: await prepareShorts(ctx, options.shorts ?? {}) });
  return items;
}

/** 배치 제출. Provider가 배치를 지원하지 않으면 null을 돌려주고 호출자는 즉시 생성으로 대체한다 */
export async function submitChannelBatch(workspaceId: string, masterId: string, channels: ChannelType[], options: GenerateOptions = {}, userId?: string): Promise<{ batchId: string; channels: ChannelType[] } | null> {
  const provider = getAIProvider();
  if (!provider.submitBatch) return null;
  const ctx = await loadCtx(workspaceId, masterId, userId);
  const items = await prepareAll(ctx, channels, options);
  if (!items.length) throw new Error("생성할 채널이 없습니다");
  const requests: BatchRequest[] = items.map((it) => ({ customId: it.customId, input: it.prepared.input as GenerateInput<unknown> }));
  const { batchId } = await provider.submitBatch(requests);
  await audit({ workspaceId, userId, action: "content.generate.batch", entityType: "ContentMaster", entityId: masterId, meta: { batchId, channels } });
  return { batchId, channels: items.map((i) => i.channel) };
}

/** 배치 결과 회수. 아직 끝나지 않았으면 { ended:false } */
export async function collectChannelBatch(workspaceId: string, masterId: string, batchId: string, channels: ChannelType[], options: GenerateOptions = {}, userId?: string) {
  const provider = getAIProvider();
  if (!provider.fetchBatch) throw new Error("현재 AI Provider는 배치를 지원하지 않습니다");
  const status = await provider.fetchBatch(batchId);
  if (!status.ended) return { ended: false as const, counts: status.counts };
  const ctx = await loadCtx(workspaceId, masterId, userId);
  const items = await prepareAll(ctx, channels, options);
  const results: Record<string, string[]> = {};
  const errors: string[] = [];
  const { recordAiUsage } = await import("@/server/providers/ai/usage");
  for (const it of items) {
    const r = status.results?.find((x) => x.customId === it.customId);
    if (!r) { errors.push(`${it.channel}: 배치 결과 없음`); continue; }
    if (!r.ok) { errors.push(`${it.channel}: ${r.error}`); continue; }
    const parsed = it.prepared.input.schema.safeParse(r.raw);
    if (!parsed.success) { errors.push(`${it.channel}: 스키마 불일치 ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`); continue; }
    if (r.usage) await recordAiUsage({ workspaceId, promptKey: it.prepared.input.promptKey, provider: provider.name, model: r.model, ...r.usage, batch: true });
    const meta: Meta = { promptVersion: it.prepared.prompt.version, provider: provider.name, model: r.model };
    try {
      if (it.channel === "THREADS") results.THREADS = (await finishThreads(ctx, parsed.data as z.infer<ReturnType<typeof threadsAiSchema>>, (it.prepared as Awaited<ReturnType<typeof prepareThreads>>).options, meta)).map((c) => c.id);
      else if (it.channel === "INSTAGRAM") results.INSTAGRAM = [(await finishInstagram(ctx, parsed.data as z.infer<typeof instagramAiSchema>, (it.prepared as Awaited<ReturnType<typeof prepareInstagram>>).options, meta)).id];
      else if (it.channel === "BLOG") results.BLOG = [(await finishBlog(ctx, parsed.data as z.infer<typeof blogAiSchema>, (it.prepared as Awaited<ReturnType<typeof prepareBlog>>).options, meta)).id];
      else results.YOUTUBE_SHORTS = [(await finishShorts(ctx, parsed.data as z.infer<typeof shortsBodySchema>, (it.prepared as Awaited<ReturnType<typeof prepareShorts>>).options, meta)).id];
    } catch (e) {
      errors.push(`${it.channel}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { ended: true as const, results, _errors: errors };
}
