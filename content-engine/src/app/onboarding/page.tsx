import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db/prisma";
import { requireUserPage } from "@/server/tenancy/context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/server/actions/auth";
import { CreateWorkspaceForm } from "./create-workspace-form";

export const metadata: Metadata = { title: "워크스페이스" };

export default async function OnboardingPage(props: PageProps<"/onboarding">) {
  const user = await requireUserPage("/onboarding");
  const sp = await props.searchParams;
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: user.id, workspace: { deletedAt: null } },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });

  if (memberships.length === 1 && sp.new !== "1" && sp.error !== "forbidden") {
    redirect(`/w/${memberships[0].workspace.slug}`);
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">워크스페이스</h1>
        <form action={logoutAction}>
          <Button variant="ghost" size="sm" type="submit">
            로그아웃
          </Button>
        </form>
      </div>
      {sp.error === "forbidden" && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          접근 권한이 없는 워크스페이스입니다.
        </p>
      )}
      {memberships.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>내 워크스페이스</CardTitle>
            <CardDescription>참여 중인 워크스페이스를 선택하세요.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {memberships.map((m) => (
              <Button key={m.id} asChild variant="outline" className="justify-between">
                <Link href={`/w/${m.workspace.slug}`}>
                  <span>{m.workspace.name}</span>
                  <span className="text-xs text-muted-foreground">{m.role}</span>
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{memberships.length ? "새 워크스페이스 만들기" : "첫 워크스페이스 만들기"}</CardTitle>
          <CardDescription>워크스페이스는 제품, 브랜드, 콘텐츠와 팀 멤버를 담는 단위입니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <CreateWorkspaceForm />
        </CardContent>
      </Card>
    </main>
  );
}
