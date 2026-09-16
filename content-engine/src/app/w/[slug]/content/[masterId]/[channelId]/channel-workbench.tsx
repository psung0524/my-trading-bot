"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { BlogBody, InstagramBody, ShortsBody, ThreadsBody, ValidationIssue } from "@/lib/schemas/content";
import { archiveContentAction, regenerateContentAction, renderContentAction, saveContentAction } from "@/server/actions/edit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ValidationList } from "@/components/app/validation-list";
import { ThreadsEditor } from "@/components/editors/threads-editor";
import { InstagramEditor } from "@/components/editors/instagram-editor";
import { BlogEditor } from "@/components/editors/blog-editor";
import { ShortsEditor } from "@/components/editors/shorts-editor";
import { RenderStatus } from "@/components/editors/render-status";
import { useHydrated, hydratedAttr } from "@/lib/use-hydrated";

export type AssetRow = { id: string; kind: string; url: string; filename: string; sizeBytes: number; meta: Record<string, unknown> };
export type RenderRow = { id: string; status: string; step: string; progress: number; lastError: string | null; createdAt: string };

type Props = {
  slug: string;
  masterId: string;
  channelContentId: string;
  channel: "THREADS" | "INSTAGRAM" | "BLOG" | "YOUTUBE_SHORTS";
  body: ThreadsBody | InstagramBody | BlogBody | ShortsBody;
  brandName: string;
  status: string;
  issues: ValidationIssue[];
  assets: AssetRow[];
  latestRender: RenderRow | null;
  canEdit: boolean;
  masterNeedsSource: boolean;
};

