"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/prisma";
import { createWorkspaceSchema, RESERVED_SLUGS } from "@/lib/schemas/workspace";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireUser, requireWorkspaceMember } from "@/server/tenancy/context";
import { audit } from "@/server/security/audit";
import { z } from "zod";
import { zodFieldErrors } from "@/lib/zod-errors";

export async function createWorkspaceAction(
  input: unknown,
): Promise<ActionResult<{ slug: string }>> {
  const user = await requireUser();
  const parsed = createWorkspaceSchema.safeParse(input);
  if (!parsed.success) {
    return fail("입력값을 확인하세요", zodFieldErrors(parsed.error));
  }
  const { name, slug } = parsed.data;
  if (RESERVED_SLUGS.has(slug)) return fail("사용할 수 없는 슬러그입니다", { slug: ["예약된 단어입니다"] });
  const taken = await prisma.workspace.findUnique({ where: { slug } });
  if (taken) return fail("이미 사용 중인 슬러그입니다", { slug: ["이미 사용 중입니다"] });

  const ws = await prisma.workspace.create({
    data: {
      name,
      slug,
      members: { create: { userId: user.id, role: "OWNER" } },
    },
  });
  await audit({ workspaceId: ws.id, userId: user.id, action: "workspace.create", entityType: "Workspace", entityId: ws.id });
  return ok({ slug: ws.slug });
}

const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(60),
});

export async function updateWorkspaceAction(slug: string, input: unknown): Promise<ActionResult<undefined>> {
  const ctx = await requireWorkspaceMember(slug, "manageWorkspace");
  const parsed = updateWorkspaceSchema.safeParse(input);
  if (!parsed.success) return fail("입력값을 확인하세요", zodFieldErrors(parsed.error));
  await prisma.workspace.update({ where: { id: ctx.workspace.id }, data: { name: parsed.data.name } });
  await audit({ workspaceId: ctx.workspace.id, userId: ctx.user.id, action: "workspace.update", entityType: "Workspace", entityId: ctx.workspace.id });
  revalidatePath(`/w/${slug}`, "layout");
  return ok(undefined);
}

const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["ADMIN", "EDITOR", "VIEWER"]),
});

export async function addMemberAction(slug: string, input: unknown): Promise<ActionResult<undefined>> {
  const ctx = await requireWorkspaceMember(slug, "manageMembers");
  const parsed = addMemberSchema.safeParse(input);
  if (!parsed.success) return fail("입력값을 확인하세요", zodFieldErrors(parsed.error));
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) return fail("해당 이메일로 가입한 사용자가 없습니다. 먼저 회원가입이 필요합니다");
  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: ctx.workspace.id, userId: user.id } },
    create: { workspaceId: ctx.workspace.id, userId: user.id, role: parsed.data.role },
    update: { role: parsed.data.role },
  });
  await audit({ workspaceId: ctx.workspace.id, userId: ctx.user.id, action: "member.add", entityType: "WorkspaceMember", entityId: user.id, meta: { role: parsed.data.role } });
  revalidatePath(`/w/${slug}/settings`);
  return ok(undefined);
}

export async function removeMemberAction(slug: string, memberUserId: string): Promise<ActionResult<undefined>> {
  const ctx = await requireWorkspaceMember(slug, "manageMembers");
  if (memberUserId === ctx.user.id) return fail("소유자는 자신을 제거할 수 없습니다");
  await prisma.workspaceMember.deleteMany({ where: { workspaceId: ctx.workspace.id, userId: memberUserId, role: { not: "OWNER" } } });
  await audit({ workspaceId: ctx.workspace.id, userId: ctx.user.id, action: "member.remove", entityType: "WorkspaceMember", entityId: memberUserId });
  revalidatePath(`/w/${slug}/settings`);
  return ok(undefined);
}

/** 사용자 데이터 삭제: 소유한 워크스페이스는 soft delete, 계정은 익명화 */
export async function deleteMyAccountAction(): Promise<ActionResult<undefined>> {
  const user = await requireUser();
  const owned = await prisma.workspaceMember.findMany({ where: { userId: user.id, role: "OWNER" }, select: { workspaceId: true } });
  await prisma.$transaction([
    prisma.workspace.updateMany({ where: { id: { in: owned.map((o) => o.workspaceId) } }, data: { deletedAt: new Date() } }),
    prisma.workspaceMember.deleteMany({ where: { userId: user.id } }),
    prisma.user.update({
      where: { id: user.id },
      data: { deletedAt: new Date(), email: `deleted-${user.id}@deleted.local`, name: "삭제된 사용자", passwordHash: null, image: null },
    }),
  ]);
  await audit({ userId: user.id, action: "user.delete", entityType: "User", entityId: user.id });
  return ok(undefined);
}
