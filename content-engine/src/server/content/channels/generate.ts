import type { ChannelType, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { blogBodySchema, instagramBodySchema, shortsBodySchema, threadsBodySchema, type ContentMasterBody } from "@/lib/schemas/content";
import { getAIProvider } from "@/server/providers/ai";
import { resolvePrompt } from "../prompt-registry";
import { loadBrandContext, type BrandContext } from "../brand-context";
import { masterToBody } from "../master";
import { validateChannelBody } from "../validators";
import { audit } from "@/server/security/audit";
import { loadStyleContext } from "../references";

export type ThreadsOptions = { includeLink?: boolean; ctaStrength?: "none" | "low" | "medium" | "high"; lessAdLike?: boolean };
export type InstagramOptions = { template?: "number-focus" | "comparison" | "checklist" | "steps" | "schedule"; cardCount?: number };
export type ShortsOptions = { durationSec?: 30 | 45 | 60 };
export type GenerateOptions = { threads?: ThreadsOptions; instagram?: InstagramOptions; shorts?: ShortsOptions };

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

export async function generateThreads(workspaceId: string, masterId: string, opts: ThreadsOptions = {}, userId?: string, replaceIds?: Partial<Record<string, string>>) {
  const ctx = await loadCtx(workspaceId, masterId, userId);
  const settings = (ctx.brand.channelSettings.threads ?? {}) as ThreadsOptions;
  const options = { includeLink: opts.includeLink ?? settings.includeLink ?? true, ctaStrength: opts.ctaStrength ?? settings.ctaStrength ?? "low", lessAdLike: opts.lessAdLike ?? settings.lessAdLike ?? true };
  const prompt = await resolvePrompt("threads.generate", workspaceId);
  const schema = z.object({ posts: z.array(threadsBodySchema).length(3) });
  const res = await getAIProvider().generateStructured({ promptKey: prompt.key, promptVersion: prompt.version, system: prompt.system, user: prompt.user, schema, schemaName: prompt.schemaName, context: { master: ctx.body, brand: ctx.brand, product: ctx.product, options } });
  const out = [];
  for (const post of res.data.posts) {
    const merged = { ...post, ...options };
    out.push(await saveChannelContent(ctx, "THREADS", post.variant, `${ctx.body.title} · ${post.variant}`, merged, options, { promptVersion: prompt.version, provider: res.provider, model: res.model }, replaceIds?.[post.variant]));
  }
  await audit({ workspaceId, userId, action: "content.generate", entityType: "ChannelContent", entityId: masterId, meta: { channel: "THREADS", count: out.length } });
  return out;
}

export async function generateInstagram(workspaceId: string, masterId: string, opts: InstagramOptions = {}, userId?: string, replaceId?: string) {
  const ctx = await loadCtx(workspaceId, masterId, userId);
  const settings = (ctx.brand.channelSettings.instagram ?? {}) as InstagramOptions;
  const options = { template: opts.template ?? settings.template ?? "number-focus", cardCount: opts.cardCount ?? settings.cardCount ?? 6 };
  const prompt = await resolvePrompt("instagram.generate", workspaceId);
  const res = await getAIProvider().generateStructured({ promptKey: prompt.key, promptVersion: prompt.version, system: prompt.system, user: prompt.user, schema: instagramBodySchema, schemaName: prompt.schemaName, context: { master: ctx.body, brand: ctx.brand, product: ctx.product, template: options.template, cardCount: options.cardCount } });
  const body = { ...res.data, colors: ctx.brand.colors, cards: res.data.cards.map((c, i) => ({ ...c, id: c.id || `c${i + 1}` })) };
  const cc = await saveChannelContent(ctx, "INSTAGRAM", options.template, `${ctx.body.title} · 카드뉴스`, body, options, { promptVersion: prompt.version, provider: res.provider, model: res.model }, replaceId);
  await audit({ workspaceId, userId, action: "content.generate", entityType: "ChannelContent", entityId: cc.id, meta: { channel: "INSTAGRAM" } });
  return cc;
}

export async function generateBlog(workspaceId: string, masterId: string, userId?: string, replaceId?: string) {
  const ctx = await loadCtx(workspaceId, masterId, userId);
  const prompt = await resolvePrompt("blog.generate", workspaceId);
  const style = await loadStyleContext(workspaceId, "BLOG", ctx.brand.channelSettings);
  const res = await getAIProvider().generateStructured({ promptKey: prompt.key, promptVersion: prompt.version, system: prompt.system, user: prompt.user, schema: blogBodySchema, schemaName: prompt.schemaName, context: { master: ctx.body, brand: ctx.brand, product: ctx.product, styleGuide: style.styleGuide, examples: style.examples }, maxTokens: 8192 });
  const body = { ...res.data, asOfDate: ctx.body.asOfDate, disclaimer: res.data.disclaimer || ctx.brand.financeDisclaimer, sources: res.data.sources.length ? res.data.sources : ctx.body.sources };
  const cc = await saveChannelContent(ctx, "BLOG", "default", body.title, body, {}, { promptVersion: prompt.version, provider: res.provider, model: res.model }, replaceId);
  await audit({ workspaceId, userId, action: "content.generate", entityType: "ChannelContent", entityId: cc.id, meta: { channel: "BLOG" } });
  return cc;
}

export async function generateShorts(workspaceId: string, masterId: string, opts: ShortsOptions = {}, userId?: string, replaceId?: string) {
  const ctx = await loadCtx(workspaceId, masterId, userId);
  const settings = (ctx.brand.channelSettings.youtube ?? {}) as ShortsOptions;
  const durationSec = opts.durationSec ?? settings.durationSec ?? 45;
  const prompt = await resolvePrompt("shorts.generate", workspaceId);
  const res = await getAIProvider().generateStructured({ promptKey: prompt.key, promptVersion: prompt.version, system: prompt.system, user: prompt.user, schema: shortsBodySchema, schemaName: prompt.schemaName, context: { master: ctx.body, brand: ctx.brand, product: ctx.product, durationSec } });
  const cc = await saveChannelContent(ctx, "YOUTUBE_SHORTS", `${durationSec}s`, `${ctx.body.title} · Shorts`, { ...res.data, durationSec }, { durationSec }, { promptVersion: prompt.version, provider: res.provider, model: res.model }, replaceId);
  await audit({ workspaceId, userId, action: "content.generate", entityType: "ChannelContent", entityId: cc.id, meta: { channel: "YOUTUBE_SHORTS" } });
  return cc;
}

export async function generateAllChannels(workspaceId: string, masterId: string, channels: ChannelType[], options: GenerateOptions = {}, userId?: string) {
  const results: Record<string, string[]> = {};
  if (channels.includes("THREADS")) results.THREADS = (await generateThreads(workspaceId, masterId, options.threads, userId)).map((c) => c.id);
  if (channels.includes("INSTAGRAM")) results.INSTAGRAM = [(await generateInstagram(workspaceId, masterId, options.instagram, userId)).id];
  if (channels.includes("BLOG")) results.BLOG = [(await generateBlog(workspaceId, masterId, userId)).id];
  if (channels.includes("YOUTUBE_SHORTS")) results.YOUTUBE_SHORTS = [(await generateShorts(workspaceId, masterId, options.shorts, userId)).id];
  return results;
}
