import type { ChannelType, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { assertPublicUrl } from "@/server/providers/analyzer/html";
import { getAIProvider } from "@/server/providers/ai";
import { resolvePrompt } from "./prompt-registry";
import { audit } from "@/server/security/audit";

const MAX_BYTES = 2_000_000;
const MAX_CONTENT = 12_000;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36";

function decode(s: string) {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/** HTML에서 본문 텍스트를 뽑는다. <article> 또는 가장 긴 텍스트 블록을 우선한다 */
export function extractArticleText(html: string): { title: string; text: string } {
  const cleaned = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<!--[\s\S]*?-->/g, "");
  const title = decode(cleaned.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim().replace(/\s*[:|-]\s*네이버 블로그$/, "");
  const candidates: string[] = [];
  const pick = (re: RegExp) => {
    for (const m of cleaned.matchAll(re)) candidates.push(m[1]);
  };
  pick(/<div[^>]+class="[^"]*se-main-container[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi); // 네이버 스마트에디터
  pick(/<article[^>]*>([\s\S]*?)<\/article>/gi);
  pick(/<div[^>]+(?:class|id)="[^"]*(?:post-content|entry-content|article-body|tt_article_useless_p_margin|contents_style|post_ct|article_view)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<div|<footer|<section|$)/gi);
  pick(/<main[^>]*>([\s\S]*?)<\/main>/gi);
  pick(/<body[^>]*>([\s\S]*?)<\/body>/gi);
  const toText = (h: string) =>
    decode(
      h
        .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)[^>]*>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/[ \t]+/g, " ")
        .replace(/\n\s*\n\s*\n+/g, "\n\n"),
    ).trim();
  let best = "";
  for (const c of candidates) {
    const t = toText(c);
    if (t.length > best.length) best = t;
    if (best.length > 1500 && candidates.indexOf(c) < 3) break;
  }
  return { title, text: best.slice(0, MAX_CONTENT) };
}

/** 네이버 블로그 글 주소를 서버 렌더 페이지(PostView)로 바꾼다 */
export function normalizeReferenceUrl(raw: string): string {
  const u = new URL(raw);
  if (/(^|\.)blog\.naver\.com$/.test(u.hostname)) {
    const m = u.pathname.match(/^\/([A-Za-z0-9_-]+)\/(\d+)/);
    const blogId = m?.[1] ?? u.searchParams.get("blogId");
    const logNo = m?.[2] ?? u.searchParams.get("logNo");
    if (blogId && logNo) return `https://blog.naver.com/PostView.naver?blogId=${blogId}&logNo=${logNo}`;
  }
  return u.toString();
}

async function fetchHtml(url: string, signal: AbortSignal): Promise<string> {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(current, { signal, redirect: "manual", headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml", "accept-language": "ko-KR,ko;q=0.9" } });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = (await assertPublicUrl(new URL(res.headers.get("location")!, current).toString())).toString();
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer()).subarray(0, MAX_BYTES).toString("utf8");
  }
  throw new Error("리다이렉트가 너무 많습니다");
}

/** 네이버 블로그: 모바일 페이지가 서버 렌더 본문을 주므로 PostView가 짧으면 폴백 */
function naverMobileUrl(raw: string): string | null {
  const u = new URL(raw);
  if (!/(^|\.)blog\.naver\.com$/.test(u.hostname)) return null;
  const m = u.pathname.match(/^\/([A-Za-z0-9_-]+)\/(\d+)/);
  const blogId = m?.[1] ?? u.searchParams.get("blogId");
  const logNo = m?.[2] ?? u.searchParams.get("logNo");
  return blogId && logNo ? `https://m.blog.naver.com/${blogId}/${logNo}` : null;
}

export async function fetchReference(rawUrl: string): Promise<{ title: string; text: string; url: string }> {
  const url = normalizeReferenceUrl(rawUrl);
  await assertPublicUrl(url);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    let best = extractArticleText(await fetchHtml(url, ctrl.signal));
    const mobile = naverMobileUrl(rawUrl);
    if (best.text.length < 300 && mobile) {
      try {
        const alt = extractArticleText(await fetchHtml(mobile, ctrl.signal));
        if (alt.text.length > best.text.length) best = alt;
      } catch {
        /* 모바일 폴백 실패는 무시 */
      }
    }
    if (best.text.length < 200) throw new Error("본문을 찾지 못했습니다(200자 미만). 글을 직접 붙여 넣어 주세요");
    return { title: best.title, text: best.text, url: rawUrl };
  } finally {
    clearTimeout(timer);
  }
}

