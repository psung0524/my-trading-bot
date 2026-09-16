"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/prisma";
import { requireWorkspaceMember } from "@/server/tenancy/context";
import { audit } from "@/server/security/audit";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { zodFieldErrors } from "@/lib/zod-errors";
import { manualAnalysisSchema, productAnalysisSchema, productSchema, type ProductAnalysis } from "@/lib/schemas/product";
import { getProductAnalyzer } from "@/server/providers/analyzer";
import {
  DEFAULT_CHANNEL_SETTINGS, DEFAULT_CONTENT_GOAL, DEFAULT_CTAS, DEFAULT_FINANCE_DISCLAIMER, DEFAULT_FORBIDDEN_PHRASES,
  DEFAULT_OPERATOR_IDENTITY, DEFAULT_PREFERRED_PHRASES, DEFAULT_TARGET_AUDIENCE, DEFAULT_TONE,
} from "@/lib/brand/defaults";

export async function createProductAction(slug: string, input: unknown): Promise<ActionResult<{ productId: string }>> {
  const ctx = await requireWorkspaceMember(slug, "manageBrand");
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return fail("입력값을 확인하세요", zodFieldErrors(parsed.error));
  const { name, url, description } = parsed.data;

  const product = await prisma.product.create({
    data: {
      workspaceId: ctx.workspace.id,
      name,
      url,
      description,
      brandProfile: {
        create: {
          brandName: name,
          operatorIdentity: DEFAULT_OPERATOR_IDENTITY,
          targetAudience: DEFAULT_TARGET_AUDIENCE,
          contentGoal: DEFAULT_CONTENT_GOAL,
          tone: DEFAULT_TONE,
          preferredPhrases: DEFAULT_PREFERRED_PHRASES,
          forbiddenPhrases: DEFAULT_FORBIDDEN_PHRASES,
          ctas: DEFAULT_CTAS.map((c) => ({ ...c, url: c.url || url })),
          financeDisclaimer: DEFAULT_FINANCE_DISCLAIMER,
          channelSettings: DEFAULT_CHANNEL_SETTINGS,
          rules: {
            create: DEFAULT_FORBIDDEN_PHRASES.map((v) => ({ kind: "FORBIDDEN_PHRASE" as const, value: v, note: "기본 금지 표현" })),
          },
        },
      },
    },
  });
  await audit({ workspaceId: ctx.workspace.id, userId: ctx.user.id, action: "product.create", entityType: "Product", entityId: product.id });
  revalidatePath(`/w/${slug}`, "layout");
  return ok({ productId: product.id });
}

export async function updateProductAction(slug: string, productId: string, input: unknown): Promise<ActionResult<undefined>> {
  const ctx = await requireWorkspaceMember(slug, "manageBrand");
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return fail("입력값을 확인하세요", zodFieldErrors(parsed.error));
  const r = await prisma.product.updateMany({
    where: { id: productId, workspaceId: ctx.workspace.id, deletedAt: null },
    data: parsed.data,
  });
  if (r.count === 0) return fail("제품을 찾을 수 없습니다");
  await audit({ workspaceId: ctx.workspace.id, userId: ctx.user.id, action: "product.update", entityType: "Product", entityId: productId });
  revalidatePath(`/w/${slug}/products/${productId}`);
  return ok(undefined);
}

export async function analyzeProductAction(slug: string, productId: string): Promise<ActionResult<ProductAnalysis>> {
  const ctx = await requireWorkspaceMember(slug, "manageBrand");
  const product = await prisma.product.findFirst({ where: { id: productId, workspaceId: ctx.workspace.id, deletedAt: null } });
  if (!product) return fail("제품을 찾을 수 없습니다");
  const analysis = productAnalysisSchema.parse(await getProductAnalyzer().analyze(product.url));
  await prisma.product.update({ where: { id: product.id }, data: { analysis, analyzedAt: new Date() } });
  await audit({ workspaceId: ctx.workspace.id, userId: ctx.user.id, action: "product.analyze", entityType: "Product", entityId: product.id, meta: { method: analysis.method } });
  revalidatePath(`/w/${slug}/products/${productId}`);
  return ok(analysis);
}

export async function saveManualAnalysisAction(slug: string, productId: string, input: unknown): Promise<ActionResult<undefined>> {
  const ctx = await requireWorkspaceMember(slug, "manageBrand");
  const parsed = manualAnalysisSchema.safeParse(input);
  if (!parsed.success) return fail("입력값을 확인하세요", zodFieldErrors(parsed.error));
  const product = await prisma.product.findFirst({ where: { id: productId, workspaceId: ctx.workspace.id, deletedAt: null } });
  if (!product) return fail("제품을 찾을 수 없습니다");
  const prev = productAnalysisSchema.safeParse(product.analysis);
  const base: ProductAnalysis = prev.success ? prev.data : productAnalysisSchema.parse({});
  const split = (s: string) => s.split(/[\n,]/).map((x) => x.trim()).filter(Boolean).slice(0, 30);
  const analysis: ProductAnalysis = {
    ...base,
    features: split(parsed.data.features),
    keywords: split(parsed.data.keywords),
    audience: parsed.data.audience,
    method: "manual",
    error: undefined,
  };
  await prisma.product.update({ where: { id: product.id }, data: { analysis, analyzedAt: new Date() } });
  revalidatePath(`/w/${slug}/products/${productId}`);
  return ok(undefined);
}

export async function deleteProductAction(slug: string, productId: string): Promise<ActionResult<undefined>> {
  const ctx = await requireWorkspaceMember(slug, "manageWorkspace");
  const r = await prisma.product.updateMany({ where: { id: productId, workspaceId: ctx.workspace.id, deletedAt: null }, data: { deletedAt: new Date() } });
  if (r.count === 0) return fail("제품을 찾을 수 없습니다");
  await audit({ workspaceId: ctx.workspace.id, userId: ctx.user.id, action: "product.delete", entityType: "Product", entityId: productId });
  revalidatePath(`/w/${slug}`, "layout");
  return ok(undefined);
}
