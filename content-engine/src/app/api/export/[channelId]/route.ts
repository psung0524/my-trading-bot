import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/auth";
import { blogBodySchema, instagramBodySchema, shortsBodySchema, threadsBodySchema } from "@/lib/schemas/content";
import { blogToMarkdown } from "@/components/channels/blog-preview";
import { escapeHtml, renderMarkdown } from "@/lib/markdown";

/** 채널 콘텐츠 내보내기: md | html | naver(복사용 페이지) | txt */
export async function GET(req: Request, ctx: RouteContext<"/api/export/[channelId]">) {
  const { channelId } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  const cc = await prisma.channelContent.findFirst({ where: { id: channelId, deletedAt: null, workspace: { members: { some: { userId: user.id } } } }, include: { master: { include: { product: true } } } });
  if (!cc) return NextResponse.json({ error: "찾을 수 없음" }, { status: 404 });
  const format = new URL(req.url).searchParams.get("format") ?? "txt";
  const base = `${cc.master.title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 60)}-${cc.channel.toLowerCase()}`;
  const file = (name: string, body: string, type: string, inline = false) =>
    new NextResponse(body, { headers: { "content-type": type, ...(inline ? {} : { "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}` }) } });

  if (cc.channel === "BLOG") {
    const b = blogBodySchema.parse(cc.body);
    const md = blogToMarkdown(b);
    if (format === "md") return file(`${base}.md`, md, "text/markdown; charset=utf-8");
    const html = renderMarkdown(md);
    if (format === "html") {
      const doc = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${escapeHtml(b.title)}</title><meta name="description" content="${escapeHtml(b.metaDescription)}"></head><body>${html}</body></html>`;
      return file(`${base}.html`, doc, "text/html; charset=utf-8");
    }
    if (format === "naver") {
      const doc = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${escapeHtml(b.title)} - 복사용</title><style>body{max-width:760px;margin:40px auto;font-family:sans-serif;line-height:1.7;padding:0 16px}table{border-collapse:collapse}td,th{border:1px solid #ddd;padding:6px 10px}.note{background:#fffbe6;border:1px solid #f0d000;padding:12px;border-radius:8px;font-size:14px}</style></head><body><div class="note">네이버 블로그는 자동 게시하지 않습니다. 아래 본문을 전체 선택(Ctrl+A) → 복사(Ctrl+C)해서 붙여 넣고, 이미지는 콘텐츠 화면에서 내려받아 첨부하세요.</div><hr/>${html}</body></html>`;
      return file(`${base}.html`, doc, "text/html; charset=utf-8", true);
    }
    return file(`${base}.txt`, md, "text/plain; charset=utf-8");
  }
  if (cc.channel === "THREADS") {
    const b = threadsBodySchema.parse(cc.body);
    return file(`${base}-${cc.variant}.txt`, b.text, "text/plain; charset=utf-8");
  }
  if (cc.channel === "INSTAGRAM") {
    const b = instagramBodySchema.parse(cc.body);
    return file(`${base}-caption.txt`, `${b.caption}\n\n${b.hashtags.join(" ")}\n\n[ALT]\n${b.altTexts.map((a, i) => `${i + 1}. ${a}`).join("\n")}`, "text/plain; charset=utf-8");
  }
  const b = shortsBodySchema.parse(cc.body);
  const txt = [`[제목 후보]`, ...b.titleCandidates, "", `[Hook] ${b.hook}`, "", ...b.scenes.map((s) => `#${s.index + 1} (${s.startSec}s-${s.endSec}s)\n내레이션: ${s.narration}\n화면: ${s.onScreenText}\n장면: ${s.description}`), "", `[CTA] ${b.cta}`, "", `[설명]`, b.description, "", b.hashtags.join(" ")].join("\n");
  return file(`${base}-script.txt`, txt, "text/plain; charset=utf-8");
}
