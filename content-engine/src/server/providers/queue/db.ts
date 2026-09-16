import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import type { JobQueueProvider, JobRecord } from "./types";

const LOCK_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * PostgreSQL 기반 Job Queue. SELECT ... FOR UPDATE SKIP LOCKED로 중복 실행을 막는다.
 * 오래 잠긴(10분) PROCESSING Job은 워커 사망으로 보고 다시 가져온다.
 */
export class DbJobQueue implements JobQueueProvider {
  async enqueue(input: Parameters<JobQueueProvider["enqueue"]>[0]) {
    if (input.idempotencyKey) {
      const existing = await prisma.job.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (existing && existing.status !== "FAILED" && existing.status !== "CANCELED") return { jobId: existing.id, deduplicated: true };
      if (existing) {
        // 실패한 Job은 같은 키로 재큐잉
        await prisma.job.update({ where: { id: existing.id }, data: { status: "QUEUED", attempts: 0, lastError: null, runAt: input.runAt ?? new Date(), payload: input.payload, lockedAt: null, lockedBy: null } });
        return { jobId: existing.id, deduplicated: false };
      }
    }
    const job = await prisma.job.create({
      data: {
        type: input.type,
        payload: input.payload,
        workspaceId: input.workspaceId ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        runAt: input.runAt ?? new Date(),
        maxAttempts: input.maxAttempts ?? 3,
      },
    });
    return { jobId: job.id, deduplicated: false };
  }

  async claim(workerId: string, types?: string[]): Promise<JobRecord | null> {
    const staleBefore = new Date(Date.now() - LOCK_TIMEOUT_MS);
    const typeFilter = types && types.length ? Prisma.sql`AND "type" IN (${Prisma.join(types)})` : Prisma.empty;
    const rows = await prisma.$queryRaw<JobRecord[]>(Prisma.sql`
      UPDATE "Job" SET "status" = 'PROCESSING', "lockedAt" = NOW(), "lockedBy" = ${workerId}, "attempts" = "attempts" + 1, "updatedAt" = NOW()
      WHERE "id" = (
        SELECT "id" FROM "Job"
        WHERE (("status" = 'QUEUED' AND "runAt" <= NOW()) OR ("status" = 'PROCESSING' AND "lockedAt" < ${staleBefore}))
        ${typeFilter}
        ORDER BY "runAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING "id", "type", "payload", "attempts", "maxAttempts", "workspaceId"
    `);
    return rows[0] ?? null;
  }

  async complete(jobId: string, result?: Prisma.InputJsonValue, logs: string[] = []) {
    await prisma.job.update({ where: { id: jobId }, data: { status: "SUCCEEDED", result: result ?? Prisma.JsonNull, logs, lockedAt: null, lockedBy: null } });
  }

  async fail(jobId: string, error: string, logs: string[] = []) {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return { willRetry: false };
    const willRetry = job.attempts < job.maxAttempts;
    const backoffMs = Math.min(60_000 * 2 ** (job.attempts - 1), 15 * 60_000);
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: willRetry ? "QUEUED" : "FAILED",
        lastError: error.slice(0, 2000),
        logs,
        lockedAt: null,
        lockedBy: null,
        runAt: willRetry ? new Date(Date.now() + backoffMs) : job.runAt,
      },
    });
    return { willRetry };
  }

  async cancel(jobId: string) {
    await prisma.job.updateMany({ where: { id: jobId, status: { in: ["QUEUED", "PROCESSING"] } }, data: { status: "CANCELED", lockedAt: null, lockedBy: null } });
  }
}
