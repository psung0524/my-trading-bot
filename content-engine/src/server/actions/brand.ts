"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/prisma";
import { requireWorkspaceMember } from "@/server/tenancy/context";
import { audit } from "@/server/security/audit";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { zodFieldErrors } from "@/lib/zod-errors";
import { brandProfileSchema, brandRuleSchema } from "@/lib/schemas/product";

async function ownedProduct(workspaceId: string, productId: string) {
  return prisma.product.findFirst({ where: { id: productId, workspaceId, deletedAt: null }, include: { brandProfile: true } });
}

export async function saveBrandProfileAction(slug: string, productId: string, input: unknown): Promise<ActionResult<undefined>> {
  const ctx = await requireWorkspaceMember(slug, "manageBrand");
  const parsed = brandProfileSchema.safeParse(input);
  if (!parsed.success) return fail("입력값을 확인하세요", zodFieldErrors(parsed.error));
  const product = await ownedProduct(ctx.workspace.id, productId);
  if (!product) return fail("제품을 찾을 수 없습니다");
  const data = parsed.data;
  await prisma.brandProfile.upsert({
    where: { productId: product.id },
    create: { productId: product.id, ...data },
    update: data,
  });
  await audit({ workspaceId: ctx.workspace.id, userId: ctx.user.id, action: "brand.update", entityType: "BrandProfile", entityId: product.id });
  revalidatePath(`/w/${slug}/brand`);
  return ok(undefined);
}

export async function addBrandRuleAction(slug: string, productId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireWorkspaceMember(slug, "manageBrand");
  const parsed = brandRuleSchema.safeParse(input);
  if (!parsed.success) return fail("입력값을 확인하세요", zodFieldErrors(parsed.error));
  const product = await ownedProduct(ctx.workspace.id, productId);
  if (!product?.brandProfile) return fail("브랜드 프로필을 먼저 저장하세요");
  const rule = await prisma.brandRule.create({ data: { brandProfileId: product.brandProfile.id, ...parsed.data } });
  revalidatePath(`/w/${slug}/brand`);
  return ok({ id: rule.id });
}

export async function toggleBrandRuleAction(slug: string, ruleId: string, enabled: boolean): Promise<ActionResult<undefined>> {
  const ctx = await requireWorkspaceMember(slug, "manageBrand");
  const r = await prisma.brandRule.updateMany({
    where: { id: ruleId, brandProfile: { product: { workspaceId: ctx.workspace.id } } },
    data: { enabled },
  });
  if (r.count === 0) return fail("규칙을 찾을 수 없습니다");
  revalidatePath(`/w/${slug}/brand`);
  return ok(undefined);
}

export async function deleteBrandRuleAction(slug: string, ruleId: string): Promise<ActionResult<undefined>> {
  const ctx = await requireWorkspaceMember(slug, "manageBrand");
  const r = await prisma.brandRule.deleteMany({ where: { id: ruleId, brandProfile: { product: { workspaceId: ctx.workspace.id } } } });
  if (r.count === 0) return fail("규칙을 찾을 수 없습니다");
  revalidatePath(`/w/${slug}/brand`);
  return ok(undefined);
}
