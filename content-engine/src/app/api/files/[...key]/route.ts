import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/auth";
import { getStorage, mimeOf, workspaceOfKey } from "@/server/providers/storage";

/** 스토리지 파일 서빙. 키의 워크스페이스 멤버만 접근 가능 */
export async function GET(_req: Request, ctx: RouteContext<"/api/files/[...key]">) {
  const { key: parts } = await ctx.params;
  const key = parts.join("/");
  const wsId = workspaceOfKey(key);
  if (!wsId) return NextResponse.json({ error: "잘못된 키" }, { status: 400 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  const member = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: wsId, userId: user.id } } });
  if (!member) return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  const storage = getStorage();
  if (!(await storage.exists(key))) return NextResponse.json({ error: "파일 없음" }, { status: 404 });
  const data = await storage.get(key);
  const filename = key.split("/").pop() ?? "file";
  const download = new URL(_req.url).searchParams.get("download") === "1";
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "content-type": mimeOf(filename),
      "content-length": String(data.length),
      "cache-control": "private, max-age=3600",
      ...(download ? { "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}` } : {}),
    },
  });
}
