import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireWorkspacePage } from "@/server/tenancy/context";
import { getChannelContent } from "@/server/queries/content";
import { can } from "@/server/tenancy/permissions";
import { channelBodySchemas, validationResultSchema } from "@/lib/schemas/content";
import { getStorage } from "@/server/providers/storage";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { CHANNEL_LABELS, THREADS_VARIANT_LABELS } from "@/lib/labels";
import { ChannelWorkbench } from "./channel-workbench";
import { aiStatus } from "@/server/providers/ai/status";
import { AiStatusBanner } from "@/components/app/ai-status-banner";

export const metadata: Metadata = { title: "채널 콘텐츠" };

export default async function ChannelContentPage(props: PageProps<"/w/[slug]/content/[masterId]/[channelId]">) {
  const { slug, masterId, channelId } = await props.params;
  const ctx = await requireWorkspacePage(slug);
  const cc = await getChannelContent(ctx.workspace.id, channelId);
  if (!cc || cc.masterId !== masterId) notFound();
  const validation = validationResultSchema.safeParse(cc.validation);
  const issues = validation.success ? validation.data.issues : [];
  const body = channelBodySchemas[cc.channel].parse(cc.body);
  const storage = getStorage();
  const latest = cc.renderJobs[0];
  const gen = (cc.validation ?? {}) as { provider?: string; model?: string };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${CHANNEL_LABELS[cc.channel]}${cc.channel === "THREADS" ? ` · ${THREADS_VARIANT_LABELS[cc.variant] ?? cc.variant}` : ""}`}
        description={`${cc.master.title} · v${cc.currentVersion} · 기준일 ${cc.master.asOfDate.toISOString().slice(0, 10)} · 생성: ${gen.provider ?? "?"}${gen.model ? ` (${gen.model})` : ""}`}
        actions={
          <>
            <StatusBadge status={cc.status} />
            <Button asChild variant="outline" size="sm"><Link href={`/w/${slug}/content/${masterId}`}>Master로</Link></Button>
          </>
        }
      />
      <AiStatusBanner status={aiStatus()} />
      <ChannelWorkbench
        slug={slug}
        masterId={masterId}
        channelContentId={cc.id}
        channel={cc.channel}
        body={body}
        brandName={cc.master.product.name}
        status={cc.status}
        issues={issues}
        assets={cc.assets.filter((a) => a.storageKey.includes(`/v${cc.currentVersion}/`) || a.kind === "CARD_ZIP").filter((a) => a.storageKey.includes(`/v${cc.currentVersion}/`)).map((a) => ({ id: a.id, kind: a.kind, url: storage.url(a.storageKey), filename: a.storageKey.split("/").pop() ?? a.id, sizeBytes: a.sizeBytes, meta: (a.meta ?? {}) as Record<string, unknown> }))}
        latestRender={latest ? { id: latest.id, status: latest.status, step: latest.step, progress: latest.progress, lastError: latest.lastError, createdAt: latest.createdAt.toISOString() } : null}
        canEdit={can(ctx.role, "editContent")}
        masterNeedsSource={cc.master.status === "NEEDS_SOURCE"}
      />
      {cc.versions.length > 1 && (
        <p className="text-xs text-muted-foreground">버전 이력: {cc.versions.map((v) => `v${v.version}(${v.source})`).join(" → ")}</p>
      )}
    </div>
  );
}
