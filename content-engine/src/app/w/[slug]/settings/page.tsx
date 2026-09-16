import type { Metadata } from "next";
import { requireWorkspacePage } from "@/server/tenancy/context";
import { prisma } from "@/server/db/prisma";
import { can } from "@/server/tenancy/permissions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceSettingsForm, MemberManager, DangerZone, ScoreWeightsForm } from "./settings-forms";
import { parseWeights } from "@/server/analytics/score";
import { usageSummary } from "@/server/providers/ai/usage";
import { formatDateTime } from "@/lib/format/date";

export const metadata: Metadata = { title: "워크스페이스 설정" };

export default async function SettingsPage(props: PageProps<"/w/[slug]/settings">) {
  const { slug } = await props.params;
  const ctx = await requireWorkspacePage(slug);
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId: ctx.workspace.id },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  const canManage = can(ctx.role, "manageWorkspace");
  const usage = await usageSummary(ctx.workspace.id, 30);
  const krw = (usd: number) => `약 ${Math.round(usd * 1400).toLocaleString("ko-KR")}원`;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">워크스페이스 설정</h1>
      <Card>
        <CardHeader>
          <CardTitle>기본 정보</CardTitle>
          <CardDescription>슬러그: /w/{ctx.workspace.slug}</CardDescription>
        </CardHeader>
        <CardContent>
          <WorkspaceSettingsForm slug={slug} name={ctx.workspace.name} disabled={!canManage} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>멤버</CardTitle>
          <CardDescription>역할: OWNER &gt; ADMIN(승인·게시) &gt; EDITOR(편집) &gt; VIEWER(조회)</CardDescription>
        </CardHeader>
        <CardContent>
          <MemberManager
            slug={slug}
            currentUserId={ctx.user.id}
            canManage={can(ctx.role, "manageMembers")}
            members={members.map((m) => ({ userId: m.user.id, name: m.user.name ?? "", email: m.user.email, role: m.role }))}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>성과 점수 가중치</CardTitle>
          <CardDescription>워크스페이스 목표에 따라 클릭·가입·활성화·재방문의 비중을 조정합니다. 합이 1이 되도록 자동 정규화됩니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <ScoreWeightsForm slug={slug} weights={parseWeights(ctx.workspace.settings)} disabled={!canManage} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>AI 사용량 (최근 30일)</CardTitle>
          <CardDescription>실제 AI 호출마다 토큰과 예상 비용을 기록합니다. Mock 호출은 기록하지 않습니다. 비용은 공식 단가표 기준 추정치이며 원화는 1달러 1,400원으로 환산한 참고값입니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">호출 수</div><div className="text-lg font-semibold">{usage.total.calls.toLocaleString("ko-KR")}</div></div>
            <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">입력 토큰</div><div className="text-lg font-semibold">{usage.total.input.toLocaleString("ko-KR")}</div></div>
            <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">출력 토큰</div><div className="text-lg font-semibold">{usage.total.output.toLocaleString("ko-KR")}</div></div>
            <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">예상 비용</div><div className="text-lg font-semibold">${usage.total.usd.toFixed(3)}</div><div className="text-xs text-muted-foreground">{krw(usage.total.usd)}</div></div>
          </div>
          <p className="text-xs text-muted-foreground">캐시 읽기 {usage.total.cacheRead.toLocaleString("ko-KR")} · 캐시 쓰기 {usage.total.cacheWrite.toLocaleString("ko-KR")} 토큰 · 배치 호출 {usage.total.batchCalls}건 (캐시 읽기는 0.1배, 배치는 0.5배로 계산)</p>
          {usage.byKey.length > 0 && (
            <table className="w-full text-xs">
              <thead><tr className="border-b text-left text-muted-foreground"><th className="py-1">작업</th><th className="py-1 text-right">호출</th><th className="py-1 text-right">입력</th><th className="py-1 text-right">출력</th><th className="py-1 text-right">예상 비용</th></tr></thead>
              <tbody>
                {usage.byKey.map((r) => (
                  <tr key={r.key} className="border-b last:border-0"><td className="py-1">{r.key}</td><td className="py-1 text-right">{r.calls}</td><td className="py-1 text-right">{r.input.toLocaleString("ko-KR")}</td><td className="py-1 text-right">{r.output.toLocaleString("ko-KR")}</td><td className="py-1 text-right">${r.usd.toFixed(4)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
          {usage.recent.length > 0 ? (
            <details>
              <summary className="cursor-pointer text-xs text-muted-foreground">최근 호출 {usage.recent.length}건 보기</summary>
              <ul className="mt-2 space-y-1 text-xs">
                {usage.recent.map((r) => (
                  <li key={r.id} className="flex flex-wrap gap-x-2 text-muted-foreground"><span>{formatDateTime(r.createdAt)}</span><span className="text-foreground">{r.promptKey}</span><span>{r.provider}/{r.model}{r.batch ? " · 배치" : ""}{r.cacheReadTokens ? ` · 캐시 ${r.cacheReadTokens.toLocaleString("ko-KR")}` : ""}</span><span>{r.inputTokens.toLocaleString("ko-KR")}→{r.outputTokens.toLocaleString("ko-KR")}</span><span>${r.estimatedUsd.toFixed(4)}</span></li>
                ))}
              </ul>
            </details>
          ) : (
            <p className="text-xs text-muted-foreground">아직 기록된 실제 AI 호출이 없습니다. (API 키 없이 Mock으로 생성한 경우 여기에 잡히지 않습니다.)</p>
          )}
        </CardContent>
      </Card>
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>계정 삭제</CardTitle>
          <CardDescription>내 계정과 소유한 워크스페이스 데이터를 삭제합니다. 되돌릴 수 없습니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <DangerZone />
        </CardContent>
      </Card>
    </div>
  );
}
