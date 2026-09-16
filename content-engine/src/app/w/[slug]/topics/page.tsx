import type { Metadata } from "next";
import Link from "next/link";
import { requireWorkspacePage } from "@/server/tenancy/context";
import { resolveProduct } from "@/server/queries/products";
import { listTopics } from "@/server/queries/content";
import { getMixReport } from "@/server/content/topics";
import { CATEGORY_LABELS } from "@/server/content/content-mix";
import { PageHeader } from "@/components/app/page-header";
import { ProductPicker } from "@/components/app/product-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TopicForms } from "./topic-forms";
import { TopicList } from "./topic-list";

export const metadata: Metadata = { title: "콘텐츠 소재" };

export default async function TopicsPage(props: PageProps<"/w/[slug]/topics">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const ctx = await requireWorkspacePage(slug);
  const { products, selected } = await resolveProduct(ctx.workspace.id, typeof sp.product === "string" ? sp.product : undefined);
  if (!selected) {
    return (
      <div>
        <PageHeader title="콘텐츠 소재" />
        <p className="text-sm text-muted-foreground">
          먼저 제품을 등록하세요. <Link className="text-primary underline" href={`/w/${slug}/products/new`}>제품 등록</Link>
        </p>
      </div>
    );
  }
  const [topics, mix] = await Promise.all([listTopics(ctx.workspace.id, selected.id), getMixReport(ctx.workspace.id)]);
  const cats = Object.keys(CATEGORY_LABELS) as (keyof typeof CATEGORY_LABELS)[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="콘텐츠 소재"
        description="질문·계산·기능 업데이트에서 소재를 만들고, 선택한 소재로 Content Master를 생성합니다."
        actions={<ProductPicker products={products.map((p) => ({ id: p.id, name: p.name }))} selectedId={selected.id} />}
      />

      <Card>
        <CardHeader>
          <CardTitle>최근 콘텐츠 비율</CardTitle>
          <CardDescription>목표: 정보 40 · 데이터 25 · 참여 15 · 브랜딩 10 · 홍보 10. 추천 순서: {mix.recommendedOrder.slice(0, 2).map((c) => CATEGORY_LABELS[c]).join(" → ")}</CardDescription>
        </CardHeader>
        <CardContent>
          {mix.warning && <p className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-800">{mix.warning}</p>}
          <div className="grid grid-cols-5 gap-2 text-xs">
            {cats.map((c) => (
              <div key={c}>
                <div className="mb-1 flex justify-between"><span>{CATEGORY_LABELS[c]}</span><span className="text-muted-foreground">{Math.round(mix.ratios[c] * 100)}% / {Math.round(mix.target[c] * 100)}%</span></div>
                <div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${Math.min(100, mix.ratios[c] * 100)}%` }} /></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <TopicForms slug={slug} productId={selected.id} />

      <Card>
        <CardHeader>
          <CardTitle>소재 목록</CardTitle>
          <CardDescription>소재를 선택한 뒤 Content Master를 생성하세요. 생성된 Master는 <Link href={`/w/${slug}/content`} className="underline">콘텐츠</Link>에서 확인합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <TopicList
            slug={slug}
            topics={topics.map((t) => ({
              id: t.id,
              title: t.title,
              coreQuestion: t.coreQuestion,
              category: t.category,
              status: t.status,
              sourceType: t.sources_[0]?.type ?? "MANUAL_INPUT",
              riskLevel: t.riskLevel,
              duplicateScore: t.duplicateScore,
              expectedChannels: t.expectedChannels,
              masterId: t.masters[0]?.id ?? null,
              masterStatus: t.masters[0]?.status ?? null,
            }))}
          />
          {topics.length === 0 && <p className="text-sm text-muted-foreground">아직 소재가 없습니다. 위에서 소재를 만들어 보세요.</p>}
          <div className="mt-3">
            <Button asChild variant="link" className="px-0"><Link href={`/w/${slug}/topics?product=${selected.id}&showDismissed=1`}>제외한 소재 보기</Link></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
