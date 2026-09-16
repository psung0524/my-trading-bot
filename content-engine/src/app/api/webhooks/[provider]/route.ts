import { NextResponse } from "next/server";
import { hmacVerify } from "@/server/security/crypto";
import { prisma } from "@/server/db/prisma";

/**
 * 외부 플랫폼 웹훅 수신. 서명 검증 실패 시 401.
 * - threads/meta: X-Hub-Signature-256 (앱 시크릿 HMAC)
 * - 기타: X-Signature-256 (WEBHOOK_SECRET HMAC)
 */
export async function POST(req: Request, ctx: RouteContext<"/api/webhooks/[provider]">) {
  const { provider } = await ctx.params;
  const raw = await req.text();
  const secret = provider === "threads" ? process.env.THREADS_APP_SECRET : process.env.WEBHOOK_SECRET;
  const sig = req.headers.get("x-hub-signature-256") ?? req.headers.get("x-signature-256") ?? "";
  if (!secret || !sig || !hmacVerify(secret, raw, sig)) return NextResponse.json({ error: "서명 검증 실패" }, { status: 401 });
  let payload: unknown = null;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "JSON 아님" }, { status: 400 });
  }
  await prisma.auditLog.create({ data: { action: `webhook.${provider}`, entityType: "Webhook", meta: payload as object } });
  return NextResponse.json({ ok: true });
}

/** Meta 웹훅 검증 핸드셰이크 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  if (u.searchParams.get("hub.mode") === "subscribe" && u.searchParams.get("hub.verify_token") === (process.env.WEBHOOK_SECRET ?? "")) {
    return new NextResponse(u.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "검증 실패" }, { status: 403 });
}
