"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { requireWorkspaceMember } from "@/server/tenancy/context";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { addReference, analyzeStyle, fetchReference, saveStyleGuide, styleGuideSchema, type StyleGuide } from "@/server/content/references";
import { httpUrlSchema } from "@/lib/schemas/product";

const channelSchema = z.enum(["THREADS", "INSTAGRAM", "BLOG", "YOUTUBE_SHORTS"]);

export async function importReferenceUrlsAction(slug: string, productId: string, channel: string, urlsText: string): Promise<ActionResult<{ imported: number; errors: string[] }>> {
  const ctx = await requireWorkspaceMember(slug, "manageBrand");
  const ch = channelSchema.safeParse(channel);
  if (!ch.success) return fail("잘못된 채널");
  const urls = [...new Set(urlsText.split(/\s+/).map((u) => u.trim()).filter(Boolean))].slice(0, 20);
  if (urls.length === 0) return fail("URL을 입력하세요");
  let imported = 0;
  const errors: string[] = [];
  for (const u of urls) {
    const v = httpUrlSchema.safeParse(u);
    if (!v.success) {
      errors.push(`${u}: 올바른 URL이 아닙니다`);
      continue;
    }
    try {
      const r = await fetchReference(v.data);
      await addReference(ctx.workspace.id, { productId, channel: ch.data, title: r.title, content: r.text, url: r.url, source: "URL" }, ctx.user.id);
      imported++;
    } catch (e) {
      errors.push(`${u}: ${(e as Error).message}`);
    }
  }
  revalidatePath(`/w/${slug}/brand/references`);
  return ok({ imported, errors });
}

const pasteSchema = z.object({ title: z.string().trim().max(200).default(""), content: z.string().trim().min(100, "본문은 100자 이상이어야 합니다").max(12_000), note: z.string().trim().max(200).default("") });

export async function addReferencePasteAction(slug: string, productId: string, channel: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireWorkspaceMember(slug, "manageBrand");
  const ch = channelSchema.safeParse(channel);
  if (!ch.success) return fail("잘못된 채널");
  const parsed = pasteSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "입력값을 확인하세요");
  const ref = await addReference(ctx.workspace.id, { productId, channel: ch.data, title: parsed.data.title || parsed.data.content.slice(0, 40), content: parsed.data.content, source: "PASTE", note: parsed.data.note }, ctx.user.id);
  revalidatePath(`/w/${slug}/brand/references`);
  return ok({ id: ref.id });
}

export async function deleteReferenceAction(slug: string, id: string): Promise<ActionResult<undefined>> {
  const ctx = await requireWorkspaceMember(slug, "manageBrand");
  const r = await prisma.referencePost.updateMany({ where: { id, workspaceId: ctx.workspace.id, deletedAt: null }, data: { deletedAt: new Date() } });
  if (r.count === 0) return fail("찾을 수 없습니다");
  revalidatePath(`/w/${slug}/brand/references`);
  return ok(undefined);
}

export async function analyzeStyleAction(slug: string, productId: string, channel: string): Promise<ActionResult<StyleGuide>> {
  const ctx = await requireWorkspaceMember(slug, "manageBrand");
  const ch = channelSchema.safeParse(channel);
  if (!ch.success) return fail("잘못된 채널");
  try {
    const guide = await analyzeStyle(ctx.workspace.id, productId, ch.data, ctx.user.id);
    revalidatePath(`/w/${slug}/brand/references`);
    return ok(guide);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function saveStyleGuideAction(slug: string, productId: string, channel: string, input: unknown): Promise<ActionResult<undefined>> {
  const ctx = await requireWorkspaceMember(slug, "manageBrand");
  const ch = channelSchema.safeParse(channel);
  if (!ch.success) return fail("잘못된 채널");
  const parsed = styleGuideSchema.safeParse(input);
  if (!parsed.success) return fail("입력값을 확인하세요");
  try {
    await saveStyleGuide(ctx.workspace.id, productId, ch.data, parsed.data);
    revalidatePath(`/w/${slug}/brand/references`);
    return ok(undefined);
  } catch (e) {
    return fail((e as Error).message);
  }
}
