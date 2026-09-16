import type { Metadata } from "next";
import Link from "next/link";
import { requireWorkspacePage } from "@/server/tenancy/context";
import { computePerformance, rate, type Metrics } from "@/server/analytics/performance";
import { resolveProduct } from "@/server/queries/products";
import { appUrl } from "@/server/analytics/tracking";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CHANNEL_LABELS } from "@/lib/labels";
import { CATEGORY_LABELS } from "@/server/content/content-mix";
import { InstallSnippet } from "./install-snippet";
import { daysAgo } from "@/lib/format/date";

export const metadata: Metadata = { title: "분석" };

function pct(v: number | null) {
  return v === null ? "N/A" : `${(v * 100).toFixed(1)}%`;
}
function na(v: number | null) {
  return v === null ? "N/A" : String(v);
}

function MetricRow({ label, m }: { label: string; m: Metrics }) {
  return (
    <tr className="border-t">
      <td className="p-2 font-medium">{label}</td>
      <td className="p-2 text-right text-muted-foreground">{na(m.impressions)}</td>
      <td className="p-2 text-right">{m.clicks}</td>
      <td className="p-2 text-right">{pct(rate(m.clicks, m.impressions ?? 0) ?? null)}</td>
      <td className="p-2 text-right">{m.landingVisits}</td>
      <td className="p-2 text-right">{m.signups}</td>
      <td className="p-2 text-right">{pct(rate(m.signups, m.landingVisits))}</td>
      <td className="p-2 text-right">{m.activations}</td>
      <td className="p-2 text-right">{m.returnVisits}</td>
      <td className="p-2 text-right">{m.paidConversions}</td>
    </tr>
  );
}

function Table({ title, rows, description }: { title: string; description?: string; rows: { label: string; m: Metrics; href?: string }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr><th className="p-2">구분</th><th className="p-2 text-right">노출</th><th className="p-2 text-right">클릭</th><th className="p-2 text-right">클릭률</th><th className="p-2 text-right">랜딩 방문</th><th className="p-2 text-right">가입</th><th className="p-2 text-right">가입 전환율</th><th className="p-2 text-right">핵심 기능</th><th className="p-2 text-right">재방문</th><th className="p-2 text-right">유료</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={10} className="p-2 text-muted-foreground">데이터 없음</td></tr>}
            {rows.map((r) => <MetricRow key={r.label + (r.href ?? "")} label={r.label} m={r.m} />)}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export default async function AnalyticsPage(props: PageProps<"/w/[slug]/analytics">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const ctx = await requireWorkspacePage(slug);
  const days = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const since = daysAgo(days);
  const [perf, { selected }] = await Promise.all([computePerformance(ctx.workspace.id, since), resolveProduct(ctx.workspace.id)]);
  const t = perf.total;

  return (
    <div className="space-y-6">
      <PageHeader
        title="분석 대시보드"
        description={`최근 ${days}일 · 이벤트 ${perf.eventCount}건 · 노출(impressions)은 플랫폼이 제공하지 않아 N/A로 표시합니다.`}
        actions={<div className="flex gap-1">{[7, 30, 90].map((d) => <Button key={d} asChild size="sm" variant={d === days ? "default" : "outline"}><Link href={`/w/${slug}/analytics?days=${d}`}>{d}일</Link></Button>)}</div>}
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-6" aria-label="전환 퍼널">
        {[
          ["링크 클릭", t.clicks], ["랜딩 방문", t.landingVisits], ["회원가입", t.signups], ["핵심 기능 사용", t.activations], ["재방문", t.returnVisits], ["유료 전환", t.paidConversions],
        ].map(([l, v]) => (
          <div key={String(l)} className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">{l}</p>
            <p className="text-2xl font-bold">{v}</p>
          </div>
        ))}
      </section>
      <p className="text-xs text-muted-foreground">가입 전환율 {pct(rate(t.signups, t.landingVisits))} · 활성화율 {pct(rate(t.activations, t.signups))} · 귀속되지 않은 이벤트: 클릭 {perf.unattributed.clicks}, 방문 {perf.unattributed.landingVisits}, 가입 {perf.unattributed.signups}</p>

      <Table title="채널별 성과" rows={perf.byChannel.map((g) => ({ label: CHANNEL_LABELS[g.key] ?? g.key, m: g }))} />
      <Table title="콘텐츠별 성과" description="추적 링크 클릭과 utm_content로 귀속된 이벤트입니다." rows={perf.contents.filter((c) => c.clicks || c.landingVisits || c.signups).map((c) => ({ label: `${c.masterTitle} · ${CHANNEL_LABELS[c.channel]}`, m: c, href: c.channelContentId }))} />
      <Table title="소재별 성과" rows={perf.byTopic.map((g) => ({ label: g.label, m: g }))} />
      <Table title="콘텐츠 유형별 성과" rows={perf.byCategory.map((g) => ({ label: CATEGORY_LABELS[g.key as keyof typeof CATEGORY_LABELS] ?? g.key, m: g }))} />
      <Table title="CTA별 성과" rows={perf.byCta.map((g) => ({ label: g.label, m: g }))} />

      <Card>
        <CardHeader>
          <CardTitle>추적 SDK 설치</CardTitle>
          <CardDescription>내 서비스 페이지에 아래 코드를 넣으면 방문·가입·핵심 기능 이벤트가 이 워크스페이스로 수집됩니다. 개인정보는 보내지 않습니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <InstallSnippet host={appUrl()} workspaceId={ctx.workspace.id} productId={selected?.id ?? null} />
        </CardContent>
      </Card>
    </div>
  );
}
