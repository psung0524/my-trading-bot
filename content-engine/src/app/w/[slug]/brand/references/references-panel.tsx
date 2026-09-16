"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { StyleGuide } from "@/server/content/references";
import { addReferencePasteAction, analyzeStyleAction, deleteReferenceAction, importReferenceUrlsAction, saveStyleGuideAction } from "@/server/actions/references";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useHydrated, hydratedAttr } from "@/lib/use-hydrated";
import { formatDateTime } from "@/lib/format/date";

type Ref = { id: string; title: string; url: string; source: string; note: string; length: number; preview: string };

const EMPTY: StyleGuide = { voice: "", sentence: "", opening: "", structure: "", closing: "", formatting: "", vocabulary: [], avoid: [], sampleSentences: [], summary: "" };

export function ReferencesPanel({ slug, productId, channel, refs, guide, guideMeta }: { slug: string; productId: string; channel: string; refs: Ref[]; guide: StyleGuide | null; guideMeta: { updatedAt: string | null; source: string | null } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const hydrated = useHydrated();
  const [urls, setUrls] = useState("");
  const [paste, setPaste] = useState({ title: "", content: "", note: "" });
  const [g, setG] = useState<StyleGuide>(guide ?? EMPTY);
  const [errors, setErrors] = useState<string[]>([]);

  return (
    <div className="space-y-6" {...hydratedAttr(hydrated)} data-references>
      <Card>
        <CardHeader>
          <CardTitle>글 주소로 가져오기</CardTitle>
          <CardDescription>한 줄에 하나씩. 티스토리·워드프레스·네이버 블로그(blog.naver.com/아이디/글번호) 글 주소를 넣으면 본문을 가져옵니다. 못 가져오면 아래에 붙여 넣으세요.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea aria-label="글 주소 목록" rows={4} value={urls} onChange={(e) => setUrls(e.target.value)} placeholder={"https://blog.naver.com/아이디/글번호\nhttps://example.tistory.com/123"} />
          <Button disabled={pending || !urls.trim()} onClick={() => start(async () => { const r = await importReferenceUrlsAction(slug, productId, channel, urls); if (!r.ok) return void toast.error(r.error); setErrors(r.data.errors); toast[r.data.imported ? "success" : "warning"](`${r.data.imported}개 가져옴${r.data.errors.length ? `, ${r.data.errors.length}개 실패` : ""}`); if (r.data.imported) setUrls(""); router.refresh(); })}>{pending ? "가져오는 중..." : "가져오기"}</Button>
          {errors.length > 0 && <ul className="space-y-1 text-xs text-destructive">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>직접 붙여 넣기</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-2" noValidate onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await addReferencePasteAction(slug, productId, channel, paste); if (!r.ok) return void toast.error(r.error); toast.success("등록했습니다"); setPaste({ title: "", content: "", note: "" }); router.refresh(); }); }}>
            <div className="grid gap-2 md:grid-cols-2">
              <div><Label htmlFor="ref-title">제목 (선택)</Label><Input id="ref-title" value={paste.title} onChange={(e) => setPaste({ ...paste, title: e.target.value })} className="mt-1" /></div>
              <div><Label htmlFor="ref-note">메모 (예: 조회수 높았던 글)</Label><Input id="ref-note" value={paste.note} onChange={(e) => setPaste({ ...paste, note: e.target.value })} className="mt-1" /></div>
            </div>
            <div><Label htmlFor="ref-content">본문</Label><Textarea id="ref-content" rows={8} value={paste.content} onChange={(e) => setPaste({ ...paste, content: e.target.value })} className="mt-1" /></div>
            <Button type="submit" variant="outline" disabled={pending || paste.content.trim().length < 100}>등록</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>등록된 참고 글 ({refs.length})</CardTitle>
          <CardDescription>생성 시 최신 3개가 예문으로 들어갑니다. 문체 분석은 최대 8개를 사용합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          {refs.length === 0 ? <p className="text-sm text-muted-foreground">아직 없습니다.</p> : (
            <ul className="divide-y rounded-md border text-sm">
              {refs.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-2 p-2" data-testid="reference-item">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.title || "(제목 없음)"} <Badge variant="outline">{r.source}</Badge> <span className="text-xs text-muted-foreground">{r.length.toLocaleString("ko-KR")}자</span></p>
                    {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="block truncate text-xs text-primary underline">{r.url}</a>}
                    <p className="line-clamp-2 text-xs text-muted-foreground">{r.preview}</p>
                    {r.note && <p className="text-xs">메모: {r.note}</p>}
                  </div>
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { const x = await deleteReferenceAction(slug, r.id); if (!x.ok) return void toast.error(x.error); router.refresh(); })}>삭제</Button>
                </li>
              ))}
            </ul>
          )}
          <Button className="mt-3" disabled={pending || refs.length === 0} onClick={() => start(async () => { const r = await analyzeStyleAction(slug, productId, channel); if (!r.ok) return void toast.error(r.error); setG(r.data); toast.success("문체 가이드를 만들었습니다"); router.refresh(); })}>{pending ? "분석 중..." : "참고 글로 문체 분석"}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>문체 가이드</CardTitle>
          <CardDescription>{guideMeta.updatedAt ? `${formatDateTime(guideMeta.updatedAt)} · ${guideMeta.source ?? ""}` : "아직 없습니다. 참고 글을 등록하고 분석하거나 직접 적어도 됩니다."} 생성할 때 이 가이드가 브랜드 말투보다 우선 적용됩니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" noValidate onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await saveStyleGuideAction(slug, productId, channel, g); if (!r.ok) return void toast.error(r.error); toast.success("저장했습니다"); router.refresh(); }); }}>
            {([["voice", "화자·말투"], ["sentence", "문장 길이·종결어미"], ["opening", "도입 방식"], ["structure", "구성(소제목·문단·표)"], ["closing", "마무리"], ["formatting", "서식 습관(굵게·이모지·줄바꿈)"]] as const).map(([k, label]) => (
              <div key={k}><Label htmlFor={`sg-${k}`}>{label}</Label><Textarea id={`sg-${k}`} rows={2} value={g[k]} onChange={(e) => setG({ ...g, [k]: e.target.value })} className="mt-1" /></div>
            ))}
            <div><Label htmlFor="sg-vocab">자주 쓰는 표현 (쉼표 구분)</Label><Input id="sg-vocab" value={g.vocabulary.join(", ")} onChange={(e) => setG({ ...g, vocabulary: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} className="mt-1" /></div>
            <div><Label htmlFor="sg-avoid">피하는 표현·태도 (쉼표 구분)</Label><Input id="sg-avoid" value={g.avoid.join(", ")} onChange={(e) => setG({ ...g, avoid: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} className="mt-1" /></div>
            <div><Label htmlFor="sg-samples">문체가 드러나는 예시 문장 (줄바꿈)</Label><Textarea id="sg-samples" rows={3} value={g.sampleSentences.join("\n")} onChange={(e) => setG({ ...g, sampleSentences: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean) })} className="mt-1" /></div>
            <div><Label htmlFor="sg-summary">한 줄 요약</Label><Input id="sg-summary" value={g.summary} onChange={(e) => setG({ ...g, summary: e.target.value })} className="mt-1" /></div>
            <Button type="submit" variant="outline" disabled={pending}>가이드 저장</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
