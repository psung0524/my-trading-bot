import type { Prisma } from "@prisma/client";

export type JobRecord = {
  id: string;
  type: string;
  payload: Prisma.JsonValue;
  attempts: number;
  maxAttempts: number;
  workspaceId: string | null;
};

export interface JobQueueProvider {
  enqueue(input: {
    type: string;
    payload: Prisma.InputJsonValue;
    workspaceId?: string | null;
    idempotencyKey?: string;
    runAt?: Date;
    maxAttempts?: number;
  }): Promise<{ jobId: string; deduplicated: boolean }>;
  /** 실행 가능한 Job 하나를 잠그고 가져온다 */
  claim(workerId: string, types?: string[]): Promise<JobRecord | null>;
  complete(jobId: string, result?: Prisma.InputJsonValue, logs?: string[]): Promise<void>;
  fail(jobId: string, error: string, logs?: string[]): Promise<{ willRetry: boolean }>;
  cancel(jobId: string): Promise<void>;
}
