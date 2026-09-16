import type { Prisma } from "@prisma/client";
import { getJobQueue } from "@/server/providers/queue";
import { getJobHandler } from "./registry";
import "./handlers";

/**
 * Job 실행기. JOB_RUNNER=inline이면 enqueue 직후 같은 프로세스에서 즉시 처리한다.
 */
export async function enqueueJob(input: {
  type: string;
  payload: Prisma.InputJsonValue;
  workspaceId?: string | null;
  idempotencyKey?: string;
  runAt?: Date;
  maxAttempts?: number;
}) {
  const queue = getJobQueue();
  const res = await queue.enqueue(input);
  const inline = (process.env.JOB_RUNNER ?? "inline") === "inline";
  const scheduledLater = input.runAt && input.runAt.getTime() > Date.now() + 1000;
  if (inline && !res.deduplicated && !scheduledLater) {
    await processOne(`inline-${process.pid}`, [input.type]);
  }
  return res;
}

/** Job 하나를 가져와 처리. 처리한 경우 true */
export async function processOne(workerId: string, types?: string[]): Promise<boolean> {
  const queue = getJobQueue();
  const job = await queue.claim(workerId, types);
  if (!job) return false;
  const logs: string[] = [];
  const log = (m: string) => logs.push(`[${new Date().toISOString()}] ${m}`);
  const handler = getJobHandler(job.type);
  if (!handler) {
    await queue.fail(job.id, `핸들러 없음: ${job.type}`, logs);
    return true;
  }
  try {
    log(`시작 (attempt ${job.attempts}/${job.maxAttempts})`);
    const result = await handler(job.payload, { jobId: job.id, attempt: job.attempts, log });
    log("완료");
    await queue.complete(job.id, result ?? undefined, logs);
  } catch (e) {
    const msg = e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e);
    log(`실패: ${msg}`);
    console.error(`job ${job.type} 실패`, e);
    await queue.fail(job.id, e instanceof Error ? e.message : String(e), logs);
  }
  return true;
}
