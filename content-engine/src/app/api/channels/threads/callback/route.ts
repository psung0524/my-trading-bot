import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/auth";
import { exchangeThreadsCode } from "@/server/providers/publish/threads";
import { encryptSecret } from "@/server/security/crypto";
import { audit } from "@/server/security/audit";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? "";
  const jar = await cookies();
  const expected = jar.get("threads_oauth_state")?.value;
  jar.delete("threads_oauth_state");
  const workspaceId = state.split(".")[0];
  const ws = workspaceId ? await prisma.workspace.findUnique({ where: { id: workspaceId } }) : null;
  const back = (q: string) => NextResponse.redirect(new URL(`/w/${ws?.slug ?? ""}/channels?${q}`, req.url));
  if (!code || !expected || expected !== state || !ws) return back("error=oauth_state");
  const user = await getCurrentUser();
  if (!user) return back("error=login");
  const member = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: ws.id, userId: user.id } } });
  if (!member || (member.role !== "OWNER" && member.role !== "ADMIN")) return back("error=forbidden");
  try {
    const redirectUri = `${(process.env.APP_URL || url.origin).replace(/\/$/, "")}/api/channels/threads/callback`;
    const t = await exchangeThreadsCode(process.env.THREADS_APP_ID!, process.env.THREADS_APP_SECRET!, redirectUri, code);
    const acct = await prisma.channelAccount.create({
      data: { workspaceId: ws.id, channel: "THREADS", provider: "threads", displayName: t.username ? `@${t.username}` : `Threads ${t.userId}`, externalId: t.userId, accessTokenEnc: encryptSecret(t.accessToken), tokenExpiresAt: t.expiresAt, scopes: ["threads_basic", "threads_content_publish"] },
    });
    await audit({ workspaceId: ws.id, userId: user.id, action: "channel.connect", entityType: "ChannelAccount", entityId: acct.id, meta: { provider: "threads" } });
    return back("connected=threads");
  } catch (e) {
    return back(`error=${encodeURIComponent((e as Error).message)}`);
  }
}
