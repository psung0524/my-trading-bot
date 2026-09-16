import { NextResponse } from "next/server";
import { collectBatchSchema, collectEventSchema } from "@/lib/schemas/analytics";
import { ingestEvents } from "@/server/analytics/ingest";
import { rateLimiter, clientIp } from "@/server/security/rate-limit";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type", "access-control-max-age": "86400" };

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/** 공개 이벤트 수집 엔드포인트 (SDK가 호출). 인증 없음 → 엄격한 검증 + rate limit */
export async function POST(req: Request) {
  const ip = clientIp(req.headers);
  const rl = await rateLimiter.check(`collect:${ip}`, 300, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "too many requests" }, { status: 429, headers: CORS });
  let json: unknown;
  try {
    const text = await req.text();
    if (text.length > 64_000) return NextResponse.json({ error: "payload too large" }, { status: 413, headers: CORS });
    json = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400, headers: CORS });
  }
  const batch = collectBatchSchema.safeParse(json);
  const single = batch.success ? null : collectEventSchema.safeParse(json);
  if (!batch.success && !single?.success) return NextResponse.json({ error: "invalid event" }, { status: 400, headers: CORS });
  const events = batch.success ? batch.data.events : [single!.data!];
  const stored = await ingestEvents(events);
  return NextResponse.json({ ok: true, stored }, { headers: { ...CORS, "cache-control": "no-store" } });
}
