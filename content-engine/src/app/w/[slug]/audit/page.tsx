import type { Metadata } from "next";
import { requireWorkspacePage } from "@/server/tenancy/context";
import { prisma } from "@/server/db/prisma";
import { PageHeader } from "@/components/app/page-header";
import { formatDateTime } from "@/lib/format/date";

export const metadata: Metadata = { title: "감사 로그" };

export default async function AuditPage(props: PageProps<"/w/[slug]/audit">) {
  const { slug } = await props.params;
  const ctx = await requireWorkspacePage(slug, "viewAudit");
  const logs = await prisma.auditLog.findMany({ where: { workspaceId: ctx.workspace.id }, orderBy: { createdAt: "desc" }, take: 200, include: { user: { select: { name: true, email: true } } } });
  return (
    <div>
      <PageHeader title="감사 로그" description="누가 언제 무엇을 했는지 기록합니다. 최근 200건." />
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs"><tr><th className="p-2">시각</th><th className="p-2">사용자</th><th className="p-2">동작</th><th className="p-2">대상</th><th className="p-2">상세</th></tr></thead>
          <tbody>
            {logs.length === 0 && <tr><td colSpan={5} className="p-3 text-muted-foreground">기록이 없습니다.</td></tr>}
            {logs.map((l) => (
              <tr key={l.id} className="border-t align-top">
                <td className="whitespace-nowrap p-2 text-xs text-muted-foreground">{formatDateTime(l.createdAt)}</td>
                <td className="p-2 text-xs">{l.user?.name || l.user?.email || "시스템"}</td>
                <td className="p-2 font-mono text-xs">{l.action}</td>
                <td className="p-2 text-xs">{l.entityType}{l.entityId ? ` ${l.entityId.slice(0, 8)}…` : ""}</td>
                <td className="max-w-md truncate p-2 font-mono text-xs text-muted-foreground">{JSON.stringify(l.meta)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
