"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { collectBatchNowAction } from "@/server/actions/content";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format/date";

export type PendingBatch = { jobId: string; batchId: string; channels: string[]; status: string; runAt: string; polls: number };

export function BatchStatus({ slug, batches }: { slug: string; batches: PendingBatch[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!batches.length) return null;
  return (
    <Card data-batch-status>
      <CardHeader>
        <CardTitle>배치 생성 대기 중</CardTitle>
        <CardDescription>Anthropic 배치 API에 제출된 요청입니다. 워커가 자동으로 가져오거나 아래 버튼으로 지금 확인할 수 있습니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {batches.map((b) => (
          <div key={b.jobId} className="flex items-center justify-between gap-2 rounded-md border p-2">
            <div className="min-w-0">
              <p className="truncate font-medium">{b.channels.join(", ")}</p>
              <p className="text-xs text-muted-foreground">다음 자동 확인 {formatDateTime(b.runAt)} · 확인 {b.polls}회 · {b.batchId}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={pending || b.status !== "QUEUED"}
              onClick={() =>
                start(async () => {
                  const res = await collectBatchNowAction(slug, b.jobId);
                  if (!res.ok) return void toast.error(res.error);
                  if (res.data.ended) toast.success("배치 결과를 가져왔습니다");
                  else toast.info("아직 처리 중입니다. 잠시 후 다시 확인하세요");
                  for (const w of res.data.warnings) toast.error(`일부 채널 실패 - ${w}`, { duration: 15000 });
                  router.refresh();
                })
              }
            >
              {pending ? "확인 중..." : "지금 확인"}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
