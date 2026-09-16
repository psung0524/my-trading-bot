"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { acceptRecommendationAction, dismissRecommendationAction, generateRecommendationsAction } from "@/server/actions/recommendations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type RecRow = { id: string; kind: string; title: string; reason: string; status: string; metrics: Record<string, unknown> };

const KIND: Record<string, string> = { EXPAND_TOPIC: "소재 확대", REDUCE_TYPE: "유형 축소", GOOD_CTA: "효과 좋은 CTA", GOOD_CHANNEL: "효과 좋은 채널", REUSE: "재활용", STOP_CAMPAIGN: "중단 검토", NEED_DATA: "추가 데이터 필요" };

export function RecommendationList({ slug, items, canAccept, showGenerate = true }: { slug: string; items: RecRow[]; canAccept: boolean; showGenerate?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      {showGenerate && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => { const r = await generateRecommendationsAction(slug); if (!r.ok) return void toast.error(r.error); toast.success(`추천 ${r.data.created}개 생성`); router.refresh(); })}>성과 분석으로 추천 생성</Button>
      )}
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">아직 추천이 없습니다. 콘텐츠를 게시하고 추적 링크로 유입을 모으면 규칙 기반 추천이 생성됩니다. 표본이 부족하면 &quot;추가 데이터 필요&quot;로 표시됩니다.</p>
      ) : (
        <ul className="space-y-2" data-testid="recommendations">
          {items.map((r) => (
            <li key={r.id} className="rounded-md border p-3" data-kind={r.kind}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><Badge variant={r.kind === "STOP_CAMPAIGN" ? "destructive" : r.kind === "NEED_DATA" ? "outline" : "secondary"}>{KIND[r.kind] ?? r.kind}</Badge><span className="font-medium">{r.title}</span></div>
                  <p className="mt-1 text-sm text-muted-foreground">{r.reason}</p>
                  <p className="mt-1 text-xs text-muted-foreground">사용 지표: {Object.entries(r.metrics).filter(([k]) => !["weights", "days", "appliedResult", "appliedBy", "appliedAt"].includes(k)).map(([k, v]) => `${k}=${typeof v === "number" ? Math.round(v * 1000) / 1000 : String(v)}`).join(", ")}{r.metrics.days ? ` (최근 ${String(r.metrics.days)}일)` : ""}</p>
                  {typeof r.metrics.appliedResult === "string" && <p className="mt-1 text-xs text-primary">반영: {r.metrics.appliedResult}</p>}
                </div>
                {r.status === "PENDING" && (
                  <div className="flex gap-1">
                    {canAccept && <Button size="sm" disabled={pending} onClick={() => start(async () => { const res = await acceptRecommendationAction(slug, r.id); if (!res.ok) return void toast.error(res.error); toast.success(res.data.result); router.refresh(); })}>승인·반영</Button>}
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { const res = await dismissRecommendationAction(slug, r.id); if (!res.ok) return void toast.error(res.error); router.refresh(); })}>무시</Button>
                  </div>
                )}
                {r.status !== "PENDING" && <Badge variant="outline">{r.status === "ACCEPTED" ? "반영됨" : "무시됨"}</Badge>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
