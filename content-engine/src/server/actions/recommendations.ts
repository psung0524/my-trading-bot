"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { requireWorkspaceMember } from "@/server/tenancy/context";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { applyRecommendation, generateRecommendations } from "@/server/analytics/recommendations";
import { audit } from "@/server/security/audit";
import type { Prisma } from "@prisma/client";

export async function generateRecommendationsAction(slug: string): Promise<ActionResult<{ created: number }>> {
  const ctx = await requireWorkspaceMember(slug, "editContent");
  try {
    const r = await generateRecommendations(ctx.workspace.id);
    await audit({ workspaceId: ctx.workspace.id, userId: ctx.user.id, action: "recommendation.generate", entityType: "Recommendation", meta: { created: r.created } });
    revalidatePath(`/w/${slug}`, "layout");
    return ok({ created: r.created });
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function acceptRecommendationAction(slug: string, id: string): Promise<ActionResult<{ result: string }>> {
  const ctx = await requireWorkspaceMember(slug, "approveContent");
  try {
    const result = await applyRecommendation(ctx.workspace.id, id, ctx.user.id);
    await audit({ workspaceId: ctx.workspace.id, userId: ctx.user.id, action: "recommendation.accept", entityType: "Recommendation", entityId: id, meta: { result } });
    revalidatePath(`/w/${slug}`, "layout");
    return ok({ result });
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function dismissRecommendationAction(slug: string, id: string): Promise<ActionResult<undefined>> {
  const ctx = await requireWorkspaceMember(slug, "editContent");
  const r = await prisma.recommendation.updateMany({ where: { id, workspaceId: ctx.workspace.id }, data: { status: "DISMISSED" } });
  if (r.count === 0) return fail("추천을 찾을 수 없습니다");
  revalidatePath(`/w/${slug}`, "layout");
  return ok(undefined);
}

const weightsSchema = z.object({ click: z.number().min(0).max(1), signup: z.number().min(0).max(1), activation: z.number().min(0).max(1), return: z.number().min(0).max(1) });

export async function saveScoreWeightsAction(slug: string, input: unknown): Promise<ActionResult<undefined>> {
  const ctx = await requireWorkspaceMember(slug, "manageWorkspace");
  const parsed = weightsSchema.safeParse(input);
  if (!parsed.success) return fail("가중치는 0~1 사이 숫자여야 합니다");
  const settings = (ctx.workspace.settings as Record<string, unknown>) ?? {};
  await prisma.workspace.update({ where: { id: ctx.workspace.id }, data: { settings: { ...settings, scoreWeights: parsed.data } as Prisma.InputJsonValue } });
  revalidatePath(`/w/${slug}/settings`);
  return ok(undefined);
}
