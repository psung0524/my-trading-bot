"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ProductAnalysis } from "@/lib/schemas/product";
import { analyzeProductAction, saveManualAnalysisAction } from "@/server/actions/product";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useHydrated, hydratedAttr } from "@/lib/use-hydrated";

export function AnalysisPanel({
  slug,
  productId,
  analysis,
  analyzedAt,
}: {
  slug: string;
  productId: string;
  analysis: ProductAnalysis | null;
  analyzedAt: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const hydrated = useHydrated();
  const [features, setFeatures] = useState(analysis?.features.join("\n") ?? "");
  const [keywords, setKeywords] = useState(analysis?.keywords.join(", ") ?? "");
  const [audience, setAudience] = useState(analysis?.audience ?? "");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await analyzeProductAction(slug, productId);
              if (!res.ok) return void toast.error(res.error);
              setFeatures(res.data.features.join("\n"));
              setKeywords(res.data.keywords.join(", "));
              setAudience(res.data.audience);
              toast[res.data.error ? "warning" : "success"](res.data.error ?? "분석을 완료했습니다");
              router.refresh();
            })
          }
        >
          {pending ? "분석 중..." : "페이지 분석 실행"}
        </Button>
        {analyzedAt && (
          <span className="text-xs text-muted-foreground">
            마지막 분석 {new Date(analyzedAt).toLocaleString("ko-KR")} · 방식 <Badge variant="outline">{analysis?.method ?? "-"}</Badge>
          </span>
        )}
      </div>
      {analysis?.error && <p className="text-sm text-amber-700">{analysis.error}</p>}
      {analysis && (analysis.title || analysis.description) && (
        <div className="rounded-md border p-3 text-sm">
          <p className="font-medium">{analysis.title}</p>
          <p className="text-muted-foreground">{analysis.description}</p>
          {analysis.pages.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">발견한 페이지: {analysis.pages.map((p) => p.path).join(", ")}</p>
          )}
        </div>
      )}
      <form
        className="space-y-3"
        noValidate
        {...hydratedAttr(hydrated)}
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await saveManualAnalysisAction(slug, productId, { features, keywords, audience });
            if (!res.ok) return void toast.error(res.error);
            toast.success("제품 정보를 저장했습니다");
            router.refresh();
          });
        }}
      >
        <div>
          <Label htmlFor="features">핵심 기능 (줄바꿈으로 구분)</Label>
          <Textarea id="features" rows={4} value={features} onChange={(e) => setFeatures(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="keywords">키워드 (쉼표로 구분)</Label>
          <Input id="keywords" value={keywords} onChange={(e) => setKeywords(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="audience">주요 사용자</Label>
          <Input id="audience" value={audience} onChange={(e) => setAudience(e.target.value)} className="mt-1" />
        </div>
        <div className="flex gap-2">
          <Button type="submit" variant="outline" disabled={pending}>
            직접 입력 저장
          </Button>
          <Button asChild>
            <Link href={`/w/${slug}/brand?product=${productId}`}>다음: 브랜드 프로필</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
