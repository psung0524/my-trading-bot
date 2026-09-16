"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/prisma";
import { requireWorkspaceMember } from "@/server/tenancy/context";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { audit } from "@/server/security/audit";

export async function setLearningStatusAction(slug: string, id: string, status: "ACCEPTED" | "DELETED" | "PENDING"): Promise<ActionResult<undefined>> {
  const ctx = await requireWorkspaceMember(slug, "manageBrand");
  if (!["ACCEPTED", "DELETED", "PENDING"].includes(status)) return fail("잘못된 상태");
  const r = await prisma.brandLearning.updateMany({ where: { id, workspaceId: ctx.workspace.id }, data: { status } });
  if (r.count === 0) return fail("항목을 찾을 수 없습니다");
  await audit({ workspaceId: ctx.workspace.id, userId: ctx.user.id, action: `learning.${status.toLowerCase()}`, entityType: "BrandLearning", entityId: id });
  revalidatePath(`/w/${slug}/learning`);
  return ok(undefined);
}
