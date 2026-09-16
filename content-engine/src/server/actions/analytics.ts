"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspaceMember } from "@/server/tenancy/context";
import { rollupDaily } from "@/server/analytics/performance";
import { fail, ok, type ActionResult } from "@/lib/action-result";

export async function rollupTodayAction(slug: string): Promise<ActionResult<{ rows: number }>> {
  const ctx = await requireWorkspaceMember(slug, "viewContent");
  try {
    const rows = await rollupDaily(ctx.workspace.id);
    revalidatePath(`/w/${slug}/analytics`);
    return ok({ rows });
  } catch (e) {
    return fail((e as Error).message);
  }
}
