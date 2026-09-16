"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ContentMasterBody, Fact } from "@/lib/schemas/content";
import { updateMasterAction } from "@/server/actions/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useHydrated, hydratedAttr } from "@/lib/use-hydrated";

export function MasterEditor({ slug, masterId, body }: { slug: string; masterId: string; body: ContentMasterBody }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const hydrated = useHydrated();
  const [title, setTitle] = useState(body.title);
  const [summary, setSummary] = useState(body.summary);
  const [asOfDate, setAsOfDate] = useState(body.asOfDate);
  const [cautions, setCautions] = useState(body.cautions.join("\n"));
  const [keyMessages, setKeyMessages] = useState(body.keyMessages.join("\n"));
  const [sources, setSources] = useState(body.sources.map((s) => `${s.name}${s.url ? ` | ${s.url}` : ""}`).join("\n"));
  const [facts, setFacts] = useState<Fact[]>(body.facts);
  const [ctaLabel, setCtaLabel] = useState(body.cta?.label ?? "");
  const [ctaUrl, setCtaUrl] = useState(body.cta?.url ?? "");

  function save() {
    start(async () => {
      const next: ContentMasterBody = {
        title,
        summary,
        asOfDate,
        facts,
        sources: sources.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
          const [name, url] = l.split("|").map((x) => x.trim());
          return { name, url: url ?? "", retrievedAt: asOfDate, note: "" };
        }),
        cautions: cautions.split("\n").map((l) => l.trim()).filter(Boolean),
        keyMessages: keyMessages.split("\n").map((l) => l.trim()).filter(Boolean),
        cta: ctaLabel ? { label: ctaLabel, url: ctaUrl, strength: body.cta?.strength ?? "low" } : null,
      };
      const res = await updateMasterAction(slug, masterId, next);
      if (!res.ok) return void toast.error(Object.values(res.fieldErrors ?? {})[0]?.[0] ?? res.error);
      toast.success(`저장했습니다 (상태: ${res.data.status})`);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Content Master</CardTitle>
        <CardDescription>숫자(facts)는 계산기나 출처에서 온 값만 유지됩니다. 출처가 없는 항목은 표시 값을 지우고 출처를 추가한 뒤 &quot;출처 확인&quot;을 눌러 주세요.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" noValidate {...hydratedAttr(hydrated)} onSubmit={(e) => { e.preventDefault(); save(); }}>
          <div className="grid gap-3 md:grid-cols-[1fr_160px]">
            <div>
              <Label htmlFor="m-title">제목</Label>
              <Input id="m-title" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="m-date">기준일</Label>
              <Input id="m-date" type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <Label htmlFor="m-summary">요약</Label>
            <Textarea id="m-summary" rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>검증된 수치 (facts)</Label>
            <div className="mt-1 overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs">
                  <tr><th className="p-2">항목</th><th className="p-2">표시 값</th><th className="p-2">계산식/가정</th><th className="p-2">출처</th></tr>
                </thead>
                <tbody>
                  {facts.length === 0 && <tr><td colSpan={4} className="p-2 text-muted-foreground">수치 없음</td></tr>}
                  {facts.map((f, i) => (
                    <tr key={f.key} className="border-t align-top">
                      <td className="p-2"><p className="font-medium">{f.label}</p><p className="text-xs text-muted-foreground">{f.key}</p></td>
                      <td className="p-2">
                        {f.needsSource ? (
                          <div className="space-y-1">
                            <Badge variant="destructive">출처 필요</Badge>
                            <Input aria-label={`${f.label} 값`} value={f.display} placeholder="예: 3.5%" onChange={(e) => setFacts(facts.map((x, j) => (j === i ? { ...x, display: e.target.value, value: e.target.value } : x)))} />
                            <Input aria-label={`${f.label} 출처`} value={f.sourceRef} placeholder="출처 (URL 또는 자료명)" onChange={(e) => setFacts(facts.map((x, j) => (j === i ? { ...x, sourceRef: e.target.value } : x)))} />
                            <Button type="button" size="sm" variant="outline" disabled={!f.display || !f.sourceRef} onClick={() => setFacts(facts.map((x, j) => (j === i ? { ...x, needsSource: false } : x)))}>출처 확인</Button>
                            <Button type="button" size="sm" variant="ghost" onClick={() => setFacts(facts.filter((_, j) => j !== i))}>삭제</Button>
                          </div>
                        ) : (
                          <span className="font-mono">{f.display || String(f.value)}</span>
                        )}
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">{f.formula}{f.assumptions.length ? ` · ${f.assumptions.join(", ")}` : ""}</td>
                      <td className="p-2 text-xs text-muted-foreground">{f.sourceRef || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="m-key">핵심 메시지 (줄바꿈)</Label>
              <Textarea id="m-key" rows={4} value={keyMessages} onChange={(e) => setKeyMessages(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="m-cautions">주의사항 (줄바꿈)</Label>
              <Textarea id="m-cautions" rows={4} value={cautions} onChange={(e) => setCautions(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <Label htmlFor="m-sources">출처 (한 줄에 하나, &quot;이름 | URL&quot;)</Label>
            <Textarea id="m-sources" rows={2} value={sources} onChange={(e) => setSources(e.target.value)} className="mt-1" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="m-cta">CTA 문구</Label>
              <Input id="m-cta" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="m-cta-url">CTA URL</Label>
              <Input id="m-cta-url" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} className="mt-1" />
            </div>
          </div>
          <Button type="submit" disabled={pending}>{pending ? "저장 중..." : "저장하고 재검증"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
