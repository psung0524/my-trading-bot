import type { Metadata } from "next";
import Link from "next/link";
import { requireWorkspacePage } from "@/server/tenancy/context";
import { getDashboardSummary } from "@/server/queries/dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RecommendationList } from "@/components/app/recommendation-list";
import { can } from "@/server/tenancy/permissions";

export const metadata: Metadata = { title: "오늘의 업무" };

function Stat({ label, value, href, hint }: { label: string; value: string | number; href: string; hint?: string }) {
  return (
    <Link href={href} className="rounded-lg border bg-card p-4 transition hover:bg-accent/40">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </Link>
  );
}

export default async function DashboardPage(props: PageProps<"/w/[slug]">) {
  const { slug } = await props.params;
  const ctx = await requireWorkspacePage(slug);
  const s = await getDashboardSummary(ctx.workspace.id, slug);
  const base = `/w/${slug}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">오늘의 업무</h1>
        <p className="text-sm text-muted-foreground">{ctx.workspace.name} · AI 마케팅 직원의 업무 화면</p>
      </div>

      {!s.hasProduct && (
        <Card>
          <CardHeader>
            <CardTitle>먼저 제품을 등록하세요</CardTitle>
            <CardDescription>제품 이름과 URL을 등록하면 분석과 브랜드 프로필 설정을 시작할 수 있습니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={`${base}/products/new`}>제품 등록하기</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <section aria-label="오늘 현황" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="오늘 완료한 작업" value={s.counts.doneToday} href={`${base}/audit`} />
        <Stat label="승인 필요한 콘텐츠" value={s.counts.needsReview} href={`${base}/inbox`} />
        <Stat label="렌더링 중" value={s.counts.rendering} href={`${base}/renders`} hint={s.counts.failedJobs ? `실패 ${s.counts.failedJobs}` : undefined} />
        <Stat label="오늘 게시 예정" value={s.counts.scheduledToday} href={`${base}/schedule`} hint={`오늘 게시됨 ${s.counts.publishedToday}`} />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>다음 추천 행동</CardTitle>
            <CardDescription>현재 상태를 보고 AI 직원이 제안하는 순서입니다.</CardDescription>
          </CardHeader>
          <CardContent>
            {s.nextActions.length === 0 ? (
              <p className="text-sm text-muted-foreground">지금 처리할 항목이 없습니다. 새 소재를 만들어 보세요.</p>
            ) : (
              <ol className="space-y-2">
                {s.nextActions.map((a, i) => (
                  <li key={a.href + i} className="flex items-center justify-between gap-3 rounded-md border p-3">
                    <div>
                      <p className="font-medium">{i + 1}. {a.title}</p>
                      <p className="text-sm text-muted-foreground">{a.description}</p>
                    </div>
                    <Button asChild size="sm" variant={i === 0 ? "default" : "outline"}>
                      <Link href={a.href}>이동</Link>
                    </Button>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>지난 7일 성과</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-muted-foreground">링크 클릭</p><p className="text-xl font-bold">{s.counts.clicks7d}</p></div>
              <div><p className="text-muted-foreground">회원가입</p><p className="text-xl font-bold">{s.counts.signups7d}</p></div>
              <Link href={`${base}/analytics`} className="col-span-2 text-xs text-primary underline">분석 대시보드 보기</Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>AI가 발견한 변화</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <RecommendationList slug={slug} canAccept={can(ctx.role, "approveContent")} showGenerate={s.hasProduct} items={s.recommendations.map((r) => ({ id: r.id, kind: r.kind, title: r.title, reason: r.reason, status: r.status, metrics: (r.metrics ?? {}) as Record<string, unknown> }))} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
