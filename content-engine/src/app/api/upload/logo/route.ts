import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { requireWorkspaceMember, AuthError, ForbiddenError } from "@/server/tenancy/context";
import { getStorage } from "@/server/providers/storage";
import { audit } from "@/server/security/audit";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const MAGIC: Record<string, number[]> = { png: [0x89, 0x50, 0x4e, 0x47], jpg: [0xff, 0xd8, 0xff], webp: [0x52, 0x49, 0x46, 0x46] };

/** 브랜드 로고 업로드: PNG/JPEG/WebP, 2MB 이하, 매직 바이트 검사 */
function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") !== "cross-site";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "교차 출처 요청은 허용되지 않습니다" }, { status: 403 });
  const form = await req.formData().catch(() => null);
  const slug = String(form?.get("workspace") ?? "");
  const productId = String(form?.get("productId") ?? "");
  const file = form?.get("file");
  try {
    const ctx = await requireWorkspaceMember(slug, "manageBrand");
    if (!(file instanceof File)) return NextResponse.json({ error: "파일이 없습니다" }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "2MB 이하만 업로드할 수 있습니다" }, { status: 413 });
    const ext = ALLOWED[file.type];
    if (!ext) return NextResponse.json({ error: "PNG, JPEG, WebP만 허용됩니다" }, { status: 415 });
    const buf = Buffer.from(await file.arrayBuffer());
    const magic = MAGIC[ext];
    if (!magic.every((b, i) => buf[i] === b)) return NextResponse.json({ error: "파일 형식이 올바르지 않습니다" }, { status: 415 });
    const product = await prisma.product.findFirst({ where: { id: productId, workspaceId: ctx.workspace.id, deletedAt: null }, include: { brandProfile: true } });
    if (!product?.brandProfile) return NextResponse.json({ error: "브랜드 프로필이 없습니다" }, { status: 404 });
    const key = `ws/${ctx.workspace.id}/brand/${product.id}/logo-${Date.now().toString(36)}.${ext}`;
    await getStorage().put(key, buf, file.type);
    const asset = await prisma.creativeAsset.create({ data: { workspaceId: ctx.workspace.id, kind: "LOGO", storageKey: key, mimeType: file.type, sizeBytes: buf.length } });
    await prisma.brandProfile.update({ where: { id: product.brandProfile.id }, data: { logoAssetId: asset.id } });
    await audit({ workspaceId: ctx.workspace.id, userId: ctx.user.id, action: "brand.logo_upload", entityType: "CreativeAsset", entityId: asset.id, meta: { size: buf.length, type: file.type } });
    return NextResponse.json({ ok: true, url: getStorage().url(key) });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
