import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireWorkspacePage } from "@/server/tenancy/context";
import { getChannelContent } from "@/server/queries/content";
import { blogBodySchema, instagramBodySchema, shortsBodySchema, threadsBodySchema, validationResultSchema } from "@/lib/schemas/content";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { ValidationList } from "@/components/app/validation-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CHANNEL_LABELS, THREADS_VARIANT_LABELS } from "@/lib/labels";
import { ThreadsPreview } from "@/components/channels/threads-preview";
import { InstagramPreview } from "@/components/channels/instagram-preview";
import { BlogPreview } from "@/components/channels/blog-preview";
import { ShortsPreview } from "@/components/channels/shorts-preview";

export const metadata: Metadata = { title: "채널 콘텐츠" };

export default async function ChannelContentPage(props: PageProps<"/w/[slug]/content/[masterId]/[channelId]">) {
  const { slug, masterId, channelId } = await props.params;
  const ctx = await requireWorkspacePage(slug);
  const cc = await getChannelContent(ctx.workspace.id, channelId);
  if (!cc || cc.masterId !== masterId) notFound();
  const validation = validationResultSchema.safeParse(cc.validation);
  const issues = validation.success ? validation.data.issues : [];
  const brandName = cc.master.product.name;

  let preview: React.ReactNode = null;
  if (cc.channel === "THREADS") preview = <ThreadsPreview body={threadsBodySchema.parse(cc.body)} brandName={brandName} />;
  else if (cc.channel === "INSTAGRAM") preview = <InstagramPreview body={instagramBodySchema.parse(cc.body)} brandName={brandName} />;
  else if (cc.channel === "BLOG") preview = <BlogPreview body={blogBodySchema.parse(cc.body)} />;
  else if (cc.channel === "YOUTUBE_SHORTS") preview = <ShortsPreview body={shortsBodySchema.parse(cc.body)} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${CHANNEL_LABELS[cc.channel]}${cc.channel === "THREADS" ? ` · ${THREADS_VARIANT_LABELS[cc.variant] ?? cc.variant}` : ""}`}
        description={`${cc.master.title} · v${cc.currentVersion}`}
        actions={
          <>
            <StatusBadge status={cc.status} />
            <Button asChild variant="outline" size="sm"><Link href={`/w/${slug}/content/${masterId}`}>Master로</Link></Button>
          </>
        }
      />
      <Card>
        <CardHeader><CardTitle>검증 결과</CardTitle></CardHeader>
        <CardContent><ValidationList issues={issues} emptyText="Content Master와 일치하며 안전 검사를 통과했습니다." /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>미리보기</CardTitle></CardHeader>
        <CardContent>{preview}</CardContent>
      </Card>
    </div>
  );
}
