import "server-only";
import { redirect } from "next/navigation";
import type { Workspace, WorkspaceMember, WorkspaceRole } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/auth";
import { can, type Permission } from "@/server/tenancy/permissions";

export class AuthError extends Error {
  constructor(message = "로그인이 필요합니다") {
    super(message);
    this.name = "AuthError";
  }
}
export class ForbiddenError extends Error {
  constructor(message = "권한이 없습니다") {
    super(message);
    this.name = "ForbiddenError";
  }
}
export class NotFoundError extends Error {
  constructor(message = "찾을 수 없습니다") {
    super(message);
    this.name = "NotFoundError";
  }
}

export type WorkspaceContext = {
  user: { id: string; email: string; name: string };
  workspace: Workspace;
  member: WorkspaceMember;
  role: WorkspaceRole;
};

/**
 * 워크스페이스 접근 컨텍스트. 모든 서버 액션/페이지는 이 함수를 통해서만 workspaceId를 얻는다.
 * slug 또는 id를 받는다. permission이 주어지면 해당 최소 역할을 검사한다.
 */
export async function requireWorkspaceMember(
  slugOrId: string,
  permission?: Permission,
): Promise<WorkspaceContext> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError();

  const workspace = await prisma.workspace.findFirst({
    where: { OR: [{ slug: slugOrId }, { id: slugOrId }], deletedAt: null },
  });
  if (!workspace) throw new NotFoundError("워크스페이스를 찾을 수 없습니다");

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
  });
  if (!member) throw new ForbiddenError("이 워크스페이스의 멤버가 아닙니다");
  if (permission && !can(member.role, permission)) {
    throw new ForbiddenError("이 작업을 수행할 권한이 없습니다");
  }
  return { user, workspace, member, role: member.role };
}

/** 페이지용: 예외를 리다이렉트/404로 변환 */
export async function requireWorkspacePage(slug: string, permission?: Permission) {
  try {
    return await requireWorkspaceMember(slug, permission);
  } catch (e) {
    if (e instanceof AuthError) redirect(`/login?next=/w/${slug}`);
    if (e instanceof NotFoundError || e instanceof ForbiddenError) redirect("/onboarding?error=forbidden");
    throw e;
  }
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new AuthError();
  return user;
}

export async function requireUserPage(nextPath = "/onboarding") {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return user;
}
