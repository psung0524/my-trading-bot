"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { generateMasterAction, setTopicStatusAction } from "@/server/actions/content";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/app/status-badge";
import { CATEGORY_LABELS } from "@/server/content/content-mix";
import { SOURCE_TYPE_LABELS, TOPIC_STATUS_LABELS, CHANNEL_LABELS } from "@/lib/labels";

export type TopicRow = {
  id: string;
  title: string;
  coreQuestion: string;
  category: keyof typeof CATEGORY_LABELS;
  status: string;
  sourceType: string;
  riskLevel: string;
  duplicateScore: number;
  expectedChannels: string[];
  masterId: string | null;
  masterStatus: string | null;
};

export function TopicList({ slug, topics }: { slug: string; topics: TopicRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function setStatus(id: string, status: string) {
    start(async () => {
      const res = await setTopicStatusAction(slug, id, status);
      if (!res.ok) return void toast.error(res.error);
      router.refresh();
    });
  }

  function generate(id: string) {
    start(async () => {
      const res = await generateMasterAction(slug, id);
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.data.status === "NEEDS_SOURCE" ? "Master를 만들었지만 출처가 필요한 수치가 있습니다" : "Content Master를 만들었습니다");
      router.push(`/w/${slug}/content/${res.data.masterId}`);
    });
  }

  return (
    <ul className="divide-y rounded-md border">
      {topics.map((t) => (
        <li key={t.id} className="flex flex-col gap-2 p-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline">{TOPIC_STATUS_LABELS[t.status] ?? t.status}</Badge>
              <Badge variant="secondary">{CATEGORY_LABELS[t.category]}</Badge>
              <span className="text-xs text-muted-foreground">{SOURCE_TYPE_LABELS[t.sourceType] ?? t.sourceType}</span>
              {t.riskLevel !== "LOW" && <Badge variant="destructive">위험 {t.riskLevel}</Badge>}
              {t.duplicateScore >= 0.5 && <Badge variant="destructive">중복도 {Math.round(t.duplicateScore * 100)}%</Badge>}
            </div>
            <p className="mt-1 font-medium">{t.title}</p>
            {t.coreQuestion && <p className="text-sm text-muted-foreground">{t.coreQuestion}</p>}
            <p className="mt-1 text-xs text-muted-foreground">예상 채널: {t.expectedChannels.map((c) => CHANNEL_LABELS[c] ?? c).join(", ") || "-"}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {t.masterId ? (
              <>
                {t.masterStatus && <StatusBadge status={t.masterStatus} />}
                <Button asChild size="sm" variant="outline"><Link href={`/w/${slug}/content/${t.masterId}`}>Master 보기</Link></Button>
              </>
            ) : t.status === "SELECTED" ? (
              <>
                <Button size="sm" disabled={pending} onClick={() => generate(t.id)}>Content Master 생성</Button>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => setStatus(t.id, "CANDIDATE")}>선택 해제</Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" disabled={pending} onClick={() => setStatus(t.id, "SELECTED")}>선택</Button>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => setStatus(t.id, "DISMISSED")}>제외</Button>
              </>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
