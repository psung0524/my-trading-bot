"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getRenderStatusAction } from "@/server/actions/edit";
import { Progress } from "@/components/ui/progress";

export function RenderStatus({ slug, renderJobId, initial }: { slug: string; renderJobId: string; initial: { status: string; step: string; progress: number; lastError: string | null } }) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const active = state.status === "QUEUED" || state.status === "PROCESSING";
  useEffect(() => {
    if (!active) return;
    let stopped = false;
    const tick = async () => {
      const res = await getRenderStatusAction(slug, renderJobId);
      if (stopped) return;
      if (res.ok) {
        setState(res.data);
        if (res.data.status !== "QUEUED" && res.data.status !== "PROCESSING") router.refresh();
      }
    };
    const id = setInterval(tick, 1500);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [active, slug, renderJobId, router]);
  return (
    <div className="space-y-1 text-sm" data-testid="render-status" data-status={state.status}>
      <div className="flex items-center justify-between">
        <span>{state.status === "SUCCEEDED" ? "렌더링 완료" : state.status === "FAILED" ? "렌더링 실패" : state.status === "CANCELED" ? "취소됨" : `렌더링 중 · ${state.step}`}</span>
        <span className="text-xs text-muted-foreground">{state.progress}%</span>
      </div>
      <Progress value={state.progress} />
      {state.lastError && <p className="whitespace-pre-wrap rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">{state.lastError}</p>}
    </div>
  );
}
