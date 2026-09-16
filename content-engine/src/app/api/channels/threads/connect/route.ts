import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireWorkspaceMember } from "@/server/tenancy/context";
import { threadsAuthorizeUrl } from "@/server/providers/publish/threads";
import { randomToken } from "@/server/security/crypto";

/** Threads OAuth 시작. THREADS_APP_ID/SECRET이 없으면 안내로 돌아간다 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("workspace") ?? "";
  try {
    const ctx = await requireWorkspaceMember(slug, "manageChannels");
    if (!process.env.THREADS_APP_ID || !process.env.THREADS_APP_SECRET) {
      return NextResponse.redirect(new URL(`/w/${slug}/channels?error=threads_not_configured`, req.url));
    }
    const state = `${ctx.workspace.id}.${randomToken(12)}`;
    const jar = await cookies();
    jar.set("threads_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: url.protocol === "https:", maxAge: 600, path: "/" });
    const redirectUri = `${(process.env.APP_URL || url.origin).replace(/\/$/, "")}/api/channels/threads/callback`;
    return NextResponse.redirect(threadsAuthorizeUrl(process.env.THREADS_APP_ID, redirectUri, state));
  } catch {
    return NextResponse.redirect(new URL(`/login?next=/w/${slug}/channels`, req.url));
  }
}
