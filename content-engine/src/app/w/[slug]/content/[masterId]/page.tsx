import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireWorkspacePage } from "@/server/tenancy/context";
import { getMasterDetail } from "@/server/queries/content";
import { masterToBody } from "@/server/content/master";
import { validationResultSchema } from "@/lib/schemas/content";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CHANNEL_LABELS, THREADS_VARIANT_LABELS } from "@/lib/labels";
import { MasterEditor } from "./master-editor";
import { GeneratePanel } from "./generate-panel";
import { ValidationList } from "@/components/app/validation-list";

export const metadata: Metadata = { title: "Content Master" };

export default async function MasterPage(props: PageProps<"/w/[slug]/content/[masterId]">) {
  const { slug, masterId } = await props.params;
  const ctx = await requireWorkspacePage(slug);
  const master = await getMasterDetail(ctx.workspace.id, masterId);
  if (!master) notFound();
  const body = masterToBody(master);
  const validation = validationResultSchema.safeParse(master.validation);
  const issues = validation.success ? validation.data.issues : [];
  const canGenerate = master.status !== "NEEDS_SOURCE" && master.status !== "GENERATING";
  const channelsDone = new Set(master.channels.map((c) => c.channel));

  return (
    <div className="space-y-6">
      <PageHeader
        title={master.title}
        description={`${master.product.name} · 기준일 ${body.asOfDate}${master.topic ? ` · 소재: ${master.topic.title}` : ""}`}
        actions={<StatusBadge status={master.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>검증 결과</CardTitle>
              <CardDescription>모든 채널 콘텐츠는 이 원본의 숫자·기준일·출처만 사용합니다. BLOCK 이슈가 있으면 채널 생성과 게시가 막힙니다.</CardDescription>
            </CardHeader>
            <CardContent>
              <ValidationList issues={issues} emptyText="검증을 통과했습니다." />
            </CardContent>
          </Card>
          <MasterEditor slug={slug} masterId={master.id} body={body} />
        </div>

        <div className="space-y-6">
          <GeneratePanel slug={slug} masterId={master.id} disabled={!canGenerate} existing={[...channelsDone]} />
          <Card>
            <CardHeader>
              <CardTitle>채널 콘텐츠</CardTitle>
            </CardHeader>
            <CardContent>
              {master.channels.length === 0 ? (
                <p className="text-sm text-muted-foreground">아직 생성된 채널 콘텐츠가 없습니다.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {master.channels.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{CHANNEL_LABELS[c.channel]}{c.channel === "THREADS" ? ` · ${THREADS_VARIANT_LABELS[c.variant] ?? c.variant}` : ""}</p>
                        <p className="text-xs text-muted-foreground">v{c.currentVersion}{c.renderJobs[0] ? ` · 렌더 ${c.renderJobs[0].status}` : ""}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={c.status} />
                        <Button asChild size="sm" variant="outline"><Link href={`/w/${slug}/content/${master.id}/${c.id}`}>열기</Link></Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
