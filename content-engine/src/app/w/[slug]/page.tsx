import type { Metadata } from "next";
import Link from "next/link";
import { requireWorkspacePage } from "@/server/tenancy/context";
import { prisma } from "@/server/db/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "오늘의 업무" };

export default async function DashboardPage(props: PageProps<"/w/[slug]">) {
  const { slug } = await props.params;
  const ctx = await requireWorkspacePage(slug);
  const productCount = await prisma.product.count({ where: { workspaceId: ctx.workspace.id, deletedAt: null } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">오늘의 업무</h1>
        <p className="text-sm text-muted-foreground">{ctx.workspace.name} · AI 마케팅 직원의 업무 화면</p>
      </div>
      {productCount === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>먼저 제품을 등록하세요</CardTitle>
            <CardDescription>
              제품 이름과 URL을 등록하면 분석과 브랜드 프로필 설정을 시작할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={`/w/${slug}/products/new`}>제품 등록하기</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">대시보드 위젯은 다음 단계에서 채워집니다.</p>
      )}
    </div>
  );
}
