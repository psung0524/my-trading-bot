import type { Metadata } from "next";
import Link from "next/link";
import { requireWorkspacePage } from "@/server/tenancy/context";
import { resolveProduct, getProduct } from "@/server/queries/products";
import { listReferences, styleGuideSchema, channelKey } from "@/server/content/references";
import { PageHeader } from "@/components/app/page-header";
import { ProductPicker } from "@/components/app/product-picker";
import { Button } from "@/components/ui/button";
import { CHANNEL_LABELS } from "@/lib/labels";
import { ReferencesPanel } from "./references-panel";

export const metadata: Metadata = { title: "참고 글·문체" };

const CHANNELS = ["BLOG", "THREADS", "INSTAGRAM", "YOUTUBE_SHORTS"] as const;

export default async function ReferencesPage(props: PageProps<"/w/[slug]/brand/references">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const ctx = await requireWorkspacePage(slug);
  const { products, selected } = await resolveProduct(ctx.workspace.id, typeof sp.product === "string" ? sp.product : undefined);
  const channel = (CHANNELS as readonly string[]).includes(String(sp.channel)) ? (String(sp.channel) as (typeof CHANNELS)[number]) : "BLOG";
  if (!selected) return <div><PageHeader title="참고 글·문체" /><p className="text-sm text-muted-foreground">먼저 제품을 등록하세요.</p></div>;
  const product = await getProduct(ctx.workspace.id, selected.id);
  const refs = await listReferences(ctx.workspace.id, channel);
  const settings = ((product?.brandProfile?.channelSettings ?? {}) as Record<string, Record<string, unknown>>)[channelKey(channel)] ?? {};
  const guide = styleGuideSchema.safeParse(settings.styleGuide);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="참고 글·문체"
        description="내가 쓴 글이나 벤치마크 글을 등록하면 AI가 문체 가이드를 뽑고, 생성할 때 예문으로 함께 넣습니다. 문장을 베끼지 않고 리듬·구성만 따릅니다."
        actions={<ProductPicker products={products.map((p) => ({ id: p.id, name: p.name }))} selectedId={selected.id} />}
      />
      <div className="flex flex-wrap gap-1">
        {CHANNELS.map((c) => (
          <Button key={c} asChild size="sm" variant={c === channel ? "default" : "outline"}><Link href={`/w/${slug}/brand/references?product=${selected.id}&channel=${c}`}>{CHANNEL_LABELS[c]}</Link></Button>
        ))}
        <Button asChild size="sm" variant="ghost"><Link href={`/w/${slug}/brand?product=${selected.id}`}>브랜드 프로필로</Link></Button>
      </div>
      <ReferencesPanel
        slug={slug}
        productId={selected.id}
        channel={channel}
        refs={refs.map((r) => ({ id: r.id, title: r.title, url: r.url, source: r.source, note: r.note, length: r.content.length, preview: r.content.slice(0, 160) }))}
        guide={guide.success ? guide.data : null}
        guideMeta={{ updatedAt: typeof settings.styleGuideUpdatedAt === "string" ? settings.styleGuideUpdatedAt : null, source: typeof settings.styleGuideSource === "string" ? settings.styleGuideSource : null }}
      />
    </div>
  );
}
