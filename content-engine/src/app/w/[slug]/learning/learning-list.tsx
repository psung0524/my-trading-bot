"use client";

import { formatDate } from "@/lib/format/date";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { setLearningStatusAction } from "@/server/actions/learning";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Item = { id: string; pattern: string; description: string; status: string; channel: string | null; evidence: Record<string, unknown>; updatedAt: string };

export function LearningList({ slug, items }: { slug: string; items: Item[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const set = (id: string, status: "ACCEPTED" | "DELETED" | "PENDING") =>
    start(async () => {
      const r = await setLearningStatusAction(slug, id, status);
      if (!r.ok) return void toast.error(r.error);
      router.refresh();
    });
  if (items.length === 0) return <p className="text-sm text-muted-foreground">아직 학습 항목이 없습니다. 채널 콘텐츠를 직접 수정해 저장하면 여기에 제안이 쌓입니다.</p>;
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.id} className="rounded-md border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium">{i.description}</p>
              <p className="text-xs text-muted-foreground">{i.pattern}{i.channel ? ` · ${i.channel}` : ""} · 관측 {String(i.evidence.count ?? 1)}회 · {formatDate(i.updatedAt)}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={i.status === "ACCEPTED" ? "default" : "secondary"}>{i.status === "ACCEPTED" ? "반영 중" : "확인 대기"}</Badge>
              {i.status !== "ACCEPTED" && <Button size="sm" disabled={pending} onClick={() => set(i.id, "ACCEPTED")}>반영</Button>}
              {i.status === "ACCEPTED" && <Button size="sm" variant="outline" disabled={pending} onClick={() => set(i.id, "PENDING")}>반영 해제</Button>}
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => set(i.id, "DELETED")}>삭제</Button>
            </div>
          </div>
          {typeof i.evidence.beforeSample === "string" && (
            <details className="mt-2 text-xs text-muted-foreground">
              <summary>근거 보기</summary>
              <p className="mt-1"><span className="font-medium">원본:</span> {String(i.evidence.beforeSample).slice(0, 200)}</p>
              <p className="mt-1"><span className="font-medium">수정:</span> {String(i.evidence.afterSample).slice(0, 200)}</p>
            </details>
          )}
        </li>
      ))}
    </ul>
  );
}
