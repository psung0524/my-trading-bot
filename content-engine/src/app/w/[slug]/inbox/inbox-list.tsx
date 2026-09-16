"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { approveAction, publishNowAction, rejectAction, reopenAction, revokeAction } from "@/server/actions/publish";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/app/status-badge";
import { CHANNEL_LABELS, THREADS_VARIANT_LABELS } from "@/lib/labels";
import { formatDateTime } from "@/lib/format/date";
import { useHydrated, hydratedAttr } from "@/lib/use-hydrated";

export type InboxRow = {
  id: string; masterId: string; masterTitle: string; masterNeedsSource: boolean; channel: string; variant: string; title: string; status: string; version: number; scheduledAt: string | null; blocked: boolean; issueCount: number; snippet: string;
  lastApproval: { decision: string; version: number; by: string; at: string } | null; lastError: string | null;
};
type Account = { id: string; channel: string; provider: string; displayName: string; isMock: boolean };

const GROUPS: { key: string; label: string; statuses: string[] }[] = [
  { key: "review", label: "검토 필요", statuses: ["NEEDS_REVIEW", "NEEDS_SOURCE"] },
  { key: "approved", label: "승인됨 · 예약됨", statuses: ["APPROVED", "SCHEDULED"] },
  { key: "problem", label: "실패 · 거부", statuses: ["FAILED", "REJECTED"] },
];

export function InboxList({ slug, items, accounts, canApprove, canPublish }: { slug: string; items: InboxRow[]; accounts: Account[]; canApprove: boolean; canPublish: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const hydrated = useHydrated();
  const [schedule, setSchedule] = useState<Record<string, string>>({});
  const [account, setAccount] = useState<Record<string, string>>({});

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error ?? "실패");
      toast.success(okMsg);
      router.refresh();
    });

  if (items.length === 0) return <p className="text-sm text-muted-foreground">검토할 콘텐츠가 없습니다.</p>;

  return (
    <div className="space-y-6" {...hydratedAttr(hydrated)} data-inbox>
      {GROUPS.map((g) => {
        const rows = items.filter((i) => g.statuses.includes(i.status));
        if (rows.length === 0) return null;
        return (
          <section key={g.key}>
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{g.label} ({rows.length})</h2>
            <ul className="space-y-2">
              {rows.map((i) => {
                const accts = accounts.filter((a) => a.channel === i.channel);
                const selectedAccount = account[i.id] ?? accts[0]?.id ?? "";
                return (
                  <li key={i.id} className="rounded-md border p-3" data-testid="inbox-item" data-status={i.status}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge status={i.status} />
                          <Badge variant="outline">{CHANNEL_LABELS[i.channel]}{i.channel === "THREADS" ? ` · ${THREADS_VARIANT_LABELS[i.variant] ?? i.variant}` : ""}</Badge>
                          <span className="text-xs text-muted-foreground">v{i.version}</span>
                          {i.blocked && <Badge variant="destructive">검증 실패 {i.issueCount}건</Badge>}
                          {!i.blocked && i.issueCount > 0 && <Badge variant="secondary">경고 {i.issueCount}건</Badge>}
                        </div>
                        <p className="mt-1 font-medium"><Link href={`/w/${slug}/content/${i.masterId}/${i.id}`} className="hover:underline">{i.masterTitle}</Link></p>
                        <p className="line-clamp-2 text-sm text-muted-foreground">{i.snippet}</p>
                        {i.lastApproval && <p className="mt-1 text-xs text-muted-foreground">{i.lastApproval.decision === "APPROVED" ? "승인" : i.lastApproval.decision === "REJECTED" ? "거부" : "승인 취소"}: {i.lastApproval.by} · v{i.lastApproval.version} · {formatDateTime(i.lastApproval.at)}</p>}
                        {i.scheduledAt && <p className="text-xs text-primary">예약: {formatDateTime(i.scheduledAt)}</p>}
                        {i.lastError && <p className="mt-1 text-xs text-destructive">최근 게시 오류: {i.lastError}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {(i.status === "NEEDS_REVIEW" || i.status === "NEEDS_SOURCE") && canApprove && (
                          <>
                            <div className="flex flex-wrap items-center gap-1">
                              <Input type="datetime-local" aria-label="예약 시각" className="h-8 w-52 text-xs" value={schedule[i.id] ?? ""} onChange={(e) => setSchedule({ ...schedule, [i.id]: e.target.value })} />
                              {accts.length > 1 && (
                                <select aria-label="게시 계정" className="h-8 rounded-md border bg-background px-2 text-xs" value={selectedAccount} onChange={(e) => setAccount({ ...account, [i.id]: e.target.value })}>
                                  {accts.map((a) => <option key={a.id} value={a.id}>{a.displayName}</option>)}
                                </select>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              <Button size="sm" disabled={pending || i.blocked || i.masterNeedsSource} onClick={() => run(() => approveAction(slug, i.id, { scheduledAt: schedule[i.id] ? new Date(schedule[i.id]).toISOString() : null, channelAccountId: selectedAccount || null }), schedule[i.id] ? "예약했습니다" : "승인했습니다")}>{schedule[i.id] ? "승인 + 예약" : "승인"}</Button>
                              <Button size="sm" variant="outline" disabled={pending || i.blocked || i.masterNeedsSource || Boolean(schedule[i.id])} onClick={() => run(() => approveAction(slug, i.id, { publishNow: true, channelAccountId: selectedAccount || null }), "승인 후 게시했습니다")}>승인 + 바로 게시</Button>
                              <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => rejectAction(slug, i.id), "거부했습니다")}>거부</Button>
                            </div>
                          </>
                        )}
                        {(i.status === "APPROVED" || i.status === "SCHEDULED") && (
                          <div className="flex flex-wrap gap-1">
                            {canPublish && <Button size="sm" disabled={pending} onClick={() => run(() => publishNowAction(slug, i.id, selectedAccount || null), "게시했습니다")}>{i.status === "SCHEDULED" ? "지금 게시" : "게시"}</Button>}
                            {canApprove && <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => revokeAction(slug, i.id), "승인을 취소했습니다")}>승인 취소</Button>}
                          </div>
                        )}
                        {(i.status === "FAILED" || i.status === "REJECTED") && (
                          <div className="flex flex-wrap gap-1">
                            {i.status === "FAILED" && canPublish && <Button size="sm" disabled={pending} onClick={() => run(() => publishNowAction(slug, i.id, selectedAccount || null), "다시 게시했습니다")}>다시 게시</Button>}
                            <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => reopenAction(slug, i.id), "다시 검토 상태로 돌렸습니다")}>다시 검토</Button>
                          </div>
                        )}
                        <Button asChild size="sm" variant="link" className="h-auto p-0 text-xs"><Link href={`/w/${slug}/content/${i.masterId}/${i.id}`}>열어서 수정</Link></Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
