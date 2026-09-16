import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { processOne } from "@/server/jobs/runner";

/**
 * 외부 크론(예: Vercel Cron, GitHub Actions)이 호출하는 Job 처리 엔드포인트.
 * Authorization: Bearer ${CRON_SECRET}. 워커 프로세스가 있으면 필요 없다.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const auth = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!secret || auth.length !== secret.length || !timingSafeEqual(Buffer.from(auth), Buffer.from(secret))) {
    return NextResponse.json({ error: "권한 없음" }, { status: 401 });
  }
  let processed = 0;
  for (let i = 0; i < 20; i++) {
    if (!(await processOne(`cron-${process.pid}`))) break;
    processed++;
  }
  return NextResponse.json({ processed });
}
