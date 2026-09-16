import type { Metadata } from "next";
import Link from "next/link";
import { requireWorkspacePage } from "@/server/tenancy/context";
import { prisma } from "@/server/db/prisma";
import { can } from "@/server/tenancy/permissions";
import { PageHeader } from "@/components/app/page-header";
import { CHANNEL_LABELS } from "@/lib/labels";
import { ScheduleList } from "./schedule-list";

export const metadata: Metadata = { title: "예약 게시" };

export default async function SchedulePage(props: PageProps<"/w/[slug]/schedule">) {
  const { slug } = await props.params;
  const ctx = await requireWorkspacePage(slug);
  const now = new Date();
  const jobs = await prisma.publishJob.findMany({
    where: { workspaceId: ctx.workspace.id },
    orderBy: [{ status: "asc" }, { scheduledFor: "asc" }, { createdAt: "desc" }],
    take: 100,
    include: { channelContent: { select: { id: true, masterId: true, channel: true, title: true, status: true, scheduledAt: true } }, channelAccount: { select: { displayName: true, provider: true } } },
  });
  return (
    <div>
      <PageHeader title="예약 게시" description="예약된 게시와 게시 이력입니다. 워커가 없으면 '지금 처리'로 예약 시각이 지난 항목을 게시합니다." />
      {jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">게시 작업이 없습니다. <Link className="underline" href={`/w/${slug}/inbox`}>승인함</Link>에서 승인·예약하세요.</p>
      ) : (
        <ScheduleList
          slug={slug}
          canPublish={can(ctx.role, "publishContent")}
          dueCount={jobs.filter((j) => j.status === "QUEUED" && j.scheduledFor && j.scheduledFor <= now).length}
          jobs={jobs.map((j) => ({
            id: j.id,
            status: j.status,
            channel: CHANNEL_LABELS[j.channel],
            title: j.channelContent.title,
            contentStatus: j.channelContent.status,
            contentId: j.channelContent.id,
            masterId: j.channelContent.masterId,
            scheduledFor: j.scheduledFor?.toISOString() ?? null,
            finishedAt: j.finishedAt?.toISOString() ?? null,
            externalUrl: j.externalUrl,
            externalId: j.externalId,
            lastError: j.lastError,
            account: j.channelAccount ? `${j.channelAccount.displayName} (${j.channelAccount.provider})` : "기본",
            logs: (j.logs as string[]) ?? [],
          }))}
        />
      )}
    </div>
  );
}