export function ChannelWorkbench(p: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const hydrated = useHydrated();
  const [draft, setDraft] = useState<Props["body"]>(p.body);
  const [dirty, setDirty] = useState(false);
  const [blogLength, setBlogLength] = useState("2500");
  const locked = p.status === "PUBLISHED" || p.status === "PUBLISHING";
  const renderable = p.channel !== "THREADS";

  const onChange = (b: Props["body"]) => {
    setDraft(b);
    setDirty(true);
  };

  function save() {
    start(async () => {
      const res = await saveContentAction(p.slug, p.channelContentId, draft);
      if (!res.ok) return void toast.error(res.error);
      setDirty(false);
      toast[res.data.validation.blocked ? "warning" : "success"](res.data.validation.blocked ? `v${res.data.version} 저장. 검증 이슈가 있어 승인할 수 없습니다` : `v${res.data.version} 저장했습니다`);
      router.refresh();
    });
  }
  function regenerate() {
    start(async () => {
      const opts = p.channel === "THREADS" ? { threads: { includeLink: (draft as ThreadsBody).includeLink, ctaStrength: (draft as ThreadsBody).ctaStrength, lessAdLike: (draft as ThreadsBody).lessAdLike } } : p.channel === "INSTAGRAM" ? { instagram: { template: (draft as InstagramBody).template } } : p.channel === "YOUTUBE_SHORTS" ? { shorts: { durationSec: (draft as ShortsBody).durationSec } } : p.channel === "BLOG" ? { blog: { targetLength: Number(blogLength) } } : {};
      const res = await regenerateContentAction(p.slug, p.channelContentId, opts);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`v${res.data.version}으로 재생성했습니다`);
      router.refresh();
      window.location.reload();
    });
  }
  function render() {
    start(async () => {
      if (dirty) {
        const s = await saveContentAction(p.slug, p.channelContentId, draft);
        if (!s.ok) return void toast.error(s.error);
        setDirty(false);
      }
      const res = await renderContentAction(p.slug, p.channelContentId);
      if (!res.ok) return void toast.error(res.error);
      toast.success("렌더링을 시작했습니다");
      router.refresh();
    });
  }

  const selfCheck = (p.body as { selfCheck?: { item: string; pass: boolean }[] }).selfCheck ?? [];
  return (
    <div className="space-y-6" {...hydratedAttr(hydrated)} data-workbench>
      <Card>
        <CardHeader>
          <CardTitle>검증 결과</CardTitle>
          <CardDescription>저장할 때마다 Content Master와의 숫자 일치, 금융 안전 검사, 금지 표현을 다시 검사합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ValidationList issues={p.issues} emptyText="Content Master와 일치하며 안전 검사를 통과했습니다." />
          {selfCheck.length > 0 && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm" data-self-check>
              <div className="mb-1 text-xs font-medium text-muted-foreground">AI 셀프 체크 (플랫폼 규칙)</div>
              <ul className="space-y-0.5">
                {selfCheck.map((c, i) => (
                  <li key={i} className={c.pass ? "" : "text-destructive"}>{c.pass ? "O" : "X"} {c.item}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>편집</CardTitle>
          {locked && <CardDescription>게시된 콘텐츠는 수정할 수 없습니다.</CardDescription>}
        </CardHeader>
        <CardContent>
          <fieldset disabled={locked || !p.canEdit} className="min-w-0">
            {p.channel === "THREADS" && <ThreadsEditor body={p.body as ThreadsBody} brandName={p.brandName} onChange={onChange} />}
            {p.channel === "INSTAGRAM" && <InstagramEditor body={p.body as InstagramBody} brandName={p.brandName} onChange={onChange} />}
            {p.channel === "BLOG" && <BlogEditor body={p.body as BlogBody} onChange={onChange} />}
            {p.channel === "YOUTUBE_SHORTS" && <ShortsEditor body={p.body as ShortsBody} onChange={onChange} />}
          </fieldset>
          {p.canEdit && !locked && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={save} disabled={pending || !dirty}>{pending ? "처리 중..." : "저장 (새 버전)"}</Button>
              {p.channel === "BLOG" && (
                <select aria-label="재생성 길이" className="h-9 rounded-md border bg-background px-2 text-sm" value={blogLength} onChange={(e) => setBlogLength(e.target.value)}>
                  <option value="1500">약 1,500자</option><option value="2500">약 2,500자</option><option value="4000">약 4,000자</option>
                </select>
              )}
              <Button variant="outline" onClick={regenerate} disabled={pending}>{p.channel === "THREADS" ? "이 옵션으로 재생성" : "AI로 재생성"}</Button>
              {renderable && <Button variant="secondary" onClick={render} disabled={pending || p.masterNeedsSource}>{p.channel === "INSTAGRAM" ? "PNG 렌더링" : p.channel === "BLOG" ? "썸네일 생성" : "MP4 렌더링"}</Button>}
              <Button variant="ghost" onClick={() => start(async () => { const r = await archiveContentAction(p.slug, p.channelContentId); if (!r.ok) return void toast.error(r.error); toast.success("보관했습니다"); router.push(`/w/${p.slug}/content/${p.masterId}`); })} disabled={pending}>보관</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {(renderable || p.assets.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>결과물</CardTitle>
            <CardDescription>{p.channel === "INSTAGRAM" ? "1080x1350 PNG와 전체 ZIP" : p.channel === "YOUTUBE_SHORTS" ? "1080x1920 MP4, 자막(SRT), 썸네일" : "썸네일 이미지"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {p.latestRender && <RenderStatus slug={p.slug} renderJobId={p.latestRender.id} initial={p.latestRender} />}
            {p.assets.length === 0 ? (
              <p className="text-sm text-muted-foreground">아직 렌더링된 결과물이 없습니다.</p>
            ) : (
              <ul className="grid gap-2 text-sm md:grid-cols-2">
                {p.assets.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{a.filename}</p>
                      <p className="text-xs text-muted-foreground">{a.kind} · {(a.sizeBytes / 1024).toFixed(0)} KB{a.meta.overflow ? " · ⚠ 텍스트 오버플로" : ""}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {(a.kind.endsWith("PNG") || a.kind === "BLOG_THUMBNAIL" || a.kind === "VIDEO_THUMBNAIL" || a.kind === "VIDEO_MP4") && <Button asChild size="sm" variant="ghost"><a href={a.url} target="_blank" rel="noreferrer">보기</a></Button>}
                      <Button asChild size="sm" variant="outline"><a href={`${a.url}?download=1`}>다운로드</a></Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>내보내기</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-sm">
          {p.channel === "BLOG" && (
            <>
              <Button asChild variant="outline" size="sm"><a href={`/api/export/${p.channelContentId}?format=md`}>Markdown 다운로드</a></Button>
              <Button asChild variant="outline" size="sm"><a href={`/api/export/${p.channelContentId}?format=html`}>HTML 다운로드</a></Button>
              <Button asChild variant="outline" size="sm"><a href={`/api/export/${p.channelContentId}?format=naver`} target="_blank" rel="noreferrer">네이버 블로그용 복사 페이지</a></Button>
            </>
          )}
          {p.channel === "THREADS" && <Button asChild variant="outline" size="sm"><a href={`/api/export/${p.channelContentId}?format=txt`}>텍스트 다운로드</a></Button>}
          {p.channel === "INSTAGRAM" && <Button asChild variant="outline" size="sm"><a href={`/api/export/${p.channelContentId}?format=txt`}>캡션·해시태그 다운로드</a></Button>}
          {p.channel === "YOUTUBE_SHORTS" && <Button asChild variant="outline" size="sm"><a href={`/api/export/${p.channelContentId}?format=txt`}>대본·설명 다운로드</a></Button>}
          <Button asChild variant="ghost" size="sm"><Link href={`/w/${p.slug}/inbox`}>승인함에서 승인하기</Link></Button>
        </CardContent>
      </Card>
    </div>
  );
}
