"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { rescheduleAction, revokeAction, runDuePublishAction, publishNowAction } from "@/server/actions/publish";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format/date";

type Row = { id: string; status: string; channel: string; title: string; contentStatus: string; contentId: string; masterId: string; scheduledFor: string | null; finishedAt: string | null; externalUrl: string | null; externalId: string | null; lastError: string | null; account: string; logs: string[] };

export function ScheduleList({ slug, jobs, canPublish, dueCount }: { slug: string; jobs: Row[]; canPublish: boolean; dueCount: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [when, setWhen] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) => start(async () => { const r = await fn(); if (!r.ok) return void toast.error(r.error ?? "실패"); toast.success(msg); router.refresh(); });
  return (
    <div className="space-y-3">
      {canPublish && (
        <div className="flex items-center gap-2 text-sm">
          <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => { const r = await runDuePublishAction(slug); if (!r.ok) return void toast.error(r.error); toast.success(`${r.data.processed}건 처리`); router.refresh(); })}>예약 시각 지난 항목 지금 처리{dueCount ? ` (${dueCount})` : ""}</Button>
          <span className="text-xs text-muted-foreground">운영에서는 `npm run worker` 또는 크론이 자동 처리합니다.</span>
        </div>
      )}
      <ul className="space-y-2">
        {jobs.map((j) => (
          <li key={j.id} className="rounded-md border p-3" data-testid="publish-job" data-status={j.status}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant={j.status === "SUCCEEDED" ? "default" : j.status === "FAILED" ? "destructive" : "secondary"}>{j.status}</Badge>
                  <Badge variant="outline">{j.channel}</Badge>
                  <span className="text-xs text-muted-foreground">{j.account}</span>
                </div>
                <p className="mt-1 font-medium"><Link href={`/w/${slug}/content/${j.masterId}/${j.contentId}`} className="hover:underline">{j.title}</Link></p>
                {j.scheduledFor && <p className="text-xs text-primary">예약 {formatDateTime(j.scheduledFor)}</p>}
                {j.finishedAt && <p className="text-xs text-muted-foreground">완료 {formatDateTime(j.finishedAt)}</p>}
                {j.externalUrl && <p className="text-xs">게시물: <a href={j.externalUrl} target="_blank" rel="noreferrer" className="text-primary underline">{j.externalUrl}</a> <span className="text-muted-foreground">(ID {j.externalId})</span></p>}
                {j.lastError && <p className="text-xs text-destructive">{j.lastError}</p>}
              </div>
              <div className="flex flex-col items-end gap-1">
                {j.status === "QUEUED" && canPublish && (
                  <>
                    <div className="flex gap-1">
                      <Input type="datetime-local" aria-label="새 예약 시각" className="h-8 w-52 text-xs" value={when[j.id] ?? ""} onChange={(e) => setWhen({ ...when, [j.id]: e.target.value })} />
                      <Button size="sm" variant="outline" disabled={pending || !when[j.id]} onClick={() => run(() => rescheduleAction(slug, j.contentId, new Date(when[j.id]).toISOString()), "일정을 변경했습니다")}>변경</Button>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" disabled={pending} onClick={() => run(() => publishNowAction(slug, j.contentId), "게시했습니다")}>지금 게시</Button>
                      <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => revokeAction(slug, j.contentId), "예약을 취소했습니다")}>게시 취소</Button>
                    </div>
                  </>
                )}
                {j.status === "FAILED" && canPublish && <Button size="sm" disabled={pending} onClick={() => run(() => publishNowAction(slug, j.contentId), "다시 시도했습니다")}>재시도</Button>}
                <Button size="sm" variant="ghost" onClick={() => setOpen(open === j.id ? null : j.id)}>로그</Button>
              </div>
            </div>
            {open === j.id && <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted p-2 text-xs">{j.logs.join("\n") || "로그 없음"}</pre>}
          </li>
        ))}
      </ul>
    </div>
  );
}
