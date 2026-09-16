"use client";

import { useState } from "react";
import type { BlogBody } from "@/lib/schemas/content";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { BlogPreview } from "@/components/channels/blog-preview";
import { formatForMobile } from "@/lib/blog-format";

export function BlogEditor({ body, onChange }: { body: BlogBody; onChange: (b: BlogBody) => void }) {
  const [b, setB] = useState(body);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const update = (patch: Partial<BlogBody>) => {
    const next = { ...b, ...patch };
    setB(next);
    onChange(next);
  };
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button type="button" size="sm" variant={tab === "edit" ? "default" : "outline"} onClick={() => setTab("edit")}>편집</Button>
        <Button type="button" size="sm" variant={tab === "preview" ? "default" : "outline"} onClick={() => setTab("preview")}>미리보기</Button>
        <Button type="button" size="sm" variant="ghost" className="ml-auto" title="긴 문단을 1~2문장 단위로 나눠 모바일에서 읽기 쉽게 정리합니다" onClick={() => update({ sections: b.sections.map((s) => ({ ...s, markdown: formatForMobile(s.markdown) })), faq: b.faq.map((f) => ({ ...f, a: formatForMobile(f.a) })) })}>모바일 문단 정리</Button>
      </div>
      {tab === "preview" ? (
        <BlogPreview body={b} />
      ) : (
        <div className="space-y-4">
          <div>
            <Label>제목 후보 (클릭해서 선택)</Label>
            <ul className="mt-1 space-y-1">
              {b.titleCandidates.map((t, i) => (
                <li key={i}>
                  <button type="button" onClick={() => update({ title: t })} className={`w-full rounded-md border px-2 py-1 text-left text-sm ${b.title === t ? "border-primary bg-accent" : ""}`}>{t}</button>
                </li>
              ))}
            </ul>
          </div>
          <div><Label htmlFor="b-title">제목</Label><Input id="b-title" value={b.title} onChange={(e) => update({ title: e.target.value })} className="mt-1" /></div>
          <div className="grid gap-3 md:grid-cols-2">
            <div><Label htmlFor="b-intent">검색 의도</Label><Input id="b-intent" value={b.searchIntent} onChange={(e) => update({ searchIntent: e.target.value })} className="mt-1" /></div>
            <div><Label htmlFor="b-thumb">썸네일 문구</Label><Input id="b-thumb" value={b.thumbnailText} onChange={(e) => update({ thumbnailText: e.target.value })} className="mt-1" /></div>
            <div><Label htmlFor="b-tags">태그 (쉼표로 구분, 10개 권장)</Label><Input id="b-tags" value={b.tags.join(", ")} onChange={(e) => update({ tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} className="mt-1" placeholder="배당소득세, 배당주, 재테크, ..." /></div>
          </div>
          <div><Label htmlFor="b-meta">메타 설명 ({b.metaDescription.length}/200)</Label><Textarea id="b-meta" rows={2} value={b.metaDescription} onChange={(e) => update({ metaDescription: e.target.value })} className="mt-1" /></div>
          <div className="space-y-3">
            <Label>본문 섹션 (Markdown)</Label>
            {b.sections.map((s, i) => (
              <div key={i} className="rounded-md border p-3">
                <Input aria-label={`섹션 ${i + 1} 제목`} value={s.heading} onChange={(e) => update({ sections: b.sections.map((x, j) => (j === i ? { ...x, heading: e.target.value } : x)) })} className="mb-2 font-medium" />
                <Textarea aria-label={`섹션 ${i + 1} 본문`} rows={6} value={s.markdown} onChange={(e) => update({ sections: b.sections.map((x, j) => (j === i ? { ...x, markdown: e.target.value } : x)) })} className="font-mono text-sm" />
                <div className="mt-2 flex gap-2">
                  <Button type="button" size="sm" variant="ghost" onClick={() => update({ sections: b.sections.filter((_, j) => j !== i) })} disabled={b.sections.length <= 1}>섹션 삭제</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => update({ sections: [...b.sections.slice(0, i + 1), { heading: "새 섹션", markdown: "" }, ...b.sections.slice(i + 1)] })}>아래에 섹션 추가</Button>
                </div>
              </div>
            ))}
          </div>
          <div>
            <Label>FAQ</Label>
            {b.faq.map((f, i) => (
              <div key={i} className="mt-2 grid gap-2 md:grid-cols-2">
                <Input aria-label={`FAQ ${i + 1} 질문`} value={f.q} onChange={(e) => update({ faq: b.faq.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)) })} />
                <Textarea aria-label={`FAQ ${i + 1} 답변`} rows={2} value={f.a} onChange={(e) => update({ faq: b.faq.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)) })} />
              </div>
            ))}
            <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => update({ faq: [...b.faq, { q: "", a: "" }] })}>FAQ 추가</Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div><Label htmlFor="b-cta">CTA 문구</Label><Input id="b-cta" value={b.cta?.label ?? ""} onChange={(e) => update({ cta: { label: e.target.value, url: b.cta?.url ?? "", strength: b.cta?.strength ?? "low" } })} className="mt-1" /></div>
            <div><Label htmlFor="b-cta-url">CTA URL</Label><Input id="b-cta-url" value={b.cta?.url ?? ""} onChange={(e) => update({ cta: { label: b.cta?.label ?? "", url: e.target.value, strength: b.cta?.strength ?? "low" } })} className="mt-1" /></div>
          </div>
          <div><Label htmlFor="b-disc">면책 표현</Label><Textarea id="b-disc" rows={2} value={b.disclaimer} onChange={(e) => update({ disclaimer: e.target.value })} className="mt-1" /></div>
        </div>
      )}
    </div>
  );
}
