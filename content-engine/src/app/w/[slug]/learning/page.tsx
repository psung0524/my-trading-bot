import type { Metadata } from "next";
import { requireWorkspacePage } from "@/server/tenancy/context";
import { prisma } from "@/server/db/prisma";
import { PageHeader } from "@/components/app/page-header";
import { LearningList } from "./learning-list";

export const metadata: Metadata = { title: "브랜드 학습" };

export default async function LearningPage(props: PageProps<"/w/[slug]/learning">) {
  const { slug } = await props.params;
  const ctx = await requireWorkspacePage(slug);
  const items = await prisma.brandLearning.findMany({ where: { workspaceId: ctx.workspace.id, status: { not: "DELETED" } }, orderBy: [{ status: "asc" }, { updatedAt: "desc" }] });
  return (
    <div>
      <PageHeader title="브랜드 학습" description="사용자가 AI 결과물을 수정하면 차이를 분석해 반복 패턴을 제안합니다. 승인한 항목만 다음 생성에 반영되며 언제든 삭제할 수 있습니다." />
      <LearningList slug={slug} items={items.map((i) => ({ id: i.id, pattern: i.pattern, description: i.description, status: i.status, channel: i.channel, evidence: (i.evidence ?? {}) as Record<string, unknown>, updatedAt: i.updatedAt.toISOString() }))} />
    </div>
  );
}
