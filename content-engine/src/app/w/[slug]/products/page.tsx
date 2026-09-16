import type { Metadata } from "next";
import Link from "next/link";
import { requireWorkspacePage } from "@/server/tenancy/context";
import { listProducts } from "@/server/queries/products";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "제품" };

export default async function ProductsPage(props: PageProps<"/w/[slug]/products">) {
  const { slug } = await props.params;
  const ctx = await requireWorkspacePage(slug);
  const products = await listProducts(ctx.workspace.id);
  return (
    <div>
      <PageHeader
        title="제품"
        description="콘텐츠의 대상이 되는 웹서비스입니다."
        actions={
          <Button asChild>
            <Link href={`/w/${slug}/products/new`}>제품 등록</Link>
          </Button>
        }
      />
      {products.length === 0 ? (
        <p className="text-sm text-muted-foreground">등록된 제품이 없습니다.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {products.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link href={`/w/${slug}/products/${p.id}`} className="hover:underline">
                    {p.name}
                  </Link>
                  {p.analyzedAt ? <Badge variant="secondary">분석 완료</Badge> : <Badge variant="outline">미분석</Badge>}
                </CardTitle>
                <CardDescription className="truncate">{p.url}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{p.description || "설명 없음"}</CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
