import type { Metadata } from "next";
import { requireWorkspacePage } from "@/server/tenancy/context";
import { prisma } from "@/server/db/prisma";
import { can } from "@/server/tenancy/permissions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceSettingsForm, MemberManager, DangerZone } from "./settings-forms";

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
