import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireWorkspacePage } from "@/server/tenancy/context";
import { getProduct } from "@/server/queries/products";
import { productAnalysisSchema } from "@/lib/schemas/product";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductForm } from "../product-form";
import { AnalysisPanel } from "./analysis-panel";

export const metadata: Metadata = { title: "제품 상세" };

export default async function ProductDetailPage(props: PageProps<"/w/[slug]/products/[productId]">) {
  const { slug, productId } = await props.params;
  const sp = await props.searchParams;
  const ctx = await requireWorkspacePage(slug);
  const product = await getProduct(ctx.workspace.id, productId);
  if (!product) notFound();
  const analysis = productAnalysisSchema.safeParse(product.analysis);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title={product.name}
        description={product.url}
        actions={
          <Button asChild variant="outline">
            <Link href={`/w/${slug}/brand?product=${product.id}`}>브랜드 프로필</Link>
          </Button>
        }
      />
      {sp.step === "analyze" && (
        <p className="rounded-md border bg-accent/40 p-3 text-sm">
          2단계: 아래에서 페이지를 분석하거나 직접 정보를 입력한 뒤, 브랜드 프로필을 설정하세요.
        </p>
      )}
      <Card>
        <CardHeader>
          <CardTitle>페이지 분석</CardTitle>
          <CardDescription>공개 페이지의 제목·설명·헤딩·링크를 읽어 기능과 키워드를 추출합니다. 결과는 직접 수정할 수 있습니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <AnalysisPanel
            slug={slug}
            productId={product.id}
            analysis={analysis.success ? analysis.data : null}
            analyzedAt={product.analyzedAt?.toISOString() ?? null}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>기본 정보</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductForm slug={slug} mode="edit" productId={product.id} defaults={{ name: product.name, url: product.url, description: product.description }} />
        </CardContent>
      </Card>
    </div>
  );
}