export async function addReference(workspaceId: string, input: { productId?: string | null; channel: ChannelType; title: string; content: string; url?: string; source: "URL" | "PASTE"; note?: string }, userId?: string) {
  const ref = await prisma.referencePost.create({ data: { workspaceId, productId: input.productId ?? null, channel: input.channel, title: input.title.slice(0, 200), content: input.content.slice(0, MAX_CONTENT), url: input.url ?? "", source: input.source, note: input.note ?? "" } });
  await audit({ workspaceId, userId, action: "reference.add", entityType: "ReferencePost", entityId: ref.id, meta: { channel: input.channel, source: input.source } });
  return ref;
}

export async function listReferences(workspaceId: string, channel: ChannelType) {
  return prisma.referencePost.findMany({ where: { workspaceId, channel, deletedAt: null }, orderBy: { createdAt: "desc" } });
}

export const styleGuideSchema = z.object({
  voice: z.string().default(""),
  sentence: z.string().default(""),
  opening: z.string().default(""),
  structure: z.string().default(""),
  closing: z.string().default(""),
  formatting: z.string().default(""),
  vocabulary: z.array(z.string()).default([]),
  avoid: z.array(z.string()).default([]),
  /// 짧은 예시 문장 (참고 글에서 인용, 각 60자 이내)
  sampleSentences: z.array(z.string()).default([]),
  summary: z.string().default(""),
});
export type StyleGuide = z.infer<typeof styleGuideSchema>;

/** 참고 글들에서 문체 가이드를 뽑아 BrandProfile.channelSettings[channel].styleGuide에 저장 */
export async function analyzeStyle(workspaceId: string, productId: string, channel: ChannelType, userId?: string) {
  const refs = await listReferences(workspaceId, channel);
  if (refs.length === 0) throw new Error("참고 글이 없습니다. 먼저 글을 등록하세요");
  const product = await prisma.product.findFirst({ where: { id: productId, workspaceId, deletedAt: null }, include: { brandProfile: true } });
  if (!product?.brandProfile) throw new Error("브랜드 프로필이 없습니다");
  const prompt = await resolvePrompt("style.analyze", workspaceId);
  const posts = refs.slice(0, 8).map((r) => ({ title: r.title, note: r.note, content: r.content.slice(0, 4000) }));
  const res = await getAIProvider().generateStructured({ promptKey: prompt.key, promptVersion: prompt.version, system: prompt.system, user: prompt.user, schema: styleGuideSchema, schemaName: prompt.schemaName, context: { channel, posts } });
  const settings = (product.brandProfile.channelSettings ?? {}) as Record<string, Record<string, unknown>>;
  const key = channelKey(channel);
  const next = { ...settings, [key]: { ...(settings[key] ?? {}), styleGuide: res.data, styleGuideUpdatedAt: new Date().toISOString(), styleGuideSource: `${refs.length}개 참고 글` } };
  await prisma.brandProfile.update({ where: { id: product.brandProfile.id }, data: { channelSettings: next as Prisma.InputJsonValue } });
  await audit({ workspaceId, userId, action: "style.analyze", entityType: "BrandProfile", entityId: product.brandProfile.id, meta: { channel, posts: refs.length } });
  return res.data;
}

export async function saveStyleGuide(workspaceId: string, productId: string, channel: ChannelType, guide: StyleGuide) {
  const product = await prisma.product.findFirst({ where: { id: productId, workspaceId, deletedAt: null }, include: { brandProfile: true } });
  if (!product?.brandProfile) throw new Error("브랜드 프로필이 없습니다");
  const settings = (product.brandProfile.channelSettings ?? {}) as Record<string, Record<string, unknown>>;
  const key = channelKey(channel);
  await prisma.brandProfile.update({ where: { id: product.brandProfile.id }, data: { channelSettings: { ...settings, [key]: { ...(settings[key] ?? {}), styleGuide: guide, styleGuideUpdatedAt: new Date().toISOString(), styleGuideSource: "직접 수정" } } as Prisma.InputJsonValue } });
}

export function channelKey(channel: ChannelType): string {
  return { THREADS: "threads", INSTAGRAM: "instagram", BLOG: "blog", YOUTUBE_SHORTS: "youtube" }[channel];
}

/** 생성 컨텍스트용: 문체 가이드 + 예문(최신 3개, 각 2,500자) */
export async function loadStyleContext(workspaceId: string, channel: ChannelType, channelSettings: Record<string, Record<string, unknown>>) {
  const guide = styleGuideSchema.safeParse(channelSettings[channelKey(channel)]?.styleGuide);
  const refs = await prisma.referencePost.findMany({ where: { workspaceId, channel, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 3 });
  return {
    styleGuide: guide.success ? guide.data : null,
    examples: refs.map((r) => ({ title: r.title, note: r.note, excerpt: r.content.slice(0, 2500) })),
  };
}
