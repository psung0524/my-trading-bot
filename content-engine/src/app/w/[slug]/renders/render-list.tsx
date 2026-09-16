"use client";

import { formatDateTime } from "@/lib/format/date";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { retryRenderAction } from "@/server/actions/edit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RenderStatus } from "@/components/editors/render-status";

type Row = { id: string; kind: string; status: string; step: string; progress: number; lastError: string | null; attempts: number; createdAt: string; logs: string[]; title: string; channelLabel: string; href: string };

const KIND: Record<string, string> = { CARDNEWS: "카드뉴스 PNG", SHORTS: "Shorts MP4", BLOG_THUMBNAIL: "블로그 썸네일" };

export function RenderList({ slug, jobs }: { slug: string; jobs: Row[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <ul className="space-y-3">
      {jobs.map((j) => (
        <li key={j.id} className="rounded-md border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium"><Link href={j.href} className="hover:underline">{j.title}</Link></p>
              <p className="text-xs text-muted-foreground">{j.channelLabel} · {KIND[j.kind] ?? j.kind} · 시도 {j.attempts}회 · {formatDateTime(j.createdAt)}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={j.status === "SUCCEEDED" ? "default" : j.status === "FAILED" ? "destructive" : "secondary"}>{j.status}</Badge>
              {j.status === "FAILED" && (
                <Button size="sm" disabled={pending} onClick={() => start(async () => { const r = await retryRenderAction(slug, j.id); if (!r.ok) return void toast.error(r.error); toast.success("다시 시도합니다"); router.refresh(); })}>재시도</Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setOpen(open === j.id ? null : j.id)}>로그</Button>
            </div>
          </div>
          <div className="mt-2"><RenderStatus slug={slug} renderJobId={j.id} initial={{ status: j.status, step: j.step, progress: j.progress, lastError: j.lastError }} /></div>
          {open === j.id && <pre className="mt-2 max-h-60 overflow-auto rounded bg-muted p-2 text-xs">{j.logs.join("\n") || "로그 없음"}</pre>}
        </li>
      ))}
    </ul>
  );
}
