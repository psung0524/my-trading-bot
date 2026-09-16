import type { Metadata } from "next";
import Link from "next/link";
import { requireWorkspacePage } from "@/server/tenancy/context";
import { prisma } from "@/server/db/prisma";
import { PageHeader } from "@/components/app/page-header";
import { CHANNEL_LABELS } from "@/lib/labels";
import { RenderList } from "./render-list";

export const metadata: Metadata = { title: "렌더링" };

export default async function RendersPage(props: PageProps<"/w/[slug]/renders">) {
  const { slug } = await props.params;
  const ctx = await requireWorkspacePage(slug);
  const jobs = await prisma.renderJob.findMany({
    where: { workspaceId: ctx.workspace.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { channelContent: { select: { id: true, masterId: true, channel: true, title: true } } },
  });
  return (
    <div>
      <PageHeader title="렌더링" description="카드뉴스 PNG, 블로그 썸네일, Shorts MP4 렌더 작업의 상태입니다. 실패하면 원인을 확인하고 다시 시도할 수 있습니다." />
      {jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">렌더 작업이 없습니다. <Link className="underline" href={`/w/${slug}/content`}>콘텐츠</Link>에서 렌더링을 시작하세요.</p>
      ) : (
        <RenderList
          slug={slug}
          jobs={jobs.map((j) => ({
            id: j.id,
            kind: j.kind,
            status: j.status,
            step: j.step,
            progress: j.progress,
            lastError: j.lastError,
            attempts: j.attempts,
            createdAt: j.createdAt.toISOString(),
            logs: (j.logs as string[]) ?? [],
            title: j.channelContent.title,
            channelLabel: CHANNEL_LABELS[j.channelContent.channel],
            href: `/w/${slug}/content/${j.channelContent.masterId}/${j.channelContent.id}`,
          }))}
        />
      )}
    </div>
  );
}
